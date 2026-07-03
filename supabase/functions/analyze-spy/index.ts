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
import { runSpyAnalysis } from '../_shared/orchestrators/spyAnalysis.ts'
import {
  recordRunError,
  recordRunStart,
  recordRunSuccess,
} from '../_shared/recordAiRun.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

const MOCK_LATENCY_MS = 4_000
const ACTION = 'analyze-spy'
const ORCHESTRATOR = 'SpyAnalysisOrchestrator'

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req)
  if (preflight) return preflight

  try {
    const user = await requireUser(req)

    const body = (await req.json().catch(() => ({}))) as {
      offer_id?: string
      input_type?: string
      raw_input?: string
    }
    const offerId = body.offer_id
    const inputType = body.input_type
    const rawInput = body.raw_input

    if (!offerId) return jsonResponse({ error: 'offer_id is required' }, 400)
    if (!inputType) return jsonResponse({ error: 'input_type is required' }, 400)
    if (!rawInput) return jsonResponse({ error: 'raw_input is required' }, 400)
    if (!['text', 'url', 'batch', 'image'].includes(inputType)) {
      return jsonResponse({ error: 'input_type must be one of: text, url, batch, image' }, 400)
    }

    const admin = getAdminClient()
    const { data: offer, error: offerErr } = await admin
      .from('offers')
      .select('id, workspace_id, name, vertical')
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
        input_type: inputType,
        // Omit raw_input for image type to avoid storing large base64 blobs
        ...(inputType !== 'image' ? { raw_input_preview: rawInput.slice(0, 200) } : {}),
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

          const result = await runSpyAnalysis({
            offer: {
              id: offer.id,
              name: offer.name,
              vertical: (offer as { vertical?: string | null }).vertical ?? null,
            },
            rawInput,
            inputType: inputType as 'text' | 'url' | 'batch' | 'image',
          })

          const traceId = await createTrace({
            name: `analyze-spy:${offerId}`,
            userId: user.id,
          })
          await recordGeneration({
            traceId,
            name: `${ORCHESTRATOR} (${result.mode})`,
            model,
            input: { offer_id: offerId, input_type: inputType },
            output: result.output,
            promptTokens: result.usage?.input_tokens ?? 0,
            completionTokens: result.usage?.output_tokens ?? 0,
            costUsd: result.usage?.cost_usd ?? 0,
            startTime,
            endTime: new Date(),
          })

          // Persist the analysis.
          await admin.from('spy_analyses').insert({
            offer_id: offerId,
            workspace_id: offer.workspace_id,
            ai_run_id: runId,
            input_type: inputType,
            raw_input: rawInput,
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
