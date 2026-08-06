import { describe, expect, it } from 'vitest'

import {
  PROMOTE_VERIFY_MIN_CONFIDENCE,
  buildOperatorNotes,
  deepAnalysisToFacts,
  parseStoredDeepAnalysis,
  type StoredDeepAnalysis,
} from './promote'
// The fixture is deliberately typed against the STRICT contract, so it stays a
// realistic fresh-run payload even though the converter accepts older shapes.
import type { DeepAnalysis } from '@/types/agents/discovery'

const CANDIDATE_URL = 'https://acme.com/affiliates'

function makeDeep(overrides: Partial<DeepAnalysis> = {}): DeepAnalysis {
  return {
    overall_score: 78,
    summary: 'Solid in-house program with recurring commission.',
    key_strengths: ['30% recurring', 'Strong brand'],
    key_risks: ['Crowded category'],
    estimated_commission: '30% recurring',
    estimated_epc_band: '$0.80–1.60 EPC est.',
    network: 'Impact',
    recommended: true,
    must_verify_before_budget: ['Confirm paid-social policy in writing'],
    hard_filters: {
      economics: {
        status: 'pass',
        evidence: '30% recurring commission on a $49/mo plan.',
        source_url: 'https://acme.com/terms',
      },
      paid_traffic: {
        status: 'pass',
        evidence: 'Paid social permitted; brand bidding forbidden.',
        source_url: null,
      },
      monetization_integrity: {
        status: 'pass',
        evidence: 'Net 30 via PayPal, no shaving reports found.',
        source_url: 'https://review.example/acme',
      },
      scale_ceiling: {
        status: 'pass',
        evidence: 'No per-affiliate cap stated.',
        source_url: null,
      },
    },
    signals: {
      demand_trend: {
        value: 'rising (scaling stage)',
        confidence: 'high',
        evidence: 'Search interest up year over year.',
      },
      scale_proxy: {
        value: 'widely promoted',
        confidence: 'medium',
        evidence: 'Appears across many affiliate roundups.',
      },
      momentum: {
        value: 'Series B raised 2026',
        confidence: 'high',
        evidence: 'TechCrunch reported a $40M round.',
      },
      best_payout_route: {
        value: 'Impact — $200/sale (highest found)',
        confidence: 'medium',
        evidence: 'Impact listing shows $200 per sale.',
      },
    },
    ...overrides,
  }
}

const verified = (facts: { confidence_score: number }[]) =>
  facts.filter((f) => f.confidence_score >= PROMOTE_VERIFY_MIN_CONFIDENCE)

