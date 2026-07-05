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
import { runCreativeEngine } from '../_shared/orchestrators/creativeEngine.ts'
import {
  recordRunError,
  recordRunStart,
  recordRunSuccess,
} from '../_shared/recordAiRun.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

const MOCK_LATENCY_MS = 4_000
const ACTION = 'generate-creative'
const ORCHESTRATOR = 'CreativeEngineOrchestrator'

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req)
  if (preflight) return preflight

  try {
    const user = await requireUser(req)

    const body = (await req.json().catch(() => ({}))) as { offer_id?: string; reference_image_base64?: string }
    const offerId = body.offer_id
    const referenceImageBase64 = body.reference_image_base64 ?? undefined
    if (!offerId) return jsonResponse({ error: 'offer_id is required' }, 400)

    const admin = getAdminClient()
    const { data: offer, error: offerErr } = await admin
      .from('offers')
      .select('id, workspace_id, name, vertical_id, operator_notes')
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

    const willCallReal = !!Deno.env.get('ANTHROPIC_API_KEY')
    const model = willCallReal ? 'claude-sonnet-4-6' : 'mock'

    const runId = await recordRunStart({
      orchestratorName: ORCHESTRATOR,
      agentVersion: willCallReal ? 'real-v1' : 'mock-v1',
      model,
      inputPayload: {
        offer_id: offerId,
        has_reference_image: !!referenceImageBase64,
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
          // Mock path keeps latency so the UI Realtime/polling exercises its loading state.
          if (!willCallReal) {
            await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))
          }

          // Fetch full avatar context.
          const { data: latestAvatar } = await admin
            .from('offer_avatars')
            .select('payload')
            .eq('offer_id', offerId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          const avatarContext = (latestAvatar?.payload as Record<string, unknown> | null) ?? null

          // Fetch full deep brief context.
          const { data: latestDeepBrief } = await admin
            .from('offer_deep_briefs')
            .select('payload')
            .eq('offer_id', offerId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          const deepBriefContext = (latestDeepBrief?.payload as Record<string, unknown> | null) ?? null

          // Fetch latest ad copy context (hooks + body inform creative direction).
          const { data: latestCopy } = await admin
            .from('ad_copy_generations')
            .select('payload')
            .eq('offer_id', offerId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          const copyContext = (latestCopy?.payload as Record<string, unknown> | null) ?? null

          // Fetch spy analysis context (optional).
          const { data: spyRow } = await admin
            .from('spy_analyses')
            .select('payload')
            .eq('offer_id', offerId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          const spyContext = (spyRow?.payload as Record<string, unknown> | null) ?? null

          const result = await runCreativeEngine({
            offer: {
              id: offer.id,
              name: offer.name,
              vertical: null,
              description: offer.operator_notes ?? null,
            },
            avatarContext,
            deepBriefContext,
            copyContext,
            spyContext,
            referenceImageBase64,
          })

          const traceId = await createTrace({
            name: `generate-creative:${offerId}`,
            userId: user.id,
          })
          await recordGeneration({
            traceId,
            name: `${ORCHESTRATOR} (${result.mode})`,
            model,
            input: { offer_id: offerId },
            output: result.output,
            promptTokens: result.usage?.input_tokens ?? 0,
            completionTokens: result.usage?.output_tokens ?? 0,
            costUsd: result.usage?.cost_usd ?? 0,
            startTime,
            endTime: new Date(),
          })

          // Persist the creatives.
          await admin.from('offer_creatives').insert({
            offer_id: offerId,
            workspace_id: offer.workspace_id,
            ai_run_id: runId,
            payload: result.output,
            status: 'generated',
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
