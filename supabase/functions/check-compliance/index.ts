import { ForbiddenError, requireUser, UnauthorizedError } from '../_shared/auth.ts'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { assertUnderDailyCap, DailyCapExceededError } from '../_shared/costCap.ts'
import { sendToDlq } from '../_shared/dlq.ts'
import { assertNotPaused, OrchestratorPausedError } from '../_shared/killSwitch.ts'
import { createTrace, recordGeneration } from '../_shared/langfuseClient.ts'
import { runComplianceCheck } from '../_shared/orchestrators/complianceCheck.ts'
import {
  recordRunError,
  recordRunStart,
  recordRunSuccess,
} from '../_shared/recordAiRun.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

const HEALTH_VERTICALS = ['health', 'mental_wellness']

// For health/mental offers, a high/critical compliance risk caps the verdict
// the operator should act on until the issue is cleared.
function suggestedVerdictCap(
  verticalSlug: string | undefined,
  riskLevel: string
): string | null {
  if (!verticalSlug || !HEALTH_VERTICALS.includes(verticalSlug)) return null
  if (riskLevel === 'critical') return 'reject'
  if (riskLevel === 'high') return 'small_paid_test'
  return null
}

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
      .select('id, workspace_id, name, operator_notes, verticals(slug)')
      .eq('id', offerId)
      .single()
    if (offerErr || !offer) return jsonResponse({ error: 'Offer not found' }, 404)

    try {
      await assertNotPaused('ComplianceCheckOrchestrator')
    } catch (err) {
      if (err instanceof OrchestratorPausedError) return jsonResponse({ error: err.message }, 503)
      throw err
    }

    if (offer.workspace_id) {
      try {
        await assertUnderDailyCap(offer.workspace_id)
      } catch (err) {
        if (err instanceof DailyCapExceededError) return jsonResponse({ error: err.message }, 429)
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

    const willCallReal = !!Deno.env.get('ANTHROPIC_API_KEY')
    const model = willCallReal ? 'claude-haiku-4-5-20251001' : 'mock'

    const runId = await recordRunStart({
      orchestratorName: 'ComplianceCheckOrchestrator',
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
          const result = await runComplianceCheck({
            offerId,
            offerName: offer.name,
            verticalSlug,
            facts,
            operatorNotes: offer.operator_notes,
          })

          const payload = result.output as {
            payload?: { overall_risk_level?: string; compliance_score?: number }
          }
          const riskLevel = payload.payload?.overall_risk_level ?? 'low'
          const cap = suggestedVerdictCap(verticalSlug, riskLevel)

          const traceId = await createTrace({
            name: `check-compliance:${offerId}`,
            userId: user.id,
          })
          await recordGeneration({
            traceId,
            name: `ComplianceCheckOrchestrator (${result.mode})`,
            model,
            input: { offer_id: offerId, verified_fact_count: facts.length },
            output: result.output,
            promptTokens: result.usage?.input_tokens ?? 0,
            completionTokens: result.usage?.output_tokens ?? 0,
            costUsd: result.usage?.cost_usd ?? 0,
            startTime,
            endTime: new Date(),
          })

          await admin.from('offer_compliance_warnings').insert({
            offer_id: offerId,
            ai_run_id: runId,
            workspace_id: offer.workspace_id ?? null,
            overall_risk_level: riskLevel,
            compliance_score: payload.payload?.compliance_score ?? null,
            suggested_verdict_cap: cap,
            payload: result.output,
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
          await sendToDlq({
            messageType: 'ai_run',
            payload: { kind: 'check-compliance', offer_id: offerId, ai_run_id: runId },
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
