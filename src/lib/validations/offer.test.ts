import { describe, expect, it } from 'vitest'

import { OFFER_STATUSES, OfferStatusUpdateSchema } from './offer'

describe('OfferStatusUpdateSchema', () => {
  it('accepts every lifecycle status', () => {
    for (const status of OFFER_STATUSES) {
      expect(OfferStatusUpdateSchema.safeParse({ status }).success).toBe(true)
    }
  })

  it('covers the full 7-value offer_status enum', () => {
    expect(OFFER_STATUSES).toHaveLength(7)
  })

  it('rejects values outside the enum', () => {
    expect(
      OfferStatusUpdateSchema.safeParse({ status: 'live' }).success
    ).toBe(false)
  })
})
