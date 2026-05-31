import { ForbiddenError, requireUser, UnauthorizedError } from '../_shared/auth.ts'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { assertNotPaused, OrchestratorPausedError } from '../_shared/killSwitch.ts'
import { createTrace, recordGeneration } from '../_shared/langfuseClient.ts'
import { runUnderwriting } from '../_shared/orchestrators/underwriting.ts'
import {
  recordRunError,
  recordRunStart,
  recordRunSuccess,
} from '../_shared/recordAiRun.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'

// EdgeRuntime is provided by the Supabase Edge runtime.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

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
      .select('id, workspace_id, vertical_id, name')
      .eq('id', offerId)
      .single()
    if (offerErr || !offer) return jsonResponse({ error: 'Offer not found' }, 404)

    // Kill switch — fail fast before opening an ai_runs row.
    try {
      await assertNotPaused('UnderwritingOrchestrator')
    } catch (err) {
      if (err instanceof OrchestratorPausedError) return jsonResponse({ error: err.message }, 503)
      throw err
    }

    // M1 stub (real in M2): cost cap (always ok).

    const runId = await recordRunStart({
      orchestratorName: 'UnderwritingOrchestrator',
      agentVersion: 'mock-v1',
      model: 'mock',
      inputPayload: { offer_id: offerId },
      userId: user.id,
      workspaceId: offer.workspace_id ?? undefined,
      offerId,
    })

    // Run the mock work in the background; return run_id immediately so the UI
    // can subscribe / poll for the result.
    EdgeRuntime.waitUntil(
      (async () => {
        const startTime = new Date()
        try {
          await new Promise((resolve) => setTimeout(resolve, 8000))
          const output = await runUnderwriting({ offerId })

          const traceId = await createTrace({
            name: `analyze-offer:${offerId}`,
            userId: user.id,
          })
          await recordGeneration({
            traceId,
            name: 'UnderwritingOrchestrator (mock)',
            model: 'mock',
            input: { offer_id: offerId },
            output,
            promptTokens: 0,
            completionTokens: 0,
            costUsd: 0,
            startTime,
            endTime: new Date(),
          })

          await recordRunSuccess(runId, {
            outputPayload: output,
            validatedOutput: output,
            envelope: output,
            estimatedCost: 0,
            langfuseTraceId: traceId,
          })
        } catch (err) {
          await recordRunError(
            runId,
            err instanceof Error ? err.message : String(err)
          )
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
