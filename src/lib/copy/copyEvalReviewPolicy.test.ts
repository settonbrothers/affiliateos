import { describe, expect, it } from 'vitest'

import {
  isAnthropicCreditFailure,
  selectReviewablePairJobs,
  type ReviewableEvalJob,
} from './copyEvalReviewPolicy'

const jobs: ReviewableEvalJob[] = [
  {
    id: 'baseline',
    case_id: 'case-1',
    engine: 'production_baseline_snapshot',
    repetition: 1,
    status: 'completed',
  },
  {
    id: 'candidate',
    case_id: 'case-1',
    engine: 'copy_brain_candidate',
    repetition: 1,
    status: 'completed',
  },
]

describe('copy eval partial review policy', () => {
  it('allows a completed preregistered calibration pair before all jobs finish', () => {
    expect(
      selectReviewablePairJobs({
        evalCase: { id: 'case-1', split: 'calibration', revealed_at: null },
        jobs,
        preregisteredRepetition: 1,
        calibrationScored: 0,
      })
    ).toEqual({ baseline: jobs[0], candidate: jobs[1] })
  })

  it('rejects a pair from the wrong repetition', () => {
    expect(
      selectReviewablePairJobs({
        evalCase: { id: 'case-1', split: 'calibration', revealed_at: null },
        jobs,
        preregisteredRepetition: 0,
        calibrationScored: 0,
      })
    ).toBeNull()
  })

  it('keeps holdout sealed even when its outputs already exist', () => {
    expect(
      selectReviewablePairJobs({
        evalCase: { id: 'case-1', split: 'holdout', revealed_at: null },
        jobs,
        preregisteredRepetition: 1,
        calibrationScored: 6,
      })
    ).toBeNull()
  })

  it('requires six calibration scores and an explicit reveal for holdout', () => {
    expect(
      selectReviewablePairJobs({
        evalCase: {
          id: 'case-1',
          split: 'holdout',
          revealed_at: '2026-08-19T00:00:00Z',
        },
        jobs,
        preregisteredRepetition: 1,
        calibrationScored: 5,
      })
    ).toBeNull()
    expect(
      selectReviewablePairJobs({
        evalCase: {
          id: 'case-1',
          split: 'holdout',
          revealed_at: '2026-08-19T00:00:00Z',
        },
        jobs,
        preregisteredRepetition: 1,
        calibrationScored: 6,
      })
    ).not.toBeNull()
  })

  it('recognizes the provider credit stop without treating generic failures as it', () => {
    expect(
      isAnthropicCreditFailure(
        'Your credit balance is too low to access the Anthropic API.'
      )
    ).toBe(true)
    expect(isAnthropicCreditFailure('temporary timeout')).toBe(false)
  })
})
