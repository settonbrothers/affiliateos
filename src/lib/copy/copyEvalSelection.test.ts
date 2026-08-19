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

  it('freezes an inspected four-offer suite without inventing missing winners', () => {
    const candidates = [
      offer('jasper', 'saas', {
        verifiedSourceCount: 0,
        hasSpy: false,
        hasTestKit: false,
      }),
      offer('activecampaign', 'saas', {
        hasAvatar: false,
        hasSpy: false,
        hasTestKit: false,
      }),
      offer('systeme', 'saas', {
        verifiedSourceCount: 0,
        hasAvatar: false,
        hasSpy: false,
        hasTestKit: false,
      }),
      offer('femicore', 'health', {
        verifiedSourceCount: 0,
        hasSpy: false,
        hasTestKit: false,
        complianceRisk: true,
      }),
    ]
    const selected = selectAffxEvalOffers(candidates, [
      { offerId: 'jasper', profile: 'best_available_context' },
      {
        offerId: 'activecampaign',
        profile: 'verified_evidence_missing_optional_upstream',
      },
      { offerId: 'systeme', profile: 'conflicting_vendor_economics' },
      { offerId: 'femicore', profile: 'thin_health_claims_vendor_only' },
    ])

    expect(selected.map((item) => item.offerId)).toEqual([
      'jasper',
      'activecampaign',
      'systeme',
      'femicore',
    ])
    expect(selected.every((item) => item.measuredWinnerCount === 0)).toBe(true)
    expect(new Set(selected.map((item) => item.vertical)).size).toBe(2)
  })

  it('refuses to replace a missing locked offer with a random candidate', () => {
    expect(() =>
      selectAffxEvalOffers(
        [offer('available', 'saas')],
        [
          { offerId: 'available', profile: 'best_available_context' },
          {
            offerId: 'missing-1',
            profile: 'verified_evidence_missing_optional_upstream',
          },
          { offerId: 'missing-2', profile: 'conflicting_vendor_economics' },
          { offerId: 'missing-3', profile: 'thin_health_claims_vendor_only' },
        ]
      )
    ).toThrow('do not substitute a random case')
  })
})
