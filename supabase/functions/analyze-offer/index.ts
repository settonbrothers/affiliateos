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
      .select('id, workspace_id, vertical_id, name, operator_notes, verticals(slug)')
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
        creditHold = await reserveCredits(offer.workspace_id, 'analyze-offer')
      } catch (err) {
        if (err instanceof InsufficientCreditsError) return jsonResponse({ error: err.message }, 402)
        throw err
      }
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

    // Operator context (from onboarding) → feeds operator_fit scoring.
    const { data: op } = await admin
      .from('operator_profiles')
      .select('experience_level, cashflow_tolerance, primary_channels, budget_min_usd, budget_max_usd')
      .eq('user_id', user.id)
      .maybeSingle()
    const userContext = op
      ? {
          experience_level: op.experience_level,
          cashflow_tolerance: op.cashflow_tolerance,
          primary_channels: op.primary_channels ?? [],
          typical_budget_range_usd:
            op.budget_min_usd != null && op.budget_max_usd != null
              ? ([op.budget_min_usd, op.budget_max_usd] as [number, number])
              : null,
        }
      : null

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
    await linkCreditToRun(creditHold, runId)

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
            userContext,
            operatorNotes: offer.operator_notes,
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
          const message = err instanceof Error ? err.message : String(err)
          await recordRunError(runId, message)
          // Refund the reserved credits — we don't charge for failed runs.
          if (offer.workspace_id) {
            await refundCredits(offer.workspace_id, creditHold, 'analyze-offer', runId)
          }
          // Dead-letter so an admin can replay from /admin/failed once the
          // underlying cause (e.g. transient Anthropic 5xx) clears.
          await sendToDlq({
            messageType: 'ai_run',
            payload: { kind: 'analyze-offer', offer_id: offerId, ai_run_id: runId },
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
