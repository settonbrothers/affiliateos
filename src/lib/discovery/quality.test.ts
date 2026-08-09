import { describe, expect, it } from 'vitest'

import { checkDeepAnalysis, deriveRecommended, summarize } from './quality'
import type { StoredDeepAnalysis } from './promote'

const filter = (status: string, evidence = 'because', source_url: string | null = null) =>
  ({ status, evidence, source_url }) as NonNullable<
    StoredDeepAnalysis['hard_filters']
  >['economics']

function clean(): StoredDeepAnalysis {
  return {
    overall_score: 72,
    summary: 'ok',
    recommended: true,
    must_verify_before_budget: [],
    hard_filters: {
      economics: filter('pass', 'e', 'https://a.example'),
      paid_traffic: filter('pass', 'p'),
      monetization_integrity: filter('pass', 'm', 'https://b.example'),
      scale_ceiling: filter('pass', 's'),
    },
    signals: {
      demand_trend: { value: 'rising', confidence: 'high', evidence: 'trend data' },
    },
  } as StoredDeepAnalysis
}

describe('checkDeepAnalysis', () => {
  it('passes an internally consistent analysis', () => {
    expect(checkDeepAnalysis(clean())).toEqual([])
  })

  it('catches recommended=true when a filter did not pass', () => {
    const d = clean()
    d.hard_filters!.paid_traffic = filter('fail', 'all paid forbidden')
    const rules = checkDeepAnalysis(d).map((x) => x.rule)
    expect(rules).toContain('recommended_requires_all_pass')
  })

  it('catches recommended=true below the score bar', () => {
    const d = clean()
    d.overall_score = 40
    expect(checkDeepAnalysis(d).map((x) => x.rule)).toContain(
      'recommended_requires_min_score'
    )
  })

  it('catches an unresolved filter with no must-verify line', () => {
    const d = clean()
    d.recommended = false
    d.hard_filters!.scale_ceiling = filter('unknown_verify', 'no cap language')
    expect(checkDeepAnalysis(d).map((x) => x.rule)).toContain(
      'unknown_without_must_verify'
    )
  })

  it('accepts an unresolved filter that IS carried into must-verify', () => {
    const d = clean()
    d.recommended = false
    d.hard_filters!.scale_ceiling = filter('unknown_verify', 'no cap language')
    d.must_verify_before_budget = ['Confirm the per-affiliate cap']
    expect(checkDeepAnalysis(d).map((x) => x.rule)).not.toContain(
      'unknown_without_must_verify'
    )
  })

  it('catches a verdict with no evidence behind it', () => {
    const d = clean()
    d.hard_filters!.economics = filter('pass', '   ')
    expect(checkDeepAnalysis(d).map((x) => x.rule)).toContain(
      'resolved_filter_without_evidence'
    )
  })

  it('catches a confident signal with nothing backing it', () => {
    const d = clean()
    d.signals!.momentum = { value: 'Series C', confidence: 'high', evidence: '' }
    expect(checkDeepAnalysis(d).map((x) => x.rule)).toContain('signal_without_evidence')
  })

  it('lets an explicitly unknown signal through', () => {
    const d = clean()
    d.signals!.momentum = { value: 'unknown', confidence: 'unknown', evidence: '' }
    expect(checkDeepAnalysis(d)).toEqual([])
  })

  it('has nothing to say about a payload predating the rubric', () => {
    const legacy = { overall_score: 60, summary: 'old' } as StoredDeepAnalysis
    expect(checkDeepAnalysis(legacy)).toEqual([])
  })

  it('reports an unparseable payload rather than passing it', () => {
    expect(checkDeepAnalysis(null).map((x) => x.rule)).toEqual(['unparseable'])
  })
})

describe('summarize', () => {
  it('counts clean analyses and tallies each broken rule', () => {
    const bad = clean()
    bad.overall_score = 10
    const report = summarize([clean(), clean(), bad])
    expect(report.total).toBe(3)
    expect(report.clean).toBe(2)
    expect(report.byRule.recommended_requires_min_score).toBe(1)
  })

  it('measures how many filter verdicts you can actually check a source for', () => {
    // clean() cites 2 of its 4 resolved filters.
    expect(summarize([clean()]).citedFilterRate).toBeCloseTo(0.5)
  })
})

describe('deriveRecommended', () => {
  it('agrees with a well-formed analysis', () => {
    expect(deriveRecommended(clean())).toBe(true)
  })

  it('overrules a model that recommended an offer forbidding paid traffic', () => {
    // The real GoHighLevel row: recommended=true with paid_traffic 'fail'.
    const d = clean()
    d.hard_filters!.paid_traffic = filter('fail', 'All paid traffic forbidden')
    expect(d.recommended).toBe(true)
    expect(deriveRecommended(d)).toBe(false)
  })

  it('overrules a model that recommended on an unresolved filter', () => {
    const d = clean()
    d.hard_filters!.paid_traffic = filter('unknown_verify', 'no policy found')
    expect(deriveRecommended(d)).toBe(false)
  })

  it('applies the score bar', () => {
    const d = clean()
    d.overall_score = 54
    expect(deriveRecommended(d)).toBe(false)
  })

  it('falls back to the stored flag when there are no filters to derive from', () => {
    const legacy = { overall_score: 80, recommended: true } as StoredDeepAnalysis
    expect(deriveRecommended(legacy)).toBe(true)
  })

  it('is false for a missing analysis', () => {
    expect(deriveRecommended(null)).toBe(false)
  })
})
