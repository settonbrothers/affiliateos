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
import { runAvatarBuilder } from '../_shared/orchestrators/avatarBuilder.ts'
import {
  recordRunError,
  recordRunStart,
  recordRunSuccess,
} from '../_shared/recordAiRun.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

const MOCK_LATENCY_MS = 4_000
const ACTION = 'generate-avatar'
const ORCHESTRATOR = 'AvatarBuilderOrchestrator'

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req)
  if (preflight) return preflight

  try {
    const user = await requireUser(req)

    const body = (await req.json().catch(() => ({}))) as { offer_id?: string }
    const offerId = body.offer_id
    if (!offerId) return jsonResponse({ error: 'offer_id is required' }, 400)

    const admin = getAdminClient()
    const { data: offer, error: offerErr } = await admin
      .from('offers')
      .select('id, workspace_id, name, website_url, operator_notes, verticals(slug)')
      .eq('id', offerId)
      .single()
    if (offerErr || !offer) return jsonResponse({ error: 'Offer not found' }, 404)

    // Fetch deep brief context (optional — non-fatal if missing).
    const { data: deepBriefRow } = await admin
      .from('offer_deep_briefs')
      .select('payload')
      .eq('offer_id', offerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const deepBriefContext = (deepBriefRow?.payload as Record<string, unknown> | null) ?? null

    // Fetch latest spy analysis context (optional — non-fatal if missing).
    const { data: spyRow } = await admin
      .from('spy_analyses')
      .select('payload')
      .eq('offer_id', offerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const spyContext = (spyRow?.payload as Record<string, unknown> | null) ?? null

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

          const result = await runAvatarBuilder({
            offer: {
              id: offer.id,
              name: offer.name,
              website_url: offer.website_url ?? null,
              operator_notes: offer.operator_notes ?? null,
              vertical:
                (offer as unknown as { verticals?: { slug: string } | null }).verticals?.slug ??
                null,
            },
            deepBriefContext,
            spyContext,
          })

          const traceId = await createTrace({
            name: `generate-avatar:${offerId}`,
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

          // Persist the avatar (upsert so regeneration doesn't violate the unique constraint).
          await admin.from('offer_avatars').upsert(
            {
              offer_id: offerId,
              workspace_id: offer.workspace_id,
              ai_run_id: runId,
              payload: result.output,
              status: 'generated',
            },
            { onConflict: 'offer_id' }
          )

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
