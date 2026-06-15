import { describe, expect, it } from 'vitest'

import { DeepAnalysisSchema } from './discovery'

const valid = {
  overall_score: 78,
  summary: 'Solid recurring program.',
  key_strengths: ['Recurring commission'],
  key_risks: ['Smaller brand'],
  estimated_commission: '20% lifetime',
  estimated_epc_band: '$0.80–1.60 EPC est.',
  network: 'in-house',
  recommended: true,
  must_verify_before_budget: ['Confirm paid-social policy'],
  hard_filters: {
    economics: { status: 'pass', evidence: '20% lifetime on $149/mo', source_url: null },
    paid_traffic: { status: 'unknown_verify', evidence: 'No policy stated', source_url: null },
    monetization_integrity: { status: 'pass', evidence: 'Net-30', source_url: 'https://x.com/terms' },
    scale_ceiling: { status: 'pass', evidence: 'No cap', source_url: null },
  },
}

describe('DeepAnalysisSchema', () => {
  it('accepts a full valid payload', () => {
    expect(DeepAnalysisSchema.safeParse(valid).success).toBe(true)
  })

  it('allows nullable epc band and network', () => {
    expect(
      DeepAnalysisSchema.safeParse({
        ...valid,
        estimated_epc_band: null,
        network: null,
      }).success
    ).toBe(true)
  })

  it('rejects an unknown hard-filter status', () => {
    const bad = {
      ...valid,
      hard_filters: {
        ...valid.hard_filters,
        economics: { status: 'maybe', evidence: 'x', source_url: null },
      },
    }
    expect(DeepAnalysisSchema.safeParse(bad).success).toBe(false)
  })

  it('requires all four hard filters', () => {
    const bad = { ...valid, hard_filters: { economics: valid.hard_filters.economics } }
    expect(DeepAnalysisSchema.safeParse(bad).success).toBe(false)
  })
})
