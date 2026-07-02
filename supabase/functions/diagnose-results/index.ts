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
import { runDiagnosis } from '../_shared/orchestrators/diagnosis.ts'
import { runDiagnosisV2 } from '../_shared/orchestrators/diagnosisV2.ts'
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

    const body = (await req.json().catch(() => ({}))) as {
      campaign_id?: string
      creative_input?: string
    }
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

    // ── V2 flow: creative input analysis ─────────────────────────────────────
    if (body.creative_input) {
      try {
        await assertNotPaused('DiagnosisV2Orchestrator')
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

      // Fetch optional metrics for context
      const { data: resultsRow } = await admin
        .from('campaign_results')
        .select('clicks, conversions, spend_usd, revenue_usd')
        .eq('campaign_id', campaignId)
        .maybeSingle()

      const metrics = resultsRow
        ? {
            ctr:
              resultsRow.clicks && resultsRow.clicks > 0
                ? undefined
                : undefined,
            cpl_usd:
              resultsRow.spend_usd && resultsRow.conversions && resultsRow.conversions > 0
                ? Number(resultsRow.spend_usd) / Number(resultsRow.conversions)
                : undefined,
            roas:
              resultsRow.spend_usd && Number(resultsRow.spend_usd) > 0 && resultsRow.revenue_usd
                ? Number(resultsRow.revenue_usd) / Number(resultsRow.spend_usd)
                : undefined,
          }
        : undefined

      let creditHold: CreditHold | null = null
      if (campaign.workspace_id) {
        try {
          creditHold = await reserveCredits(campaign.workspace_id, 'diagnose-results')
        } catch (err) {
          if (err instanceof InsufficientCreditsError) return jsonResponse({ error: err.message }, 402)
          throw err
        }
      }

      const willCallReal = !!Deno.env.get('ANTHROPIC_API_KEY')
      const model = willCallReal ? 'claude-sonnet-4-6' : 'mock'

      const runId = await recordRunStart({
        orchestratorName: 'DiagnosisV2Orchestrator',
        agentVersion: willCallReal ? 'real-v1' : 'mock-v1',
        model,
        inputPayload: { campaign_id: campaignId },
        userId: user.id,
        workspaceId: campaign.workspace_id ?? undefined,
        offerId: campaign.offer_id ?? undefined,
      })
      await linkCreditToRun(creditHold, runId)

      // Record the creative input for traceability
      await admin.from('diagnose_creative_inputs').insert({
        campaign_id: campaignId,
        workspace_id: campaign.workspace_id ?? null,
        raw_input: body.creative_input,
        input_type: 'text',
      })

      EdgeRuntime.waitUntil(
        (async () => {
          const startTime = new Date()
          try {
            const result = await runDiagnosisV2({
              campaign: {
                id: campaign.id,
                name: campaign.name,
                channel: campaign.channel,
              },
              rawCreativeInput: body.creative_input!,
              metrics,
            })

            const traceId = await createTrace({
              name: `diagnose-v2:${campaignId}`,
              userId: user.id,
            })
            await recordGeneration({
              traceId,
              name: `DiagnosisV2Orchestrator (${result.mode})`,
              model,
              input: { campaign_id: campaignId },
              output: result.output as unknown as Record<string, unknown>,
              promptTokens: result.usage?.input_tokens ?? 0,
              completionTokens: result.usage?.output_tokens ?? 0,
              costUsd: result.usage?.cost_usd ?? 0,
              startTime,
              endTime: new Date(),
            })

            const winningHooks = result.output.winning_hooks ?? []
            let winnersAddedToLibrary = false

            // Insert winning hooks into copy_hook_library
            if (winningHooks.length > 0) {
              const hooksToInsert = result.output.creative_analysis
                .filter((item) => item.is_winner)
                .map((item) => ({
                  text: item.hook,
                  hook_type: item.hook_type,
                  label: 'good' as const,
                  lang: 'he',
                  vertical: null as string | null,
                }))

              if (hooksToInsert.length > 0) {
                await admin.from('copy_hook_library').insert(hooksToInsert)
                winnersAddedToLibrary = true
              }
            }

            // Save creative_analysis and winning_hooks to result_diagnoses
            // Upsert by campaign_id if a row already exists, otherwise insert
            const { data: existingDiagnosis } = await admin
              .from('result_diagnoses')
              .select('id')
              .eq('campaign_id', campaignId)
              .maybeSingle()

            if (existingDiagnosis) {
              await admin
                .from('result_diagnoses')
                .update({
                  creative_analysis: result.output.creative_analysis as unknown as Record<string, unknown>[],
                  winning_hooks: winningHooks as unknown as string[],
                  winners_added_to_library: winnersAddedToLibrary,
                })
                .eq('id', existingDiagnosis.id)
            } else {
              await admin.from('result_diagnoses').insert({
                campaign_id: campaignId,
                ai_run_id: runId,
                workspace_id: campaign.workspace_id ?? null,
                payload: result.output as unknown as Record<string, unknown>,
                creative_analysis: result.output.creative_analysis as unknown as Record<string, unknown>[],
                winning_hooks: winningHooks as unknown as string[],
                winners_added_to_library: winnersAddedToLibrary,
              })
            }

            await recordRunSuccess(runId, {
              outputPayload: result.output as unknown as Record<string, unknown>,
              validatedOutput: result.output as unknown as Record<string, unknown>,
              envelope: result.output as unknown as Record<string, unknown>,
              tokensInput: result.usage?.input_tokens,
              tokensOutput: result.usage?.output_tokens,
              estimatedCost: result.usage?.cost_usd,
              langfuseTraceId: traceId,
            })
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            await recordRunError(runId, message)
            if (campaign.workspace_id) {
              await refundCredits(campaign.workspace_id, creditHold, 'diagnose-results', runId)
            }
            await sendToDlq({
              messageType: 'ai_run',
              payload: { kind: 'diagnose-results-v2', campaign_id: campaignId, ai_run_id: runId },
              error: message,
            })
          }
        })()
      )

      return jsonResponse({ run_id: runId }, 200)
    }

    // ── V1 flow (existing — unchanged) ───────────────────────────────────────
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

    // Credit guard — reserve after the results gate, before any LLM work.
    let creditHold: CreditHold | null = null
    if (campaign.workspace_id) {
      try {
        creditHold = await reserveCredits(campaign.workspace_id, 'diagnose-results')
      } catch (err) {
        if (err instanceof InsufficientCreditsError) return jsonResponse({ error: err.message }, 402)
        throw err
      }
    }

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
    await linkCreditToRun(creditHold, runId)

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
          if (campaign.workspace_id) {
            await refundCredits(campaign.workspace_id, creditHold, 'diagnose-results', runId)
          }
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
