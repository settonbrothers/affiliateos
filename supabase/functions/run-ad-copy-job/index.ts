import { ForbiddenError, UnauthorizedError } from '../_shared/auth.ts'
import { AnthropicValidationError } from '../_shared/anthropicJson.ts'
import { invokeSelf, requireAdminOrCron } from '../_shared/backgroundWork.ts'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { refundCredits, type CreditHold } from '../_shared/credits.ts'
import { sendToDlq } from '../_shared/dlq.ts'
import { createTrace, recordGeneration } from '../_shared/langfuseClient.ts'
import type { AdCopyInput } from '../_shared/orchestrators/adCopy.ts'
import {
  runAdCopyEvidenceAgencyStep,
  type EvidenceAgencyCheckpoint,
} from '../_shared/orchestrators/adCopyEvidence.ts'
import { recordRunError, recordRunSuccess } from '../_shared/recordAiRun.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

const ACTION = 'generate-ad-copy'
const ORCHESTRATOR = 'AdCopyOrchestrator'
const LEASE_MS = 4 * 60 * 1_000

type JobPayload = {
  ad_copy_input: AdCopyInput
  template: string | null
  creative_hint: string | null
  model: string
  corpus_example_count: number
  prompt_bundle_sha256: string | null
}

type AdCopyJob = {
  id: string
  ai_run_id: string
  offer_id: string
  workspace_id: string | null
  user_id: string | null
  status: 'queued' | 'running' | 'completed' | 'failed'
  input_payload: JobPayload
  checkpoint: EvidenceAgencyCheckpoint | null
  credit_hold: CreditHold | null
  attempt_count: number
  lease_expires_at: string | null
  refunded_at: string | null
  created_at: string
}

