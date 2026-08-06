import { describe, expect, it } from 'vitest'

import {
  DimensionScoreSchema,
  StoredScoreDimensionSchema,
  normalizeDimension,
  SCORE_DIMENSION_LABELS,
} from './underwriting'

const DIM_KEYS = Object.keys(SCORE_DIMENSION_LABELS)

describe('dimension score contract', () => {
  it('demands a reasoning sentence from a fresh run', () => {
    expect(DimensionScoreSchema.safeParse({ score: 74, reasoning: 'ok' }).success).toBe(
      true
    )
    // A bare number is what the old contract allowed and what left the operator
    // staring at 13 unexplained bars.
    expect(DimensionScoreSchema.safeParse(74).success).toBe(false)
    expect(DimensionScoreSchema.safeParse({ score: 74 }).success).toBe(false)
  })

  it('still reads the bare numbers already stored in ai_runs', () => {
    const legacy = Object.fromEntries(DIM_KEYS.map((k) => [k, 70]))
    expect(StoredScoreDimensionSchema.safeParse(legacy).success).toBe(true)
  })

  it('reads a mix, which is what a re-analysed catalogue looks like', () => {
    const mixed = Object.fromEntries(
      DIM_KEYS.map((k, i) => [k, i % 2 ? 70 : { score: 70, reasoning: 'why' }])
    )
    expect(StoredScoreDimensionSchema.safeParse(mixed).success).toBe(true)
  })

  it('covers all 13 dimensions', () => {
    expect(DIM_KEYS).toHaveLength(13)
  })
})

describe('normalizeDimension', () => {
  it('flattens the new shape', () => {
    expect(normalizeDimension({ score: 82, reasoning: 'strong payout' })).toEqual({
      score: 82,
      reasoning: 'strong payout',
    })
  })

  it('flattens a legacy number with nothing to explain', () => {
    expect(normalizeDimension(64)).toEqual({ score: 64, reasoning: null })
  })

  it('treats an empty reasoning as absent so the UI shows no tooltip', () => {
    expect(normalizeDimension({ score: 50, reasoning: '' }).reasoning).toBeNull()
  })

  it('does not throw on a missing dimension', () => {
    expect(normalizeDimension(undefined)).toEqual({ score: 0, reasoning: null })
  })
})
