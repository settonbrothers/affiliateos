import { ForbiddenError, requireUser, UnauthorizedError } from '../_shared/auth.ts'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { assertUnderDailyCap, DailyCapExceededError } from '../_shared/costCap.ts'
import { sendToDlq } from '../_shared/dlq.ts'
import { assertNotPaused, OrchestratorPausedError } from '../_shared/killSwitch.ts'
import { createTrace, recordGeneration } from '../_shared/langfuseClient.ts'
import { judgeOutput } from '../_shared/llmJudge.ts'
import { runDiagnosis } from '../_shared/orchestrators/diagnosis.ts'
import {
  recordRunError,
  recordRunStart,
  recordRunSuccess,
} from '../_shared/recordAiRun.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

// Cheap heuristic: confidence grows with click + conversion volume.
function dataQualityScore(clicks: number, conversions: number): number {
  const clickPart = (Math.min(clicks, 200) / 200) * 60
  const convPart = (Math.min(conversions, 20) / 20) * 40
  return Math.round(clickPart + convPart)
}

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req)
  if (preflight) return preflight

  try {
    const user = await requireUser(req)

    const body = (await req.json().catch(() => ({}))) as { campaign_id?: string }
    const campaignId = body.campaign_id
    if (!campaignId) return jsonResponse({ error: 'campaign_id is required' }, 400)

    const admin = getAdminClient()
    const { data: campaign, error: cErr } = await admin
      .from('campaigns')
      .select(
        'id, offer_id, test_kit_id, workspace_id, name, channel, geo, offers(verticals(slug))'
      )
      .eq('id', campaignId)
      .single()
    if (cErr || !campaign) return jsonResponse({ error: 'Campaign not found' }, 404)

    try {
      await assertNotPaused('DiagnosisOrchestrator')
    } catch (err) {
      if (err instanceof OrchestratorPausedError) return jsonResponse({ error: err.message }, 503)
      throw err
    }

    if (campaign.workspace_id) {
      try {
        await assertUnderDailyCap(campaign.workspace_id)
      } catch (err) {
        if (err instanceof DailyCapExceededError) return jsonResponse({ error: err.message }, 429)
        throw err
      }
    }

    const { data: resultsRow } = await admin
      .from('campaign_results')
      .select(
        'spend_usd, impressions, clicks, landing_views, conversions, revenue_usd, days_running'
      )
      .eq('campaign_id', campaignId)
      .maybeSingle()
    if (!resultsRow) {
      return jsonResponse({ error: 'Enter campaign results first.' }, 400)
    }
    const results = {
      spend_usd: Number(resultsRow.spend_usd ?? 0),
      impressions: Number(resultsRow.impressions ?? 0),
      clicks: Number(resultsRow.clicks ?? 0),
      landing_views: Number(resultsRow.landing_views ?? 0),
      conversions: Number(resultsRow.conversions ?? 0),
      revenue_usd: Number(resultsRow.revenue_usd ?? 0),
      days_running: Number(resultsRow.days_running ?? 0),
    }

    let testKit: Record<string, unknown> | null = null
    if (campaign.test_kit_id) {
      const { data: tk } = await admin
        .from('test_kits')
        .select('payload')
        .eq('id', campaign.test_kit_id)
        .maybeSingle()
      testKit = (tk?.payload as Record<string, unknown> | undefined) ?? null
    }

    const verticalSlug =
      (campaign as unknown as { offers?: { verticals?: { slug: string } | null } | null })
        .offers?.verticals?.slug ?? undefined

    const dq = dataQualityScore(results.clicks, results.conversions)
    const willCallReal = !!Deno.env.get('ANTHROPIC_API_KEY')
    const model = willCallReal ? 'claude-sonnet-4-6' : 'mock'

    const runId = await recordRunStart({
      orchestratorName: 'DiagnosisOrchestrator',
      agentVersion: willCallReal ? 'real-v1' : 'mock-v1',
      model,
      inputPayload: {
        campaign_id: campaignId,
        data_quality_score: dq,
        vertical: verticalSlug ?? null,
      },
      userId: user.id,
      workspaceId: campaign.workspace_id ?? undefined,
      offerId: campaign.offer_id ?? undefined,
    })

    EdgeRuntime.waitUntil(
      (async () => {
        const startTime = new Date()
        try {
          const result = await runDiagnosis({
            campaign: {
              id: campaign.id,
              name: campaign.name,
              channel: campaign.channel,
              geo: campaign.geo,
            },
            verticalSlug,
            testKit,
            results,
            dataQualityScore: dq,
          })

          const judgement =
            result.mode === 'real'
              ? await judgeOutput({
                  aiRunId: runId,
                  orchestratorName: 'DiagnosisOrchestrator',
                  userInput: JSON.stringify({ campaign_id: campaignId, results }, null, 2),
                  agentOutput: result.output,
                })
              : null

          const traceId = await createTrace({
            name: `diagnose-results:${campaignId}`,
            userId: user.id,
          })
          await recordGeneration({
            traceId,
            name: `DiagnosisOrchestrator (${result.mode})`,
            model,
            input: { campaign_id: campaignId, data_quality_score: dq },
            output: result.output,
            promptTokens: result.usage?.input_tokens ?? 0,
            completionTokens: result.usage?.output_tokens ?? 0,
            costUsd: result.usage?.cost_usd ?? 0,
            startTime,
            endTime: new Date(),
          })

          const totalCostUsd =
            (result.usage?.cost_usd ?? 0) + (judgement?.judge_cost_usd ?? 0)

          await admin.from('result_diagnoses').insert({
            campaign_id: campaignId,
            ai_run_id: runId,
            workspace_id: campaign.workspace_id ?? null,
            payload: result.output,
          })
          await admin
            .from('campaigns')
            .update({ status: 'diagnosed', updated_at: new Date().toISOString() })
            .eq('id', campaignId)

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
          await sendToDlq({
            messageType: 'ai_run',
            payload: { kind: 'diagnose-results', campaign_id: campaignId, ai_run_id: runId },
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
