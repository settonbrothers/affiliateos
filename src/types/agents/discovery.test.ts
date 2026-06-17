import { describe, expect, it } from 'vitest'

import {
  DeepAnalysisSchema,
  MineResponseSchema,
  TriageResponseSchema,
} from './discovery'

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
  signals: {
    demand_trend: { value: 'rising', confidence: 'medium', evidence: 'Search interest up' },
    scale_proxy: { value: 'widely promoted', confidence: 'low', evidence: 'Appears in many roundups' },
    momentum: { value: 'Series B 2026', confidence: 'high', evidence: 'TechCrunch' },
    best_payout_route: { value: 'Impact — $200/sale', confidence: 'medium', evidence: 'PostAffiliatePro' },
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

describe('TriageResponseSchema (classification)', () => {
  it('accepts the three classifications', () => {
    for (const classification of ['offer', 'container', 'reject'] as const) {
      const r = TriageResponseSchema.safeParse({
        results: [{ index: 0, classification, score: 60, reason: 'x' }],
      })
      expect(r.success).toBe(true)
    }
  })

  it('rejects an unknown classification', () => {
    const r = TriageResponseSchema.safeParse({
      results: [{ index: 0, classification: 'maybe', score: 60, reason: 'x' }],
    })
    expect(r.success).toBe(false)
  })
})

describe('MineResponseSchema', () => {
  it('accepts a list of offers with name + nullable url', () => {
    const r = MineResponseSchema.safeParse({
      offers: [
        { name: 'Acme', url: 'https://acme.com/affiliates' },
        { name: 'NoUrl', url: null },
      ],
    })
    expect(r.success).toBe(true)
  })
})

describe('DeepAnalysisSchema signals', () => {
  const base = {
    overall_score: 70,
    summary: 's',
    key_strengths: [],
    key_risks: [],
    estimated_commission: null,
    estimated_epc_band: null,
    network: null,
    recommended: false,
    must_verify_before_budget: [],
    hard_filters: {
      economics: { status: 'pass', evidence: 'e', source_url: null },
      paid_traffic: { status: 'pass', evidence: 'e', source_url: null },
      monetization_integrity: { status: 'pass', evidence: 'e', source_url: null },
      scale_ceiling: { status: 'pass', evidence: 'e', source_url: null },
    },
    signals: {
      demand_trend: { value: 'rising', confidence: 'medium', evidence: 'x' },
      scale_proxy: { value: 'unknown', confidence: 'unknown', evidence: 'x' },
      momentum: { value: 'none found', confidence: 'low', evidence: 'x' },
      best_payout_route: { value: 'in-house', confidence: 'low', evidence: 'x' },
    },
  }

  it('accepts a payload with all four signals', () => {
    expect(DeepAnalysisSchema.safeParse(base).success).toBe(true)
  })

  it('rejects an invalid signal confidence', () => {
    const bad = {
      ...base,
      signals: {
        ...base.signals,
        demand_trend: { value: 'rising', confidence: 'sometimes', evidence: 'x' },
      },
    }
    expect(DeepAnalysisSchema.safeParse(bad).success).toBe(false)
  })

  it('requires all four signal keys', () => {
    const { best_payout_route: _omit, ...partial } = base.signals
    expect(
      DeepAnalysisSchema.safeParse({ ...base, signals: partial }).success
    ).toBe(false)
  })
})