describe('deepAnalysisToFacts', () => {
  it('returns nothing for a missing payload', () => {
    expect(deepAnalysisToFacts(null, CANDIDATE_URL)).toEqual({
      sources: [],
      facts: [],
    })
  })

  it('clears the 5-verified-fact bar that caps every discovered offer at watch', () => {
    const { facts } = deepAnalysisToFacts(makeDeep(), CANDIDATE_URL)
    expect(verified(facts).length).toBeGreaterThanOrEqual(5)
  })

  it('never invents a fact from an unresolved filter', () => {
    const deep = makeDeep()
    deep.hard_filters.economics.status = 'unknown_verify'
    deep.hard_filters.paid_traffic.status = 'unknown_verify'
    deep.hard_filters.monetization_integrity.status = 'unknown_verify'
    deep.hard_filters.scale_ceiling.status = 'unknown_verify'

    const { facts } = deepAnalysisToFacts(deep, CANDIDATE_URL)
    const fromFilters = facts.filter((f) =>
      ['commission_value', 'traffic_rule_paid_social', 'cap'].includes(f.fact_type)
    )
    expect(fromFilters).toEqual([])
  })

  it('keeps a failing filter — negative evidence is what protects the operator', () => {
    const deep = makeDeep()
    deep.hard_filters.paid_traffic.status = 'fail'
    deep.hard_filters.paid_traffic.evidence = 'All paid traffic is forbidden.'

    const { facts } = deepAnalysisToFacts(deep, CANDIDATE_URL)
    const rule = facts.find((f) => f.fact_type === 'traffic_rule_paid_social')
    expect(rule?.fact_value).toBe('forbidden')
    expect(rule?.source_quote).toBe('All paid traffic is forbidden.')
  })

  it('emits the paid-traffic rule underwriting needs to lift its small_paid_test cap', () => {
    const { facts } = deepAnalysisToFacts(makeDeep(), CANDIDATE_URL)
    const rule = facts.find((f) => f.fact_type === 'traffic_rule_paid_social')
    expect(rule?.fact_value).toBe('allowed')
    expect(rule?.confidence_score).toBeGreaterThanOrEqual(
      PROMOTE_VERIFY_MIN_CONFIDENCE
    )
  })

  it('carries the model evidence verbatim as the source quote', () => {
    const { facts } = deepAnalysisToFacts(makeDeep(), CANDIDATE_URL)
    const commission = facts.find((f) => f.fact_type === 'commission_value')
    expect(commission?.fact_value).toBe('30% recurring')
    expect(commission?.source_quote).toBe(
      '30% recurring commission on a $49/mo plan.'
    )
  })

  it('trusts a cited claim more than one taken from the offer page alone', () => {
    const { facts } = deepAnalysisToFacts(makeDeep(), CANDIDATE_URL)
    const cited = facts.find((f) => f.fact_type === 'commission_value')
    const uncited = facts.find((f) => f.fact_type === 'traffic_rule_paid_social')
    expect(cited!.confidence_score).toBeGreaterThan(uncited!.confidence_score)
  })

  it('emits one source per distinct provenance, each referenced by a fact', () => {
    const { sources, facts } = deepAnalysisToFacts(makeDeep(), CANDIDATE_URL)
    const keys = sources.map((s) => s.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const f of facts) expect(keys).toContain(f.sourceKey)

    const cited = sources.find((s) => s.kind === 'cited')
    expect(cited?.url).toBe('https://acme.com/terms')
    expect(sources.find((s) => s.kind === 'page')?.url).toBe(CANDIDATE_URL)
  })

  it('never blames the offer page for something only the research turned up', () => {
    const { sources, facts } = deepAnalysisToFacts(makeDeep(), CANDIDATE_URL)
    const momentum = facts.find((f) => f.source_quote.includes('TechCrunch'))
    expect(momentum?.sourceKey).toBe('research')

    const research = sources.find((s) => s.key === 'research')
    expect(research?.url).toBeNull()
    // A page we actually read outranks an unattributed search result.
    expect(research!.reliability).toBeLessThan(
      sources.find((s) => s.kind === 'page')!.reliability
    )
  })

  it('drops signals the model could not evidence', () => {
    const deep = makeDeep()
    deep.signals.momentum = {
      value: 'unknown',
      confidence: 'unknown',
      evidence: '',
    }
    const { facts } = deepAnalysisToFacts(deep, CANDIDATE_URL)
    expect(facts.some((f) => f.fact_value.includes('unknown'))).toBe(false)
  })

  it('scores a signal by how well the model could evidence it', () => {
    const { facts } = deepAnalysisToFacts(makeDeep(), CANDIDATE_URL)
    const high = facts.find((f) => f.source_quote === 'TechCrunch reported a $40M round.')
    const medium = facts.find(
      (f) => f.source_quote === 'Appears across many affiliate roundups.'
    )
    expect(high!.confidence_score).toBeGreaterThan(medium!.confidence_score)
  })

  it('strips the quotes real runs sometimes wrap values in', () => {
    const deep = makeDeep({ estimated_commission: '"35% recurring lifetime"' })
    const { facts } = deepAnalysisToFacts(deep, CANDIDATE_URL)
    expect(facts.find((f) => f.fact_type === 'commission_value')?.fact_value).toBe(
      '35% recurring lifetime'
    )
  })

  it('leaves an inner quote alone', () => {
    const deep = makeDeep({ estimated_commission: '30% on the "Pro" plan' })
    const { facts } = deepAnalysisToFacts(deep, CANDIDATE_URL)
    expect(facts.find((f) => f.fact_type === 'commission_value')?.fact_value).toBe(
      '30% on the "Pro" plan'
    )
  })

  it('survives a partial payload without throwing', () => {
    const partial = {
      overall_score: 40,
      summary: 'Thin.',
      hard_filters: {},
      signals: {},
    } as unknown as StoredDeepAnalysis
    expect(() => deepAnalysisToFacts(partial, null)).not.toThrow()
  })
})

// Most rows already in discovery_candidates.deep_analysis predate Discovery v2
// Phase B and carry no `signals` at all; older ones have no `hard_filters`
// either. Strict validation returned null for 7 of the 8 real payloads in the
// database, which would have approved them with nothing attached — the very bug
// this module exists to fix.
describe('parseStoredDeepAnalysis', () => {
  it('keeps a pre-Phase-B payload that has no signals', () => {
    const { signals: _dropped, ...legacy } = makeDeep()
    const parsed = parseStoredDeepAnalysis(legacy)
    expect(parsed).not.toBeNull()

    const { facts } = deepAnalysisToFacts(parsed, CANDIDATE_URL)
    expect(verified(facts).length).toBeGreaterThanOrEqual(5)
  })

  it('keeps a payload predating the rubric, with neither filters nor signals', () => {
    const parsed = parseStoredDeepAnalysis({
      overall_score: 61,
      summary: 'Early run.',
      key_strengths: ['Recurring'],
      key_risks: ['Unverified terms'],
      estimated_commission: '25%',
      recommended: true,
    })
    expect(parsed).not.toBeNull()
    // Nothing to attest, so no facts — but the qualitative read still travels.
    expect(deepAnalysisToFacts(parsed, CANDIDATE_URL).facts).toEqual([])
    expect(buildOperatorNotes(parsed)).toContain('Unverified terms')
  })

  it('still rejects a blob of the wrong shape', () => {
    expect(parseStoredDeepAnalysis({ overall_score: 'high' })).toBeNull()
    expect(parseStoredDeepAnalysis(null)).toBeNull()
  })

  it('drops a signal the run stored without a confidence', () => {
    const deep = makeDeep()
    // @ts-expect-error modelling an older row that omitted the field
    delete deep.signals.momentum.confidence
    const parsed = parseStoredDeepAnalysis(deep)
    const { facts } = deepAnalysisToFacts(parsed, CANDIDATE_URL)
    expect(facts.some((f) => f.source_quote.includes('TechCrunch'))).toBe(false)
  })
})

describe('buildOperatorNotes', () => {
  it('carries the summary, risks and the must-verify list', () => {
    const notes = buildOperatorNotes(makeDeep())
    expect(notes).toContain('Solid in-house program with recurring commission.')
    expect(notes).toContain('Crowded category')
    expect(notes).toContain('Confirm paid-social policy in writing')
  })

  it('is empty when there is no analysis to carry', () => {
    expect(buildOperatorNotes(null)).toBe('')
  })
})
