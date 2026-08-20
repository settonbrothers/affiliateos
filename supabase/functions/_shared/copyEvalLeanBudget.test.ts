import { assertEquals } from 'jsr:@std/assert'

import {
  parseCopyEvalLeanResumeState,
  resolveCopyEvalLeanExecutionPolicy,
} from './copyEvalLeanBudget.ts'

const armedMetrics = {
  lean_resume: {
    status: 'armed',
    selected_job_ids: ['candidate-1', 'baseline-2', 'candidate-1'],
    baseline_recorded_cost_usd: 9.747,
    max_additional_cost_usd: 4,
    minimum_remaining_usd_per_claim: 0.75,
  },
}

Deno.test('lean eval is unchanged when no lean plan exists', () => {
  assertEquals(
    resolveCopyEvalLeanExecutionPolicy({
      metrics: {},
      recordedCostUsd: 0,
      activeJobs: 0,
    }),
    { mode: 'full' }
  )
})

Deno.test('planned and paused plans cannot start jobs', () => {
  for (const status of ['planned', 'paused_budget', 'complete']) {
    assertEquals(
      resolveCopyEvalLeanExecutionPolicy({
        metrics: {
          lean_resume: { ...armedMetrics.lean_resume, status },
        },
        recordedCostUsd: 9.747,
        activeJobs: 0,
      }),
      { mode: 'disabled', reason: 'not_armed' }
    )
  }
})

Deno.test('armed plan permits one selected claim while budget remains', () => {
  const policy = resolveCopyEvalLeanExecutionPolicy({
    metrics: armedMetrics,
    recordedCostUsd: 10.247,
    activeJobs: 0,
  })
  assertEquals(policy.mode, 'lean')
  if (policy.mode !== 'lean') return
  assertEquals(policy.selectedJobIds, ['candidate-1', 'baseline-2'])
  assertEquals(policy.spentAdditionalUsd, 0.5)
  assertEquals(policy.remainingUsd, 3.5)
  assertEquals(policy.canClaim, true)
  assertEquals(policy.reason, 'ready')
})

Deno.test(
  'armed plan serializes jobs and stops before the budget boundary',
  () => {
    const active = resolveCopyEvalLeanExecutionPolicy({
      metrics: armedMetrics,
      recordedCostUsd: 10,
      activeJobs: 1,
    })
    assertEquals(
      active.mode === 'lean' ? [active.canClaim, active.reason] : null,
      [false, 'active_job']
    )

    const capped = resolveCopyEvalLeanExecutionPolicy({
      metrics: armedMetrics,
      recordedCostUsd: 13.1,
      activeJobs: 0,
    })
    assertEquals(
      capped.mode === 'lean'
        ? [capped.canClaim, capped.reason, capped.remainingUsd]
        : null,
      [false, 'budget_boundary', 0.647]
    )
  }
)

Deno.test('malformed lean metadata fails closed', () => {
  assertEquals(
    parseCopyEvalLeanResumeState({
      lean_resume: {
        status: 'armed',
        selected_job_ids: [],
        baseline_recorded_cost_usd: 9,
        max_additional_cost_usd: 4,
        minimum_remaining_usd_per_claim: 0.75,
      },
    }),
    'invalid'
  )
  assertEquals(
    resolveCopyEvalLeanExecutionPolicy({
      metrics: { lean_resume: { status: 'armed' } },
      recordedCostUsd: 0,
      activeJobs: 0,
    }),
    { mode: 'disabled', reason: 'invalid_policy' }
  )
})
