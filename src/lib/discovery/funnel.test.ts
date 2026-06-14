import { describe, expect, it } from 'vitest'

import {
  STAGE_LABELS,
  funnelCounts,
  rankAnalyzed,
  type CandidateLike,
} from './funnel'

const c = (over: Partial<CandidateLike>): CandidateLike => ({
  id: Math.random().toString(),
  stage: 'discovered',
  deep_score: null,
  triage_score: null,
  ...over,
})

describe('funnelCounts', () => {
  it('counts discovered as everything, then each later stage cumulatively', () => {
    const counts = funnelCounts([
      c({ stage: 'rejected', rejection_stage: 'triaged' }),
      c({ stage: 'rejected', rejection_stage: 'analyzed' }),
      c({ stage: 'analyzed' }),
      c({ stage: 'approved' }),
      c({ stage: 'promoted' }),
    ])
    // discovered = all 5; triaged = survived triage = analyzed+approved+promoted
    // + the one rejected AT analyzed (it passed triage) = 4; analyzed = reached
    // deep = same 4; approved = approved+promoted = 2.
    expect(counts).toEqual({ discovered: 5, triaged: 4, analyzed: 4, approved: 2 })
  })
})

describe('rankAnalyzed', () => {
  it('returns reached-deep candidates sorted by deep_score desc', () => {
    const ranked = rankAnalyzed([
      c({ id: 'low', stage: 'analyzed', deep_score: 40 }),
      c({ id: 'high', stage: 'approved', deep_score: 90 }),
      c({ id: 'dropped', stage: 'rejected', rejection_stage: 'triaged' }),
    ])
    expect(ranked.map((r) => r.id)).toEqual(['high', 'low'])
  })
})

describe('STAGE_LABELS', () => {
  it('has a human label for every stage', () => {
    expect(STAGE_LABELS.discovered).toBeTruthy()
    expect(STAGE_LABELS.promoted).toBeTruthy()
  })
})
