type JsonRecord = Record<string, unknown>

export type CopyEvalLeanResumeState = {
  status: 'planned' | 'armed' | 'paused_budget' | 'complete'
  selectedJobIds: string[]
  baselineRecordedCostUsd: number
  maxAdditionalCostUsd: number
  minimumRemainingUsdPerClaim: number
}

export type CopyEvalLeanExecutionPolicy =
  | { mode: 'full' }
  | {
      mode: 'disabled'
      reason: 'not_armed' | 'invalid_policy'
    }
  | {
      mode: 'lean'
      selectedJobIds: string[]
      spentAdditionalUsd: number
      remainingUsd: number
      minimumRemainingUsdPerClaim: number
      canClaim: boolean
      reason: 'ready' | 'active_job' | 'budget_boundary'
    }

const asRecord = (value: unknown): JsonRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null

const finiteNonNegative = (value: unknown): number | null => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

const roundUsd = (value: number): number => Number(value.toFixed(6))

/**
 * An absent lean_resume object means the original 48-job protocol. Once a
 * lean plan exists, every non-armed state is fail-closed so a generic worker
 * invocation cannot accidentally restart it.
 */
export function parseCopyEvalLeanResumeState(
  metrics: unknown
): CopyEvalLeanResumeState | null | 'invalid' {
  const root = asRecord(metrics)
  if (!root || !Object.prototype.hasOwnProperty.call(root, 'lean_resume'))
    return null
  const raw = asRecord(root.lean_resume)
  if (!raw) return 'invalid'
  if (
    raw.status !== 'planned' &&
    raw.status !== 'armed' &&
    raw.status !== 'paused_budget' &&
    raw.status !== 'complete'
  )
    return 'invalid'
  const selectedJobIds = Array.isArray(raw.selected_job_ids)
    ? [...new Set(raw.selected_job_ids)].filter(
        (value): value is string =>
          typeof value === 'string' && value.length > 0
      )
    : []
  const baselineRecordedCostUsd = finiteNonNegative(
    raw.baseline_recorded_cost_usd
  )
  const maxAdditionalCostUsd = finiteNonNegative(raw.max_additional_cost_usd)
  const minimumRemainingUsdPerClaim = finiteNonNegative(
    raw.minimum_remaining_usd_per_claim
  )
  if (
    selectedJobIds.length === 0 ||
    baselineRecordedCostUsd === null ||
    maxAdditionalCostUsd === null ||
    maxAdditionalCostUsd === 0 ||
    minimumRemainingUsdPerClaim === null ||
    minimumRemainingUsdPerClaim === 0
  )
    return 'invalid'
  return {
    status: raw.status,
    selectedJobIds,
    baselineRecordedCostUsd,
    maxAdditionalCostUsd,
    minimumRemainingUsdPerClaim,
  }
}

export function resolveCopyEvalLeanExecutionPolicy({
  metrics,
  recordedCostUsd,
  activeJobs,
}: {
  metrics: unknown
  recordedCostUsd: number
  activeJobs: number
}): CopyEvalLeanExecutionPolicy {
  const state = parseCopyEvalLeanResumeState(metrics)
  if (state === null) return { mode: 'full' }
  if (state === 'invalid') return { mode: 'disabled', reason: 'invalid_policy' }
  if (state.status !== 'armed') return { mode: 'disabled', reason: 'not_armed' }

  const spentAdditionalUsd = roundUsd(
    Math.max(0, recordedCostUsd - state.baselineRecordedCostUsd)
  )
  const remainingUsd = roundUsd(
    Math.max(0, state.maxAdditionalCostUsd - spentAdditionalUsd)
  )
  const reason =
    activeJobs > 0
      ? 'active_job'
      : remainingUsd < state.minimumRemainingUsdPerClaim
        ? 'budget_boundary'
        : 'ready'
  return {
    mode: 'lean',
    selectedJobIds: state.selectedJobIds,
    spentAdditionalUsd,
    remainingUsd,
    minimumRemainingUsdPerClaim: state.minimumRemainingUsdPerClaim,
    canClaim: reason === 'ready',
    reason,
  }
}
