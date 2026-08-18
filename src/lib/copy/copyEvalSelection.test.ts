import { describe, expect, it } from 'vitest'

import {
  selectAffxEvalOffers,
  type EvalOfferCandidate,
} from './copyEvalSelection'

const offer = (
  offerId: string,
  vertical: string,
  overrides: Partial<EvalOfferCandidate> = {}
): EvalOfferCandidate => ({
  offerId,
  name: offerId,
  vertical,
  verifiedSourceCount: 6,
  hasUnderwriting: true,
  hasDeepBrief: true,
  hasAvatar: true,
  hasSpy: true,
  hasTestKit: true,
  measuredWinnerCount: 0,
  complianceRisk: false,
  ...overrides,
})

describe('AffX eval selection', () => {
  it('selects four deterministic profiles across distinct verticals', () => {
    const selected = selectAffxEvalOffers([
      offer('winner', 'saas', { measuredWinnerCount: 2 }),
      offer('full', 'fitness'),
      offer('missing-spy', 'pets', { hasSpy: false }),
      offer('risky', 'relationships', { complianceRisk: true }),
      offer('spare', 'finance'),
    ])
    expect(selected.map((item) => item.offerId)).toEqual([
      'winner',
      'full',
      'missing-spy',
      'risky',
    ])
    expect(new Set(selected.map((item) => item.vertical)).size).toBe(4)
  })
})
