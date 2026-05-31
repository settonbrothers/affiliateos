import { ForbiddenError, requireUser, UnauthorizedError } from '../_shared/auth.ts'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { assertNotPaused, OrchestratorPausedError } from '../_shared/killSwitch.ts'
import { createTrace, recordGeneration } from '../_shared/langfuseClient.ts'
import { judgeOutput } from '../_shared/llmJudge.ts'
import { runUnderwriting } from '../_shared/orchestrators/underwriting.ts'
import {
  recordRunError,
  recordRunStart,
  recordRunSuccess,
} from '../_shared/recordAiRun.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

const MOCK_LATENCY_MS = 8_000

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
      .select('id, workspace_id, vertical_id, name, verticals(slug)')
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

    const { data: factsRows } = await admin
      .from('extracted_facts')
      .select('fact_type, fact_value, source_quote, confidence_score')
      .eq('offer_id', offerId)
      .eq('status', 'verified')
    const facts = factsRows ?? []

    const verticalSlug =
      (offer as unknown as { verticals?: { slug: string } | null }).verticals?.slug ??
      undefined

    const willCallReal = !!Deno.env.get('ANTHROPIC_API_KEY')
    const model = willCallReal ? 'claude-sonnet-4-6' : 'mock'

    const runId = await recordRunStart({
      orchestratorName: 'UnderwritingOrchestrator',
      agentVersion: willCallReal ? 'real-v1' : 'mock-v1',
      model,
      inputPayload: {
        offer_id: offerId,
        verified_fact_count: facts.length,
        vertical: verticalSlug ?? null,
      },
      userId: user.id,
      workspaceId: offer.workspace_id ?? undefined,
      offerId,
    })

    EdgeRuntime.waitUntil(
      (async () => {
        const startTime = new Date()
        try {
          // Mock path keeps the 8s latency so UI Realtime / polling exercises
          // its loading state. Real path doesn't need the extra sleep.
          if (!willCallReal) {
            await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))
          }

          const result = await runUnderwriting({
            offerId,
            offerName: offer.name,
            verticalSlug,
            facts,
          })

          // Judge runs only when real LLM produced the output — mock fixtures
          // are presumed safe. Degrade-open: judge failures don't disrupt
          // the user flow (see _shared/llmJudge.ts).
          const judgement =
            result.mode === 'real'
              ? await judgeOutput({
                  aiRunId: runId,
                  orchestratorName: 'UnderwritingOrchestrator',
                  userInput: JSON.stringify(
                    { offer_id: offerId, verified_fact_count: facts.length },
                    null,
                    2
                  ),
                  agentOutput: result.output,
                })
              : null

          const traceId = await createTrace({
            name: `analyze-offer:${offerId}`,
            userId: user.id,
          })
          await recordGeneration({
            traceId,
            name: `UnderwritingOrchestrator (${result.mode})`,
            model,
            input: { offer_id: offerId, verified_fact_count: facts.length },
            output: result.output,
            promptTokens: result.usage?.input_tokens ?? 0,
            completionTokens: result.usage?.output_tokens ?? 0,
            costUsd: result.usage?.cost_usd ?? 0,
            startTime,
            endTime: new Date(),
          })

          const totalCostUsd =
            (result.usage?.cost_usd ?? 0) + (judgement?.judge_cost_usd ?? 0)

          await recordRunSuccess(runId, {
            outputPayload: result.output,
            validatedOutput: result.output,
            envelope: result.output,
            tokensInput: result.usage?.input_tokens,
            tokensOutput: result.usage?.output_tokens,
            estimatedCost: totalCostUsd,
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
