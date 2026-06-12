import { describe, expect, it } from 'vitest'

import { factTypeLabel, hostnameOf, sortFactsForDisplay } from './display'

describe('factTypeLabel', () => {
  it('maps known enum values to human labels', () => {
    expect(factTypeLabel('commission_value')).toBe('Commission')
    expect(factTypeLabel('traffic_rule_brand_bidding')).toBe('Brand bidding')
  })

  it('humanizes unknown values instead of crashing', () => {
    expect(factTypeLabel('future_fact_kind')).toBe('Future fact kind')
  })
})

describe('sortFactsForDisplay', () => {
  it('puts money facts before unprioritized types', () => {
    const sorted = sortFactsForDisplay([
      { fact_type: 'contact', confidence_score: 99 },
      { fact_type: 'commission_value', confidence_score: 50 },
    ])
    expect(sorted[0]?.fact_type).toBe('commission_value')
  })

  it('orders same-type facts by confidence, highest first', () => {
    const sorted = sortFactsForDisplay([
      { fact_type: 'allowed_geo', confidence_score: 40 },
      { fact_type: 'allowed_geo', confidence_score: 90 },
    ])
    expect(sorted[0]?.confidence_score).toBe(90)
  })

  it('does not mutate the input array', () => {
    const input = [
      { fact_type: 'other', confidence_score: 1 },
      { fact_type: 'commission_value', confidence_score: 1 },
    ]
    sortFactsForDisplay(input)
    expect(input[0]?.fact_type).toBe('other')
  })
})

describe('hostnameOf', () => {
  it('extracts the hostname', () => {
    expect(hostnameOf('https://partners.example.com/terms?x=1')).toBe(
      'partners.example.com'
    )
  })

  it('returns the raw string for unparseable URLs', () => {
    expect(hostnameOf('not a url')).toBe('not a url')
  })
})
