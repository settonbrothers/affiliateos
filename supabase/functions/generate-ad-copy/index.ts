import { ForbiddenError, requireUser, UnauthorizedError } from '../_shared/auth.ts'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { assertUnderDailyCap, DailyCapExceededError } from '../_shared/costCap.ts'
import {
  InsufficientCreditsError,
  linkCreditToRun,
  refundCredits,
  reserveCredits,
  type CreditHold,
} from '../_shared/credits.ts'
import { sendToDlq } from '../_shared/dlq.ts'
import { assertNotPaused, OrchestratorPausedError } from '../_shared/killSwitch.ts'
import { createTrace, recordGeneration } from '../_shared/langfuseClient.ts'
import { runAdCopy, type AdCopyInput } from '../_shared/orchestrators/adCopy.ts'
import type { TasteExample } from '../_shared/orchestrators/adCopyLogic.ts'
import {
  recordRunError,
  recordRunStart,
  recordRunSuccess,
} from '../_shared/recordAiRun.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

const MOCK_LATENCY_MS = 8_000
const ACTION = 'generate-ad-copy'
const ORCHESTRATOR = 'AdCopyOrchestrator'
// Cap how many human-labelled examples feed the few-shot context, newest first.
const CORPUS_LIMIT = 60

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req)
  if (preflight) return preflight

  try {
    const user = await requireUser(req)

    const body = (await req.json().catch(() => ({}))) as { offer_id?: string; template?: string }
    const offerId = body.offer_id
    if (!offerId) return jsonResponse({ error: 'offer_id is required' }, 400)
    const template = body.template ?? undefined

    const admin = getAdminClient()
    const { data: offer, error: offerErr } = await admin
      .from('offers')
      .select('id, workspace_id, vertical_id, name, operator_notes, verticals(slug)')
      .eq('id', offerId)
      .single()
    if (offerErr || !offer) return jsonResponse({ error: 'Offer not found' }, 404)

    // Kill switch — fail fast before opening an ai_runs row.
    try {
      await assertNotPaused(ORCHESTRATOR)
    } catch (err) {
      if (err instanceof OrchestratorPausedError) return jsonResponse({ error: err.message }, 503)
      throw err
    }

    // Daily USD budget guard — fail fast before opening an ai_runs row.
    if (offer.workspace_id) {
      try {
        await assertUnderDailyCap(offer.workspace_id)
      } catch (err) {
        if (err instanceof DailyCapExceededError) return jsonResponse({ error: err.message }, 429)
        throw err
      }
    }

    // Credit guard — reserve (debit) before any LLM work; refunded on failure.
    let creditHold: CreditHold | null = null
    if (offer.workspace_id) {
      try {
        creditHold = await reserveCredits(offer.workspace_id, ACTION)
      } catch (err) {
        if (err instanceof InsufficientCreditsError) return jsonResponse({ error: err.message }, 402)
        throw err
      }
    }

    const verticalSlug =
      (offer as unknown as { verticals?: { slug: string } | null }).verticals?.slug ??
      undefined

    // Product grounding: the offer's verified facts (same source the underwriting
    // verdict is built from) feed product excavation.
    const { data: factsRows } = await admin
      .from('extracted_facts')
      .select('fact_type, fact_value, source_quote, confidence_score')
      .eq('offer_id', offerId)
      .eq('status', 'verified')
    const facts = factsRows ?? []

    // Latest consumer-facing test kit (angles, hooks, target_audience) — prior
    // work the copy builds on rather than regenerating from scratch.
    const { data: testKitRow } = await admin
      .from('test_kits')
      .select('payload')
      .eq('offer_id', offerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const testKit = testKitRow?.payload ?? null

    // Fetch deep brief context (optional — non-fatal if missing).
    const { data: deepBriefRow } = await admin
      .from('offer_deep_briefs')
      .select('payload')
      .eq('offer_id', offerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const deepBriefContext = (deepBriefRow?.payload as Record<string, unknown> | null) ?? null

    // Fetch avatar context (optional — non-fatal if missing).
    const { data: avatarRow } = await admin
      .from('offer_avatars')
      .select('payload')
      .eq('offer_id', offerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const avatarContext = (avatarRow?.payload as Record<string, unknown> | null) ?? null

    // Fetch spy analysis context (optional — non-fatal if missing).
    const { data: spyRow } = await admin
      .from('spy_analyses')
      .select('payload')
      .eq('offer_id', offerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const spyContext = (spyRow?.payload as Record<string, unknown> | null) ?? null

    // Taste Corpus: human-labelled examples (Edit-Loop + any seed), scoped to the
    // workspace plus global admin examples. Drives few-shot + (later) calibration.
    let corpusQuery = admin
      .from('copy_taste_examples')
      .select('kind, lang, text, improved_text, label, reason, workspace_id')
      .order('created_at', { ascending: false })
      .limit(CORPUS_LIMIT)
    // Workspace-scoped examples + global (workspace-null) admin examples.
    corpusQuery = offer.workspace_id
      ? corpusQuery.or(`workspace_id.eq.${offer.workspace_id},workspace_id.is.null`)
      : corpusQuery.is('workspace_id', null)
    const { data: corpusRows } = await corpusQuery
    const corpus: TasteExample[] = (corpusRows ?? []).map((r) => ({
      kind: r.kind as TasteExample['kind'],
      lang: r.lang as TasteExample['lang'],
      text: r.text as string,
      improved_text: (r.improved_text as string | null) ?? null,
      label: r.label as TasteExample['label'],
      reason: (r.reason as string | null) ?? null,
    }))

    // Hook library: admin-curated examples injected as few-shot into the hook stage.
    const { data: hookLibraryRows } = await admin
      .from('copy_hook_library')
      .select('text, lang, hook_type, label')
      .order('created_at', { ascending: false })
    const hookLibrary = (hookLibraryRows ?? []).map((r) => ({
      text: r.text as string,
      lang: r.lang as string,
      hook_type: r.hook_type as string,
      label: r.label as string,
    }))

    const willCallReal = !!Deno.env.get('ANTHROPIC_API_KEY')
    const model = willCallReal ? Deno.env.get('AD_COPY_MODEL') ?? 'claude-sonnet-4-6' : 'mock'

    const runId = await recordRunStart({
      orchestratorName: ORCHESTRATOR,
      agentVersion: willCallReal ? 'real-v1' : 'mock-v1',
      model,
      inputPayload: {
        offer_id: offerId,
        verified_fact_count: facts.length,
        corpus_example_count: corpus.length,
        vertical: verticalSlug ?? null,
      },
      userId: user.id,
      workspaceId: offer.workspace_id ?? undefined,
      offerId,
    })
    await linkCreditToRun(creditHold, runId)

    EdgeRuntime.waitUntil(
      (async () => {
        const startTime = new Date()
        try {
          // Mock path keeps latency so UI Realtime/polling exercises its loading state.
          if (!willCallReal) {
            await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))
          }

          const input: AdCopyInput = {
            offer: {
              id: offer.id,
              name: offer.name,
              vertical: verticalSlug ?? null,
              description: offer.operator_notes ?? null,
            },
            productContext: { verified_facts: facts },
            testKit,
            corpus,
            verticalSlug,
            template,
            hookLibrary,
            deepBriefContext,
            avatarContext,
            spyContext,
          }

          const result = await runAdCopy(input)

          const traceId = await createTrace({
            name: `generate-ad-copy:${offerId}`,
            userId: user.id,
          })
          await recordGeneration({
            traceId,
            name: `${ORCHESTRATOR} (${result.mode})`,
            model,
            input: { offer_id: offerId, corpus_example_count: corpus.length },
            output: result.output,
            promptTokens: result.usage?.input_tokens ?? 0,
            completionTokens: result.usage?.output_tokens ?? 0,
            costUsd: result.usage?.cost_usd ?? 0,
            startTime,
            endTime: new Date(),
          })

          // Persist the generation (envelope + payload) for the Copy tab + Edit-Loop.
          await admin.from('ad_copy_generations').insert({
            offer_id: offerId,
            workspace_id: offer.workspace_id,
            created_by_user_id: user.id,
            ai_run_id: runId,
            payload: result.output,
            status: 'generated',
            template: template ?? null,
          })

          await recordRunSuccess(runId, {
            outputPayload: result.output,
            validatedOutput: result.output,
            envelope: result.output,
            tokensInput: result.usage?.input_tokens,
            tokensOutput: result.usage?.output_tokens,
            estimatedCost: result.usage?.cost_usd ?? 0,
            langfuseTraceId: traceId,
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          await recordRunError(runId, message)
          // Refund the reserved credits — we don't charge for failed runs.
          if (offer.workspace_id) {
            await refundCredits(offer.workspace_id, creditHold, ACTION, runId)
          }
          // Dead-letter so an admin can replay from /admin/failed once the cause clears.
          await sendToDlq({
            messageType: 'ai_run',
            payload: { kind: ACTION, offer_id: offerId, ai_run_id: runId },
            error: message,
          })
        }
      })()
    )

    return jsonResponse({ run_id: runId }, 200)
  } catch (err) {
    if (err instanceof UnauthorizedError) return jsonResponse({ error: err.message }, 401)
    if (err instanceof ForbiddenError) return jsonResponse({ error: err.message }, 403)
    return jsonResponse({ error: 'Internal error' }, 500)
  }
})
