export type LeanEvalEngine =
  | 'production_baseline_snapshot'
  | 'copy_brain_candidate'

export type LeanEvalCase = {
  id: string
  externalId: string
  split: 'calibration' | 'holdout'
}

export type LeanEvalJob = {
  id: string
  caseId: string
  engine: LeanEvalEngine
  repetition: number
  status: 'queued' | 'running' | 'completed' | 'failed'
  costUsd: number
  hasCheckpoint: boolean
}

export type LeanResumeJob = {
  jobId: string
  caseId: string
  engine: LeanEvalEngine
  repetition: number
  resumesCheckpoint: boolean
  estimatedAdditionalCostUsd: number
}

export type LeanResumePlan = {
  status: 'ready' | 'blocked'
  selectedJobs: LeanResumeJob[]
  readyCalibrationPairs: number
  untouchedHoldoutCases: number
  estimatedAdditionalCostUsd: number
  recommendedHardCapUsd: number
  blockers: string[]
}

const roundMoney = (value: number) => Number(value.toFixed(4))

function averageCompletedCost(
  jobs: LeanEvalJob[],
  engine: LeanEvalEngine
): number {
  const costs = jobs
    .filter(
      (job) =>
        job.engine === engine &&
        job.status === 'completed' &&
        Number.isFinite(job.costUsd) &&
        job.costUsd > 0
    )
    .map((job) => job.costUsd)
  if (costs.length === 0) return engine === 'copy_brain_candidate' ? 0.75 : 0.25
  return costs.reduce((sum, cost) => sum + cost, 0) / costs.length
}

export function buildLeanResumePlan({
  cases,
  jobs,
  preregisteredRepetitions,
}: {
  cases: LeanEvalCase[]
  jobs: LeanEvalJob[]
  preregisteredRepetitions: Record<string, number>
}): LeanResumePlan {
  const blockers: string[] = []
  const selectedJobs: LeanResumeJob[] = []
  let readyCalibrationPairs = 0
  const averageByEngine: Record<LeanEvalEngine, number> = {
    production_baseline_snapshot: averageCompletedCost(
      jobs,
      'production_baseline_snapshot'
    ),
    copy_brain_candidate: averageCompletedCost(jobs, 'copy_brain_candidate'),
  }

  for (const evalCase of cases) {
    if (evalCase.split === 'holdout') continue
    const repetition = preregisteredRepetitions[evalCase.externalId]
    if (repetition === undefined || !Number.isInteger(repetition)) {
      blockers.push(
        `Missing preregistered repetition for ${evalCase.externalId}`
      )
      continue
    }
    const desiredJobs = jobs.filter(
      (job) => job.caseId === evalCase.id && job.repetition === repetition
    )
    const byEngine = new Map(
      desiredJobs.map((job) => [job.engine, job] as const)
    )
    const baseline = byEngine.get('production_baseline_snapshot')
    const candidate = byEngine.get('copy_brain_candidate')
    if (!baseline || !candidate) {
      blockers.push(`Frozen jobs missing for ${evalCase.externalId}`)
      continue
    }
    if (baseline.status === 'completed' && candidate.status === 'completed') {
      readyCalibrationPairs++
      continue
    }
    for (const job of [baseline, candidate]) {
      if (job.status === 'completed') continue
      if (job.status !== 'failed') {
        blockers.push(
          `${evalCase.externalId}/${job.engine} is ${job.status}, not safely resumable`
        )
        continue
      }
      const averageCost = averageByEngine[job.engine]
      const remainingEstimate = job.hasCheckpoint
        ? Math.max(averageCost - job.costUsd, averageCost * 0.25)
        : averageCost
      selectedJobs.push({
        jobId: job.id,
        caseId: evalCase.id,
        engine: job.engine,
        repetition,
        resumesCheckpoint: job.hasCheckpoint,
        estimatedAdditionalCostUsd: roundMoney(remainingEstimate),
      })
    }
  }

  const estimatedAdditionalCostUsd = roundMoney(
    selectedJobs.reduce((sum, job) => sum + job.estimatedAdditionalCostUsd, 0)
  )
  const recommendedHardCapUsd =
    selectedJobs.length === 0
      ? 0
      : Math.ceil(Math.max(estimatedAdditionalCostUsd * 1.5, 1) * 2) / 2

  return {
    status: blockers.length === 0 ? 'ready' : 'blocked',
    selectedJobs,
    readyCalibrationPairs,
    untouchedHoldoutCases: cases.filter((item) => item.split === 'holdout')
      .length,
    estimatedAdditionalCostUsd,
    recommendedHardCapUsd,
    blockers,
  }
}
