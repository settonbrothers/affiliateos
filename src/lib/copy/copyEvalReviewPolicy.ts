export type ReviewableEvalCase = {
  id: string
  split: string
  revealed_at: string | null
}

export type ReviewableEvalJob = {
  id: string
  case_id: string
  engine: string
  repetition: number
  status: string
}

export function selectReviewablePairJobs<T extends ReviewableEvalJob>({
  evalCase,
  jobs,
  preregisteredRepetition,
  calibrationScored,
  requiredCalibrationScores = 6,
}: {
  evalCase: ReviewableEvalCase
  jobs: T[]
  preregisteredRepetition: number
  calibrationScored: number
  requiredCalibrationScores?: number
}): { baseline: T; candidate: T } | null {
  if (!['calibration', 'holdout'].includes(evalCase.split)) return null
  if (
    evalCase.split === 'holdout' &&
    (calibrationScored < requiredCalibrationScores || !evalCase.revealed_at)
  )
    return null

  const pairJobs = jobs.filter(
    (job) =>
      job.case_id === evalCase.id &&
      job.repetition === preregisteredRepetition &&
      job.status === 'completed'
  )
  const baseline = pairJobs.filter(
    (job) => job.engine === 'production_baseline_snapshot'
  )
  const candidate = pairJobs.filter(
    (job) => job.engine === 'copy_brain_candidate'
  )
  if (pairJobs.length !== 2 || baseline.length !== 1 || candidate.length !== 1)
    return null
  return { baseline: baseline[0]!, candidate: candidate[0]! }
}

export function isAnthropicCreditFailure(message: string | null): boolean {
  return Boolean(
    message?.includes('credit balance is too low to access the Anthropic API')
  )
}
