import {
  ForbiddenError,
  requireAdmin,
  UnauthorizedError,
} from '../_shared/auth.ts'
import { resolveCopyEvalLeanExecutionPolicy } from '../_shared/copyEvalLeanBudget.ts'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { runAdCopy } from '../_shared/orchestrators/adCopy.ts'
import {
  runAdCopyEvidenceAgencyStep,
  type EvidenceAgencyCheckpoint,
} from '../_shared/orchestrators/adCopyEvidence.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'
import { CopyBrainInputSnapshotV1Schema } from '../_shared/types/copyBrain.ts'

type JsonRecord = Record<string, unknown>
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

const asRecord = (value: unknown): JsonRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null

const asVersionMap = (value: unknown): Record<string, string> => {
  const rows = Array.isArray(value) ? value : []
  return Object.fromEntries(
    rows.flatMap((row) => {
      const item = asRecord(row)
      return typeof item?.orchestrator_name === 'string' &&
        typeof item.version === 'string'
        ? [[item.orchestrator_name, item.version]]
        : []
    })
  )
}

const asContentMap = (value: unknown): Record<string, string> => {
  const rows = Array.isArray(value) ? value : []
  return Object.fromEntries(
    rows.flatMap((row) => {
      const item = asRecord(row)
      return typeof item?.orchestrator_name === 'string' &&
        typeof item.content === 'string'
        ? [[item.orchestrator_name, item.content]]
        : []
    })
  )
}

const extractDecision = (output: JsonRecord) => {
  const payload = asRecord(output.payload)
  const license = asRecord(payload?.narrative_license)
  const judge = asRecord(payload?.judge)
  const killFlags = Array.isArray(judge?.kill_flags)
    ? judge.kill_flags.filter(
        (value): value is string => typeof value === 'string'
      )
    : []
  return {
    modeDecision:
      typeof license?.mode === 'string'
        ? license.mode
        : 'legacy_story_unspecified',
    truthViolation: killFlags.some((flag) =>
      ['fake_testimonial', 'claim_violation', 'vulnerability_stack'].includes(
        flag
      )
    ),
    judgePublishable:
      typeof judge?.overall === 'string' ? judge.overall === 'pass' : null,
    killFlags,
  }
}

class CopyEvalClaimPausedError extends Error {
  constructor(
    public readonly reason:
      | 'lean_not_armed'
      | 'lean_policy_invalid'
      | 'lean_budget_boundary'
  ) {
    super(reason)
    this.name = 'CopyEvalClaimPausedError'
  }
}

