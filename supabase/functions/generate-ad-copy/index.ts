import {
  ForbiddenError,
  requireUser,
  UnauthorizedError,
} from '../_shared/auth.ts'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import {
  assertUnderDailyCap,
  DailyCapExceededError,
} from '../_shared/costCap.ts'
import {
  InsufficientCreditsError,
  linkCreditToRun,
  refundCredits,
  reserveCredits,
  type CreditHold,
} from '../_shared/credits.ts'
import { sendToDlq } from '../_shared/dlq.ts'
import {
  assertNotPaused,
  OrchestratorPausedError,
} from '../_shared/killSwitch.ts'
import { createTrace, recordGeneration } from '../_shared/langfuseClient.ts'
import { runAdCopy, type AdCopyInput } from '../_shared/orchestrators/adCopy.ts'
import {
  createCopyBrainSnapshot,
  missingCopyBrainInputs,
} from '../_shared/orchestrators/copyBrainSnapshot.ts'
import { sha256Text } from '../_shared/orchestrators/adCopyEvidenceResearch.ts'
import type { TasteExample } from '../_shared/orchestrators/adCopyLogic.ts'
import {
  StoredAvatarSchema,
  type CopyBrainInputSnapshotV1,
} from '../_shared/types/copyBrain.ts'
import { OfferEconomicsV1Schema } from '../_shared/types/offerEconomics.ts'
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

    const body = (await req.json().catch(() => ({}))) as {
      offer_id?: string
      template?: string
      creative_hint?: string
      additional_source_urls?: string[]
      campaign_context?: { channel?: string; geo?: string; audience?: string }
    }
    const offerId = body.offer_id
    if (!offerId) return jsonResponse({ error: 'offer_id is required' }, 400)
    if (
      body.creative_hint &&
      (typeof body.creative_hint !== 'string' ||
        body.creative_hint.length > 2_000)
    ) {
      return jsonResponse(
        { error: 'creative_hint must be at most 2000 characters' },
        400
      )
    }
    if (
      body.additional_source_urls &&
      (!Array.isArray(body.additional_source_urls) ||
        body.additional_source_urls.length > 5)
    ) {
      return jsonResponse(
        { error: 'additional_source_urls must contain at most 5 URLs' },
        400
      )
    }
    const additionalSourceUrls = (body.additional_source_urls ?? []).filter(
      (value) => {
        try {
          return ['http:', 'https:'].includes(new URL(value).protocol)
        } catch {
          return false
        }
      }
    )
    if (
      additionalSourceUrls.length !== (body.additional_source_urls ?? []).length
    ) {
      return jsonResponse(
        { error: 'additional_source_urls contains an invalid URL' },
        400
      )
    }
    const template = body.template ?? undefined

    const admin = getAdminClient()
    const { data: offer, error: offerErr } = await admin
      .from('offers')
      .select(
        'id, workspace_id, vertical_id, name, website_url, affiliate_program_url, network, vendor_name, primary_language, short_description, operator_notes, verticals(slug)'
      )
      .eq('id', offerId)
      .single()
    if (offerErr || !offer)
      return jsonResponse({ error: 'Offer not found' }, 404)

    // Kill switch — fail fast before opening an ai_runs row.
    try {
      await assertNotPaused(ORCHESTRATOR)
    } catch (err) {
      if (err instanceof OrchestratorPausedError)
        return jsonResponse({ error: err.message }, 503)
      throw err
    }

    // Daily USD budget guard — fail fast before opening an ai_runs row.
    if (offer.workspace_id) {
      try {
        await assertUnderDailyCap(offer.workspace_id)
      } catch (err) {
        if (err instanceof DailyCapExceededError)
          return jsonResponse({ error: err.message }, 429)
        throw err
      }
    }

    // Credit guard — reserve (debit) before any LLM work; refunded on failure.
    let creditHold: CreditHold | null = null
    if (offer.workspace_id) {
      try {
        creditHold = await reserveCredits(offer.workspace_id, ACTION)
      } catch (err) {
        if (err instanceof InsufficientCreditsError)
          return jsonResponse({ error: err.message }, 402)
        throw err
      }
    }

    const verticalSlug =
      (offer as unknown as { verticals?: { slug: string } | null }).verticals
        ?.slug ?? undefined

    // Product grounding: the offer's verified facts (same source the underwriting
    // verdict is built from) feed product excavation.
    const { data: factsRows } = await admin
      .from('extracted_facts')
      .select(
        'source_document_id, fact_type, fact_value, source_quote, confidence_score'
      )
      .eq('offer_id', offerId)
      .eq('status', 'verified')
    const facts = factsRows ?? []

    const { data: sourceDocumentRows } = await admin
      .from('source_documents')
      .select(
        'id, url, doc_type, raw_text, source_summary, source_reliability_score, status'
      )
      .eq('offer_id', offerId)
      .in('status', ['fetched', 'extracted'])
    const sourceDocuments = sourceDocumentRows ?? []

    const { data: underwritingRow } = await admin
      .from('ai_runs')
      .select('output_payload')
      .eq('offer_id', offerId)
      .eq('orchestrator_name', 'UnderwritingOrchestrator')
      .eq('status', 'success')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const underwritingContext =
      (underwritingRow?.output_payload as Record<string, unknown> | null) ??
      null

    const { data: complianceRow } = await admin
      .from('offer_compliance_warnings')
      .select('payload')
      .eq('offer_id', offerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const complianceContext =
      (complianceRow?.payload as Record<string, unknown> | null) ?? null

    const { data: offerEconomicsRow } = await admin
      .from('offer_economics')
      .select('payload')
      .eq('offer_id', offerId)
      .eq('is_current', true)
      .maybeSingle()
    const parsedOfferEconomics = OfferEconomicsV1Schema.safeParse(
      offerEconomicsRow?.payload
    )
    const offerEconomics = parsedOfferEconomics.success
      ? parsedOfferEconomics.data
      : null

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
    const deepBriefContext =
      (deepBriefRow?.payload as Record<string, unknown> | null) ?? null

    // Fetch avatar context (optional — non-fatal if missing).
    const { data: avatarRow } = await admin
      .from('offer_avatars')
      .select('payload')
      .eq('offer_id', offerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const avatarContext =
      (avatarRow?.payload as Record<string, unknown> | null) ?? null

    // Fetch spy analysis context (optional — non-fatal if missing).
    const { data: spyRows } = await admin
      .from('spy_analyses')
      .select('id, payload, input_type, raw_input, created_at')
      .eq('offer_id', offerId)
      .order('created_at', { ascending: false })
      .limit(10)
    const spyHistory = (spyRows ?? []).map((row) => ({
      id: row.id,
      input_type: row.input_type,
      raw_input: row.raw_input,
      created_at: row.created_at,
      payload: row.payload,
    }))
    const spyContext =
      (spyRows?.[0]?.payload as Record<string, unknown> | undefined) ?? null

    const { data: campaignRows } = await admin
      .from('campaigns')
      .select('id')
      .eq('offer_id', offerId)
    const campaignIds = (campaignRows ?? []).map((row) => row.id)
    const { data: campaignResultRows } = campaignIds.length
      ? await admin
          .from('campaign_results')
          .select(
            'campaign_id, spend_amount, spend_currency, impressions, clicks, landing_views, affiliate_clicks, conversions, approved_conversions, reversed_conversions, commission_amount, commission_currency, days_running'
          )
          .in('campaign_id', campaignIds)
      : { data: [] }
    const { data: diagnosisRows } = campaignIds.length
      ? await admin
          .from('result_diagnoses')
          .select('campaign_id, creative_analysis')
          .in('campaign_id', campaignIds)
      : { data: [] }

    // Taste Corpus: human-labelled examples (Edit-Loop + any seed), scoped to the
    // workspace plus global admin examples. Drives few-shot + (later) calibration.
    let corpusQuery = admin
      .from('copy_taste_examples')
      .select('kind, lang, text, improved_text, label, reason, workspace_id')
      .order('created_at', { ascending: false })
      .limit(CORPUS_LIMIT)
    // Workspace-scoped examples + global (workspace-null) admin examples.
    corpusQuery = offer.workspace_id
      ? corpusQuery.or(
          `workspace_id.eq.${offer.workspace_id},workspace_id.is.null`
        )
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

    const docsById = new Map(
      sourceDocuments.map((doc) => [String(doc.id), doc] as const)
    )
    const brainSources: CopyBrainInputSnapshotV1['sources'] = await Promise.all(
      facts.map(async (fact, index) => {
        const sourceDocumentId = (
          fact as { source_document_id?: string | null }
        ).source_document_id
        const doc = sourceDocumentId
          ? docsById.get(sourceDocumentId)
          : undefined
        const docType = String(doc?.doc_type ?? 'unknown')
        const sourceType =
          docType === 'review_page'
            ? 'independent_review'
            : docType === 'manual_note'
              ? 'operator_note'
              : 'first_party_document'
        const claim = String(fact.fact_value)
        const quote = fact.source_quote ? String(fact.source_quote) : null
        const sourceId = `fact-${index}-${String(fact.fact_type)}`
        return {
          source_id: sourceId,
          source_type: sourceType as
            'independent_review' | 'operator_note' | 'first_party_document',
          source_url: typeof doc?.url === 'string' ? doc.url : null,
          source_quote: quote,
          claim,
          priority:
            sourceType === 'independent_review'
              ? 2
              : sourceType === 'first_party_document'
                ? 3
                : 5,
          verified: true,
          snapshot_sha256: await sha256Text(
            `${sourceId}\n${claim}\n${quote ?? ''}`
          ),
        }
      })
    )
    const resultByCampaign = new Map(
      (campaignResultRows ?? []).map(
        (row) => [String(row.campaign_id), row] as const
      )
    )
    const performanceWinners: Array<{
      winner_id: string
      offer_id: string
      campaign_id: string
      creative_id: string | null
      hook: string
      metrics: Record<string, number>
      decision_rule: string
      source_ref: string
    }> = []
    for (const diagnosis of diagnosisRows ?? []) {
      const campaignId = String(diagnosis.campaign_id)
      const result = resultByCampaign.get(campaignId)
      if (!result) continue
      const metrics = {
        spend_amount: Number(result.spend_amount),
        impressions: Number(result.impressions),
        clicks: Number(result.clicks),
        affiliate_clicks: Number(result.affiliate_clicks),
        conversions: Number(result.conversions),
        approved_conversions: Number(result.approved_conversions),
        commission_amount: Number(result.commission_amount ?? 0),
      }
      const sourceRef = `campaign-${campaignId}`
      brainSources.push({
        source_id: sourceRef,
        source_type: 'campaign_result',
        source_url: null,
        source_quote: null,
        claim: `Measured campaign result for ${campaignId}`,
        priority: 1,
        verified: true,
        snapshot_sha256: await sha256Text(
          JSON.stringify({ campaignId, metrics })
        ),
      })
      const analysis = Array.isArray(diagnosis.creative_analysis)
        ? diagnosis.creative_analysis
        : []
      for (const [index, item] of analysis.entries()) {
        if (!item || typeof item !== 'object') continue
        const record = item as Record<string, unknown>
        const sufficientlyMeasured =
          metrics.clicks >= 100 && metrics.approved_conversions >= 5
        const profitable = metrics.commission_amount > metrics.spend_amount
        if (
          record.is_winner !== true ||
          typeof record.hook !== 'string' ||
          !sufficientlyMeasured ||
          !profitable
        )
          continue
        performanceWinners.push({
          winner_id: `${campaignId}-${index}`,
          offer_id: offerId,
          campaign_id: campaignId,
          creative_id: null,
          hook: record.hook,
          metrics,
          decision_rule:
            typeof record.winner_reason === 'string'
              ? record.winner_reason
              : 'Measured winner with sufficient volume and positive campaign profit.',
          source_ref: sourceRef,
        })
      }
    }

    const brainSnapshot = await createCopyBrainSnapshot({
      snapshot_id: crypto.randomUUID(),
      captured_at: new Date().toISOString(),
      origin: 'affx',
      fixture_only: false,
      offer: {
        id: offer.id,
        name: offer.name,
        website_url: offer.website_url ?? null,
        affiliate_program_url: offer.affiliate_program_url ?? null,
        network: offer.network ?? null,
        vendor_name: offer.vendor_name ?? null,
        vertical: verticalSlug ?? null,
        primary_language: offer.primary_language ?? null,
        description: offer.short_description ?? offer.operator_notes ?? null,
      },
      campaign_context: {
        channel: body.campaign_context?.channel ?? 'meta_facebook',
        geo: body.campaign_context?.geo ? [body.campaign_context.geo] : [],
        audience: body.campaign_context?.audience ?? null,
        generation_language: 'he',
      },
      underwriting: underwritingContext,
      compliance: complianceContext,
      offer_economics: offerEconomics,
      sources: brainSources,
      research_documents: sourceDocuments as unknown as Array<
        Record<string, unknown>
      >,
      deep_brief: deepBriefContext,
      spy_analyses: spyHistory,
      market_examples: spyHistory,
      performance_winners: performanceWinners,
      avatar: StoredAvatarSchema.safeParse(avatarContext).success
        ? StoredAvatarSchema.parse(avatarContext)
        : null,
      test_kit: testKit as Record<string, unknown> | null,
      taste_corpus: corpus as unknown as Array<Record<string, unknown>>,
      hook_library: hookLibrary as unknown as Array<Record<string, unknown>>,
      creative_hint: body.creative_hint?.trim() || null,
      missing_inputs: [
        ...missingCopyBrainInputs({
          sources: brainSources,
          underwriting: underwritingContext,
          deepBrief: deepBriefContext,
          avatar: avatarContext,
          testKit,
          spy: spyHistory,
        }),
        ...(offerEconomics ? [] : ['offer_economics']),
      ],
      omitted_context: [],
    })

    const willCallReal = !!Deno.env.get('ANTHROPIC_API_KEY')
    const model = willCallReal
      ? (Deno.env.get('AD_COPY_MODEL') ?? 'claude-sonnet-4-6')
      : 'mock'

    const runId = await recordRunStart({
      orchestratorName: ORCHESTRATOR,
      agentVersion: willCallReal ? 'real-v1' : 'mock-v1',
      model,
      inputPayload: {
        offer_id: offerId,
        verified_fact_count: facts.length,
        corpus_example_count: corpus.length,
        vertical: verticalSlug ?? null,
        engine_version:
          Deno.env.get('AD_COPY_EVIDENCE_V4_ENABLED') === 'true'
            ? 'evidence-story-v4'
            : 'legacy-v2',
        creative_hint_present: !!body.creative_hint?.trim(),
        additional_source_url_count: additionalSourceUrls.length,
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
              url: offer.website_url ?? null,
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
            creativeHint: body.creative_hint?.trim() || null,
            additionalSourceUrls,
            campaignContext: body.campaign_context ?? {
              channel: 'meta_facebook',
              geo: null,
              audience: null,
            },
            brainSnapshot,
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
          const evidencePayload = (
            result.output as {
              payload?: {
                engine_version?: string
                output_status?: string
                evidence_envelope?: { sources?: Array<Record<string, unknown>> }
              }
            }
          ).payload
          await admin.from('ad_copy_generations').insert({
            offer_id: offerId,
            workspace_id: offer.workspace_id,
            created_by_user_id: user.id,
            ai_run_id: runId,
            payload: result.output,
            status: 'generated',
            template: template ?? null,
            engine_version: evidencePayload?.engine_version ?? 'legacy-v2',
            output_status: evidencePayload?.output_status ?? null,
            creative_hint: body.creative_hint?.trim() || null,
          })

          const evidenceSources =
            evidencePayload?.evidence_envelope?.sources ?? []
          if (evidenceSources.length > 0) {
            await admin.from('copy_source_snapshots').upsert(
              evidenceSources.map((source) => ({
                offer_id: offerId,
                workspace_id: offer.workspace_id,
                source_id: String(source.source_id),
                publisher_id: String(source.publisher_id),
                source_url:
                  typeof source.source_url === 'string'
                    ? source.source_url
                    : null,
                source_type: String(source.source_type),
                independence: String(source.independence),
                quality: String(source.quality),
                claim: String(source.claim),
                actual_person: source.actual_person === true,
                source_quote:
                  typeof source.source_quote === 'string'
                    ? source.source_quote
                    : null,
                snapshot_sha256: String(source.snapshot_sha256),
              })),
              { onConflict: 'offer_id,snapshot_sha256' }
            )
          }

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
    if (err instanceof UnauthorizedError)
      return jsonResponse({ error: err.message }, 401)
    if (err instanceof ForbiddenError)
      return jsonResponse({ error: err.message }, 403)
    return jsonResponse({ error: 'Internal error' }, 500)
  }
})