async function claimJob(jobId: string): Promise<AdCopyJob | null> {
  const admin = getAdminClient()
  const { data: current, error } = await admin
    .from('ad_copy_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle()
  if (error) throw error
  if (!current || ['completed', 'failed'].includes(current.status)) return null

  const leaseExpired =
    !current.lease_expires_at ||
    new Date(current.lease_expires_at).getTime() <= Date.now()
  if (current.status === 'running' && !leaseExpired) return null

  const now = new Date()
  const { data: claimed, error: claimError } = await admin
    .from('ad_copy_jobs')
    .update({
      status: 'running',
      attempt_count: Number(current.attempt_count ?? 0) + 1,
      lease_expires_at: new Date(now.getTime() + LEASE_MS).toISOString(),
      started_at: current.started_at ?? now.toISOString(),
      updated_at: now.toISOString(),
      error_message: null,
    })
    .eq('id', jobId)
    .eq('status', current.status)
    .select('*')
    .maybeSingle()
  if (claimError) throw claimError
  return (claimed as AdCopyJob | null) ?? null
}

async function markFailed(job: AdCopyJob, error: unknown): Promise<void> {
  const admin = getAdminClient()
  const message = error instanceof Error ? error.message : String(error)
  const failedAt = new Date().toISOString()
  const { data: transitioned } = await admin
    .from('ad_copy_jobs')
    .update({
      status: 'failed',
      error_message: message,
      lease_expires_at: null,
      completed_at: failedAt,
      updated_at: failedAt,
    })
    .eq('id', job.id)
    .in('status', ['queued', 'running'])
    .select('id')
    .maybeSingle()
  if (!transitioned) return

  await recordRunError(job.ai_run_id, message)
  if (job.workspace_id && !job.refunded_at) {
    await refundCredits(
      job.workspace_id,
      job.credit_hold,
      ACTION,
      job.ai_run_id
    )
    await admin
      .from('ad_copy_jobs')
      .update({ refunded_at: failedAt, updated_at: failedAt })
      .eq('id', job.id)
  }
  await sendToDlq({
    messageType: 'ai_run',
    payload: {
      kind: ACTION,
      offer_id: job.offer_id,
      ai_run_id: job.ai_run_id,
      ad_copy_job_id: job.id,
    },
    error: message,
  })
}

async function persistCompleted(
  job: AdCopyJob,
  result: {
    output: Record<string, unknown>
    usage: { input_tokens: number; output_tokens: number; cost_usd: number }
    mode: 'real'
  }
): Promise<void> {
  const admin = getAdminClient()
  const payload = job.input_payload
  const startTime = new Date(job.created_at)
  const traceId = await createTrace({
    name: `generate-ad-copy:${job.offer_id}`,
    userId: job.user_id ?? undefined,
  })
  await recordGeneration({
    traceId,
    name: `${ORCHESTRATOR} (${result.mode})`,
    model: payload.model,
    input: {
      offer_id: job.offer_id,
      corpus_example_count: payload.corpus_example_count,
      prompt_bundle_sha256: payload.prompt_bundle_sha256,
    },
    output: result.output,
    promptTokens: result.usage.input_tokens,
    completionTokens: result.usage.output_tokens,
    costUsd: result.usage.cost_usd,
    startTime,
    endTime: new Date(),
  })

  const evidencePayload = (
    result.output as {
      payload?: {
        engine_version?: string
        output_status?: string
        evidence_envelope?: { sources?: Array<Record<string, unknown>> }
      }
    }
  ).payload
  const { data: existingGeneration } = await admin
    .from('ad_copy_generations')
    .select('id')
    .eq('ai_run_id', job.ai_run_id)
    .maybeSingle()
  if (!existingGeneration) {
    const { error: generationError } = await admin
      .from('ad_copy_generations')
      .insert({
        offer_id: job.offer_id,
        workspace_id: job.workspace_id,
        created_by_user_id: job.user_id,
        ai_run_id: job.ai_run_id,
        payload: result.output,
        status: 'generated',
        template: payload.template,
        engine_version: evidencePayload?.engine_version ?? 'legacy-v2',
        output_status: evidencePayload?.output_status ?? null,
        creative_hint: payload.creative_hint,
      })
    if (generationError) throw generationError
  }

  const evidenceSources = evidencePayload?.evidence_envelope?.sources ?? []
  if (evidenceSources.length > 0) {
    const { error: sourceError } = await admin
      .from('copy_source_snapshots')
      .upsert(
        evidenceSources.map((source) => ({
          offer_id: job.offer_id,
          workspace_id: job.workspace_id,
          source_id: String(source.source_id),
          publisher_id: String(source.publisher_id),
          source_url:
            typeof source.source_url === 'string' ? source.source_url : null,
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
    if (sourceError) throw sourceError
  }

  await recordRunSuccess(job.ai_run_id, {
    outputPayload: result.output,
    validatedOutput: result.output,
    envelope: result.output,
    tokensInput: result.usage.input_tokens,
    tokensOutput: result.usage.output_tokens,
    estimatedCost: result.usage.cost_usd,
    langfuseTraceId: traceId,
  })
  const completedAt = new Date().toISOString()
  const { error: completionError } = await admin
    .from('ad_copy_jobs')
    .update({
      status: 'completed',
      checkpoint: null,
      tokens_input: result.usage.input_tokens,
      tokens_output: result.usage.output_tokens,
      cost_usd: result.usage.cost_usd,
      lease_expires_at: null,
      completed_at: completedAt,
      updated_at: completedAt,
    })
    .eq('id', job.id)
    .eq('status', 'running')
  if (completionError) throw completionError
}

async function runClaimedJob(job: AdCopyJob): Promise<void> {
  try {
    const step = await runAdCopyEvidenceAgencyStep(
      job.input_payload.ad_copy_input,
      job.checkpoint
    )
    if (step.done) {
      await persistCompleted(job, step)
      return
    }

    const now = new Date().toISOString()
    const { error: checkpointError } = await getAdminClient()
      .from('ad_copy_jobs')
      .update({
        status: 'queued',
        checkpoint: step.checkpoint,
        tokens_input: step.checkpoint.total.input_tokens,
        tokens_output: step.checkpoint.total.output_tokens,
        cost_usd: step.checkpoint.total.cost_usd,
        lease_expires_at: null,
        updated_at: now,
      })
      .eq('id', job.id)
      .eq('status', 'running')
    if (checkpointError) throw checkpointError

    await getAdminClient()
      .from('ai_runs')
      .update({
        envelope: {
          job_status: 'running',
          stage: step.checkpoint.stage,
          attempts: job.attempt_count,
        },
        tokens_input: step.checkpoint.total.input_tokens,
        tokens_output: step.checkpoint.total.output_tokens,
        estimated_cost: step.checkpoint.total.cost_usd,
      })
      .eq('id', job.ai_run_id)

    const handedOff = await invokeSelf('run-ad-copy-job', { job_id: job.id })
    if (!handedOff) {
      throw new Error('Could not hand off ad-copy job to a fresh Edge runtime')
    }
  } catch (error) {
    if (error instanceof AnthropicValidationError) {
      const previous = job.checkpoint?.total ?? {
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
      }
      const failedUsage = {
        input_tokens: previous.input_tokens + error.usage.input_tokens,
        output_tokens: previous.output_tokens + error.usage.output_tokens,
        cost_usd: previous.cost_usd + error.costUsd,
      }
      await getAdminClient()
        .from('ad_copy_jobs')
        .update({
          tokens_input: failedUsage.input_tokens,
          tokens_output: failedUsage.output_tokens,
          cost_usd: failedUsage.cost_usd,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
      await getAdminClient()
        .from('ai_runs')
        .update({
          tokens_input: failedUsage.input_tokens,
          tokens_output: failedUsage.output_tokens,
          estimated_cost: failedUsage.cost_usd,
        })
        .eq('id', job.ai_run_id)
    }
    await markFailed(job, error)
  }
}

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req)
  if (preflight) return preflight
  try {
    await requireAdminOrCron(req)
    const body = (await req.json().catch(() => ({}))) as { job_id?: string }
    if (!body.job_id) return jsonResponse({ error: 'job_id is required' }, 400)

    const job = await claimJob(body.job_id)
    if (!job) {
      return jsonResponse(
        { claimed: false, job_id: body.job_id, reason: 'busy_or_terminal' },
        200
      )
    }
    EdgeRuntime.waitUntil(runClaimedJob(job))
    return jsonResponse({ claimed: true, job_id: job.id }, 202)
  } catch (error) {
    if (error instanceof UnauthorizedError)
      return jsonResponse({ error: error.message }, 401)
    if (error instanceof ForbiddenError)
      return jsonResponse({ error: error.message }, 403)
    return jsonResponse(
      { error: error instanceof Error ? error.message : String(error) },
      500
    )
  }
})
