import { ForbiddenError, requireAdmin, UnauthorizedError } from '../_shared/auth.ts'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { assertUnderDailyCap, DailyCapExceededError } from '../_shared/costCap.ts'
import { assertNotPaused, OrchestratorPausedError } from '../_shared/killSwitch.ts'
import { runSourceExtraction } from '../_shared/orchestrators/sourceExtraction.ts'
import { recordRunError, recordRunStart, recordRunSuccess } from '../_shared/recordAiRun.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'
import { truncate } from '../_shared/truncate.ts'

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

const FETCH_TIMEOUT_MS = 15_000
const MAX_HTML_BYTES = 500_000
const MAX_RAW_TEXT_LEN = 200_000
// Facts at/above this extraction confidence (0-100) are auto-verified so the
// underwriting run actually receives them; below it they stay 'proposed' for
// admin review. Auto-verified rows keep reviewed_by NULL (≠ human-verified).
const AUTO_VERIFY_MIN_CONFIDENCE = 70

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req)
  if (preflight) return preflight

  try {
    const user = await requireAdmin(req)

    const body = (await req.json().catch(() => ({}))) as {
      offer_id?: string
      url?: string
    }
    if (!body.offer_id) return jsonResponse({ error: 'offer_id is required' }, 400)
    if (!body.url || !/^https?:\/\//i.test(body.url)) {
      return jsonResponse({ error: 'valid http(s) url is required' }, 400)
    }
    const offerId = body.offer_id
    const url = body.url

    const admin = getAdminClient()

    const { data: offer, error: offerErr } = await admin
      .from('offers')
      .select('id, workspace_id')
      .eq('id', offerId)
      .maybeSingle()
    if (offerErr || !offer) return jsonResponse({ error: 'Offer not found' }, 404)

    try {
      await assertNotPaused('SourceExtractionOrchestrator')
    } catch (err) {
      if (err instanceof OrchestratorPausedError) return jsonResponse({ error: err.message }, 503)
      throw err
    }

    // Daily USD budget guard — fail fast before queuing the ingestion job.
    if (offer.workspace_id) {
      try {
        await assertUnderDailyCap(offer.workspace_id)
      } catch (err) {
        if (err instanceof DailyCapExceededError) return jsonResponse({ error: err.message }, 429)
        throw err
      }
    }

    const { data: jobRow, error: jobErr } = await admin
      .from('source_fetch_jobs')
      .insert({
        offer_id: offerId,
        url,
        triggered_by: user.id,
        status: 'queued',
      })
      .select('id')
      .single()
    if (jobErr || !jobRow) return jsonResponse({ error: 'Failed to queue job' }, 500)
    const jobId = jobRow.id

    EdgeRuntime.waitUntil(
      processIngestion({
        jobId,
        offerId,
        url,
        userId: user.id,
        workspaceId: offer.workspace_id ?? undefined,
      })
    )

    return jsonResponse({ job_id: jobId }, 200)
  } catch (err) {
    if (err instanceof UnauthorizedError) return jsonResponse({ error: err.message }, 401)
    if (err instanceof ForbiddenError) return jsonResponse({ error: err.message }, 403)
    return jsonResponse({ error: 'Internal error' }, 500)
  }
})

async function processIngestion(args: {
  jobId: string
  offerId: string
  url: string
  userId: string
  workspaceId?: string
}): Promise<void> {
  const admin = getAdminClient()
  const willCallReal = !!Deno.env.get('ANTHROPIC_API_KEY')
  const model = willCallReal ? 'claude-haiku-4-5-20251001' : 'mock'
  const agentVersion = willCallReal ? 'real-v1' : 'mock-v1'

  try {
    await admin
      .from('source_fetch_jobs')
      .update({ status: 'fetching', started_at: new Date().toISOString() })
      .eq('id', args.jobId)

    const html = await fetchWithTimeout(args.url, FETCH_TIMEOUT_MS)
    const trimmedHtml = html.length > MAX_HTML_BYTES ? html.slice(0, MAX_HTML_BYTES) : html
    const rawText = truncate(stripHtml(trimmedHtml), MAX_RAW_TEXT_LEN)

    const { data: sdRow, error: sdErr } = await admin
      .from('source_documents')
      .insert({
        offer_id: args.offerId,
        url: args.url,
        status: 'fetched',
        raw_text: rawText,
        fetched_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (sdErr || !sdRow) throw new Error('Failed to insert source_document')
    const sdId = sdRow.id

    await admin
      .from('source_fetch_jobs')
      .update({ status: 'extracting', source_document_id: sdId })
      .eq('id', args.jobId)

    // Record an ai_runs row for the extraction call so cost + tokens are
    // tracked the same way as analyze-offer's underwriting call.
    const runId = await recordRunStart({
      orchestratorName: 'SourceExtractionOrchestrator',
      agentVersion,
      model,
      inputPayload: {
        offer_id: args.offerId,
        source_document_id: sdId,
        url: args.url,
        raw_text_len: rawText.length,
      },
      userId: args.userId,
      workspaceId: args.workspaceId,
      offerId: args.offerId,
    })

    type ExtractionPayload = {
      doc_type: string
      source_summary: string
      language: string
      source_reliability_score: number
      facts: Array<{
        fact_type: string
        fact_value: string
        source_quote: string
        confidence_score: number
      }>
    }

    let result
    try {
      result = await runSourceExtraction({
        offerId: args.offerId,
        url: args.url,
        rawText,
      })
    } catch (err) {
      await recordRunError(runId, err instanceof Error ? err.message : String(err))
      throw err
    }

    const p = (result.output as { payload: ExtractionPayload }).payload

    await admin
      .from('source_documents')
      .update({
        status: 'extracted',
        doc_type: p.doc_type as never,
        source_summary: p.source_summary,
        language: p.language,
        source_reliability_score: p.source_reliability_score,
        extracted_at: new Date().toISOString(),
      })
      .eq('id', sdId)

    if (p.facts.length > 0) {
      await admin.from('extracted_facts').insert(
        p.facts.map((f) => ({
          offer_id: args.offerId,
          source_document_id: sdId,
          fact_type: f.fact_type as never,
          fact_value: f.fact_value,
          source_quote: f.source_quote,
          confidence_score: f.confidence_score,
          status: (f.confidence_score >= AUTO_VERIFY_MIN_CONFIDENCE
            ? 'verified'
            : 'proposed') as never,
        }))
      )
    }

    await recordRunSuccess(runId, {
      outputPayload: result.output,
      validatedOutput: result.output,
      envelope: result.output,
      tokensInput: result.usage?.input_tokens,
      tokensOutput: result.usage?.output_tokens,
      estimatedCost: result.usage?.cost_usd ?? 0,
    })

    await admin
      .from('source_fetch_jobs')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', args.jobId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await admin
      .from('source_fetch_jobs')
      .update({
        status: 'failed',
        error_message: msg,
        completed_at: new Date().toISOString(),
      })
      .eq('id', args.jobId)
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AffiliateOS-Ingest/1.0 (+m2)' },
    })
    if (!res.ok) throw new Error(`fetch ${url} failed: HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(t)
  }
}

function stripHtml(s: string): string {
  return s
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