async function claimJob(runId: string) {
  const admin = getAdminClient()
  const now = new Date().toISOString()
  const [
    { data: evalRun, error: runError },
    { data: costs, error: costsError },
    { count: activeCount, error: activeError },
  ] = await Promise.all([
    admin.from('copy_eval_runs').select('metrics').eq('id', runId).single(),
    admin.from('copy_eval_jobs').select('cost_usd').eq('eval_run_id', runId),
    admin
      .from('copy_eval_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('eval_run_id', runId)
      .eq('status', 'running')
      .gt('lease_expires_at', now),
  ])
  if (runError) throw runError
  if (costsError) throw costsError
  if (activeError) throw activeError
  const recordedCostUsd = (costs ?? []).reduce(
    (sum, row) => sum + Number(row.cost_usd ?? 0),
    0
  )
  const executionPolicy = resolveCopyEvalLeanExecutionPolicy({
    metrics: evalRun.metrics,
    recordedCostUsd,
    activeJobs: activeCount ?? 0,
  })
  if (executionPolicy.mode === 'disabled') {
    throw new CopyEvalClaimPausedError(
      executionPolicy.reason === 'invalid_policy'
        ? 'lean_policy_invalid'
        : 'lean_not_armed'
    )
  }
  if (executionPolicy.mode === 'lean' && !executionPolicy.canClaim) {
    if (executionPolicy.reason === 'budget_boundary')
      throw new CopyEvalClaimPausedError('lean_budget_boundary')
    return null
  }
  const concurrencyLimit = executionPolicy.mode === 'lean' ? 1 : 2
  if ((activeCount ?? 0) >= concurrencyLimit) return null
  const selectedJobIds =
    executionPolicy.mode === 'lean' ? executionPolicy.selectedJobIds : null
  const jobFields =
    'id,eval_run_id,case_id,engine,repetition,status,attempt_count,lease_expires_at,internal_trace,tokens_input,tokens_output,cost_usd'
  let expiredQuery = admin
    .from('copy_eval_jobs')
    .select(jobFields)
    .eq('status', 'running')
    .lt('lease_expires_at', new Date().toISOString())
    .order('lease_expires_at', { ascending: true })
    .limit(1)
    .eq('eval_run_id', runId)
  if (selectedJobIds) expiredQuery = expiredQuery.in('id', selectedJobIds)
  const { data: expired, error: expiredError } = await expiredQuery
  if (expiredError) throw expiredError
  let candidate = expired?.[0]
  let reclaiming = Boolean(candidate)
  if (!candidate) {
    let query = admin
      .from('copy_eval_jobs')
      .select(jobFields)
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .eq('eval_run_id', runId)
    if (selectedJobIds) query = query.in('id', selectedJobIds)
    const { data: candidates, error } = await query
    if (error) throw error
    candidate = candidates?.[0]
    reclaiming = false
  }
  if (!candidate) return null

  const lease = new Date(Date.now() + 10 * 60_000).toISOString()
  const { data: claimed, error: claimError } = await admin
    .from('copy_eval_jobs')
    .update({
      status: 'running',
      attempt_count: Number(candidate.attempt_count ?? 0) + 1,
      lease_expires_at: lease,
      started_at: new Date().toISOString(),
      error_message: null,
    })
    .eq('id', candidate.id)
    .eq('status', reclaiming ? 'running' : 'queued')
    .match(reclaiming ? { lease_expires_at: candidate.lease_expires_at } : {})
    .select(`${jobFields},started_at`)
    .maybeSingle()
  if (claimError) throw claimError
  if (claimed) {
    const { count: activeCount, error: activeError } = await admin
      .from('copy_eval_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('eval_run_id', runId)
      .eq('status', 'running')
      .gt('lease_expires_at', new Date().toISOString())
    if (activeError) throw activeError
    if ((activeCount ?? 0) > concurrencyLimit) {
      const { error: releaseError } = await admin
        .from('copy_eval_jobs')
        .update({
          status: 'queued',
          lease_expires_at: null,
          started_at: null,
        })
        .eq('id', claimed.id)
        .eq('status', 'running')
        .eq('lease_expires_at', claimed.lease_expires_at)
      if (releaseError) throw releaseError
      return null
    }
  }
  return claimed
}

async function runClaimedJob(
  job: NonNullable<Awaited<ReturnType<typeof claimJob>>>
) {
  const admin = getAdminClient()
  const [
    { data: evalCase, error: caseError },
    { data: evalRun, error: runError },
  ] = await Promise.all([
    admin
      .from('copy_eval_cases')
      .select('input_snapshot,sealed_sha256')
      .eq('id', job.case_id)
      .single(),
    admin
      .from('copy_eval_runs')
      .select('metrics,prompt_manifest_sha256,model_id')
      .eq('id', job.eval_run_id)
      .single(),
  ])
  if (caseError) throw caseError
  if (runError) throw runError
  const snapshot = CopyBrainInputSnapshotV1Schema.parse(evalCase.input_snapshot)
  if (snapshot.snapshot_sha256 !== evalCase.sealed_sha256) {
    throw new Error('Sealed input checksum drift detected')
  }
  const metrics = asRecord(evalRun.metrics) ?? {}
  const runtimeModel = Deno.env.get('AD_COPY_MODEL') ?? 'claude-sonnet-4-6'
  const runtimeJudgeModel = Deno.env.get('AD_COPY_JUDGE_MODEL') ?? runtimeModel
  if (
    runtimeModel !== evalRun.model_id ||
    runtimeJudgeModel !== evalRun.model_id
  ) {
    throw new Error(
      `Frozen eval model ${evalRun.model_id} does not match runtime ${runtimeModel}/${runtimeJudgeModel}`
    )
  }
  const promptVersions =
    job.engine === 'copy_brain_candidate'
      ? asVersionMap(metrics.candidate_prompts)
      : asVersionMap(
          asRecord(metrics.baseline_prompts_by_case)?.[String(job.case_id)]
        )
  const frozenPromptRows =
    job.engine === 'copy_brain_candidate'
      ? metrics.candidate_prompts
      : asRecord(metrics.baseline_prompts_by_case)?.[String(job.case_id)]
  const promptContents = asContentMap(frozenPromptRows)
  if (Object.keys(promptVersions).length === 0) {
    throw new Error(`Frozen prompt versions missing for ${job.engine}`)
  }
  if (
    Object.keys(promptContents).length !== Object.keys(promptVersions).length
  ) {
    throw new Error(`Frozen prompt content missing for ${job.engine}`)
  }

  const started = performance.now()
  const adCopyInput: Parameters<typeof runAdCopy>[0] = {
    offer: {
      id: snapshot.offer.id,
      name: snapshot.offer.name,
      url: snapshot.offer.website_url,
      vertical: snapshot.offer.vertical,
      description: snapshot.offer.description,
    },
    productContext: {
      underwriting: snapshot.underwriting,
      compliance: snapshot.compliance,
      sources: snapshot.sources,
    },
    testKit: snapshot.test_kit,
    corpus: snapshot.taste_corpus as never[],
    hookLibrary: snapshot.hook_library as never[],
    verticalSlug: snapshot.offer.vertical ?? undefined,
    deepBriefContext: snapshot.deep_brief,
    avatarContext: snapshot.avatar as unknown as JsonRecord | null,
    spyContext: {
      analyses: snapshot.spy_analyses,
      market_examples: snapshot.market_examples,
    },
    creativeHint: snapshot.creative_hint,
    campaignContext: {
      channel: snapshot.campaign_context.channel,
      geo: snapshot.campaign_context.geo.join(','),
      audience: snapshot.campaign_context.audience,
    },
    brainSnapshot: snapshot,
    engineOverride:
      job.engine === 'copy_brain_candidate' ? 'candidate' : 'baseline',
    promptVersions,
    promptContents,
  }
  let result: Awaited<ReturnType<typeof runAdCopy>>
  const storedTrace = asRecord(job.internal_trace)
  if (job.engine === 'copy_brain_candidate') {
    const step = await runAdCopyEvidenceAgencyStep(
      adCopyInput,
      (storedTrace?.candidate_checkpoint as EvidenceAgencyCheckpoint | null) ??
        null
    )
    if (!step.done) {
      const { error: checkpointError } = await admin
        .from('copy_eval_jobs')
        .update({
          status: 'queued',
          internal_trace: {
            ...(storedTrace ?? {}),
            candidate_checkpoint: step.checkpoint,
            candidate_latency_ms:
              Number(storedTrace?.candidate_latency_ms ?? 0) +
              Math.round(performance.now() - started),
            prompt_versions: promptVersions,
            input_snapshot_sha256: snapshot.snapshot_sha256,
          },
          tokens_input: step.checkpoint.total.input_tokens,
          tokens_output: step.checkpoint.total.output_tokens,
          cost_usd: step.checkpoint.total.cost_usd,
          lease_expires_at: null,
          error_message: null,
        })
        .eq('id', job.id)
        .eq('status', 'running')
      if (checkpointError) throw checkpointError
      return
    }
    result = step
  } else {
    result = await runAdCopy(adCopyInput)
  }
  const output = result.output as JsonRecord
  const decision = extractDecision(output)
  const latencyMs =
    Math.round(performance.now() - started) +
    (job.engine === 'copy_brain_candidate'
      ? Number(storedTrace?.candidate_latency_ms ?? 0)
      : 0)
  const { error: updateError } = await admin
    .from('copy_eval_jobs')
    .update({
      status: 'completed',
      output_payload: output,
      internal_trace: {
        prompt_versions: promptVersions,
        input_snapshot_sha256: snapshot.snapshot_sha256,
        kill_flags: decision.killFlags,
        consumed_sections:
          job.engine === 'copy_brain_candidate'
            ? [
                'offer',
                'campaign_context',
                'underwriting',
                'compliance',
                'sources',
                'research_documents_summary',
                'deep_brief',
                'spy_analyses',
                'market_examples',
                'performance_winners',
                'avatar',
                'test_kit',
                'taste_corpus',
                'hook_library',
                'creative_hint',
              ]
            : [
                'offer',
                'underwriting',
                'compliance',
                'sources',
                'deep_brief',
                'spy_latest',
                'avatar',
                'test_kit',
                'taste_corpus',
                'hook_library',
              ],
        context_omissions: snapshot.omitted_context,
      },
      mode_decision: decision.modeDecision,
      truth_violation: decision.truthViolation,
      judge_publishable: decision.judgePublishable,
      tokens_input: result.usage?.input_tokens ?? 0,
      tokens_output: result.usage?.output_tokens ?? 0,
      cost_usd: result.usage?.cost_usd ?? 0,
      latency_ms: latencyMs,
      lease_expires_at: null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', job.id)
    .eq('status', 'running')
  if (updateError) throw updateError
  const { count: completeCount } = await admin
    .from('copy_eval_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('eval_run_id', job.eval_run_id)
    .eq('status', 'completed')
  if (completeCount === 48) {
    const { data: costs } = await admin
      .from('copy_eval_jobs')
      .select('cost_usd')
      .eq('eval_run_id', job.eval_run_id)
    const totalCost = (costs ?? []).reduce(
      (sum, item) => sum + Number(item.cost_usd ?? 0),
      0
    )
    await admin
      .from('copy_eval_runs')
      .update({ status: 'calibration_ready', total_cost_usd: totalCost })
      .eq('id', job.eval_run_id)
  }
}

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req)
  if (preflight) return preflight
  let claimed: Awaited<ReturnType<typeof claimJob>> = null
  try {
    await requireAdmin(req)
    const body = (await req.json().catch(() => ({}))) as {
      eval_run_id?: string
    }
    if (!body.eval_run_id)
      return jsonResponse({ error: 'eval_run_id is required' }, 400)
    claimed = await claimJob(body.eval_run_id)
    if (!claimed) {
      let pendingQuery = getAdminClient()
        .from('copy_eval_jobs')
        .select('id', { count: 'exact', head: true })
        .in('status', ['queued', 'running'])
      if (body.eval_run_id)
        pendingQuery = pendingQuery.eq('eval_run_id', body.eval_run_id)
      const { count } = await pendingQuery
      return jsonResponse({
        claimed: false,
        pending: count ?? 0,
        reason: (count ?? 0) > 0 ? 'concurrency_limit' : 'no_queued_jobs',
      })
    }
    EdgeRuntime.waitUntil(
      runClaimedJob(claimed).catch(async (error) => {
        await getAdminClient()
          .from('copy_eval_jobs')
          .update({
            status: 'failed',
            lease_expires_at: null,
            error_message:
              error instanceof Error ? error.message : String(error),
            completed_at: new Date().toISOString(),
          })
          .eq('id', claimed!.id)
      })
    )
    return jsonResponse(
      { claimed: true, job_id: claimed.id, completed: false },
      202
    )
  } catch (error) {
    if (claimed) {
      await getAdminClient()
        .from('copy_eval_jobs')
        .update({
          status: 'failed',
          lease_expires_at: null,
          error_message: error instanceof Error ? error.message : String(error),
          completed_at: new Date().toISOString(),
        })
        .eq('id', claimed.id)
    }
    if (error instanceof UnauthorizedError)
      return jsonResponse({ error: error.message }, 401)
    if (error instanceof ForbiddenError)
      return jsonResponse({ error: error.message }, 403)
    if (error instanceof CopyEvalClaimPausedError) {
      return jsonResponse({ claimed: false, pending: 0, reason: error.reason })
    }
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Internal error' },
      500
    )
  }
})
