import { describe, expect, it } from 'vitest'

import {
  buildLeanResumePlan,
  type LeanEvalCase,
  type LeanEvalJob,
} from './copyEvalLeanResume'

const cases: LeanEvalCase[] = [
  ...['jasper', 'active', 'systeme', 'meal', 'saas', 'sleep'].map(
    (externalId, index) => ({
      id: `cal-${index}`,
      externalId,
      split: 'calibration' as const,
    })
  ),
  { id: 'holdout-1', externalId: 'health', split: 'holdout' },
  { id: 'holdout-2', externalId: 'extreme', split: 'holdout' },
]
const repetitions = Object.fromEntries(
  cases.map((item, index) => [item.externalId, index % 3])
)

const job = (
  evalCase: LeanEvalCase,
  engine: LeanEvalJob['engine'],
  status: LeanEvalJob['status'],
  overrides: Partial<LeanEvalJob> = {}
): LeanEvalJob => ({
  id: `${evalCase.id}-${engine}`,
  caseId: evalCase.id,
  engine,
  repetition: repetitions[evalCase.externalId]!,
  status,
  costUsd:
    status === 'completed'
      ? engine === 'copy_brain_candidate'
        ? 0.5
        : 0.2
      : 0,
  hasCheckpoint: false,
  ...overrides,
})

describe('lean copy eval resume planner', () => {
  it('selects exactly the eight missing jobs for one pair per calibration case', () => {
    const allJobs = cases.flatMap((evalCase, index) => {
      if (evalCase.split === 'holdout' || index === 0)
        return [
          job(evalCase, 'production_baseline_snapshot', 'completed'),
          job(evalCase, 'copy_brain_candidate', 'completed'),
        ]
      if (index === 1 || index === 2)
        return [
          job(evalCase, 'production_baseline_snapshot', 'completed'),
          job(evalCase, 'copy_brain_candidate', 'failed', {
            costUsd: 0.25,
            hasCheckpoint: true,
          }),
        ]
      return [
        job(evalCase, 'production_baseline_snapshot', 'failed'),
        job(evalCase, 'copy_brain_candidate', 'failed'),
      ]
    })
    const plan = buildLeanResumePlan({
      cases,
      jobs: allJobs,
      preregisteredRepetitions: repetitions,
    })

    expect(plan.status).toBe('ready')
    expect(plan.readyCalibrationPairs).toBe(1)
    expect(plan.selectedJobs).toHaveLength(8)
    expect(
      plan.selectedJobs.filter((item) => item.resumesCheckpoint)
    ).toHaveLength(2)
    expect(plan.untouchedHoldoutCases).toBe(2)
    expect(
      plan.selectedJobs.some((item) => item.caseId.startsWith('holdout'))
    ).toBe(false)
    expect(plan.recommendedHardCapUsd).toBeGreaterThanOrEqual(
      plan.estimatedAdditionalCostUsd
    )
  })

  it('does not restart completed jobs or spend on already-ready pairs', () => {
    const allJobs = cases.flatMap((evalCase) => [
      job(evalCase, 'production_baseline_snapshot', 'completed'),
      job(evalCase, 'copy_brain_candidate', 'completed'),
    ])
    const plan = buildLeanResumePlan({
      cases,
      jobs: allJobs,
      preregisteredRepetitions: repetitions,
    })
    expect(plan.selectedJobs).toEqual([])
    expect(plan.readyCalibrationPairs).toBe(6)
    expect(plan.recommendedHardCapUsd).toBe(0)
  })

  it('blocks rather than touching queued work or guessing a repetition', () => {
    const calibration = cases[0]!
    const plan = buildLeanResumePlan({
      cases: [calibration],
      jobs: [
        job(calibration, 'production_baseline_snapshot', 'completed'),
        job(calibration, 'copy_brain_candidate', 'queued'),
      ],
      preregisteredRepetitions: {},
    })
    expect(plan.status).toBe('blocked')
    expect(plan.selectedJobs).toEqual([])
    expect(plan.blockers[0]).toContain('Missing preregistered repetition')
  })
})
