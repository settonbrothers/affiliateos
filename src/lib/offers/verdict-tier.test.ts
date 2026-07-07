import { describe, expect, it } from 'vitest'

import { verdictTier } from './verdict-tier'

describe('verdictTier', () => {
  it('maps top verdicts to hi', () => {
    expect(verdictTier('high_ceiling_opportunity')).toBe('hi')
    expect(verdictTier('strategic_opportunity')).toBe('hi')
    expect(verdictTier('strong_test')).toBe('hi')
  })
  it('maps middle verdicts to mid', () => {
    expect(verdictTier('small_paid_test')).toBe('mid')
    expect(verdictTier('watch')).toBe('mid')
  })
  it('maps low verdicts to low', () => {
    expect(verdictTier('reject')).toBe('low')
    expect(verdictTier('organic_only')).toBe('low')
    expect(verdictTier('seo_review_only')).toBe('low')
  })
})
