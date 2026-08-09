import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { OfferVerdict } from './OfferVerdict'
import type { StoredUnderwritingResponse } from '@/types/agents/underwriting'

// Types did not catch the last render crash: a payload field changed shape and
// React threw "Objects are not valid as a React child" in production. These
// tests render the component for real, which is the only thing that would have.

function full(): StoredUnderwritingResponse {
  return {
    orchestrator_name: 'UnderwritingOrchestrator',
    agent_version: 'real-v1',
    status: 'success',
    confidence_score: 62,
    facts: [
      { statement: 'commission_value: 30% recurring', source: '30% recurring', confidence: 85 },
    ],
    assumptions: ['Pricing read off the landing page, not a terms document.'],
    estimates: [{ metric: 'EPC', value: '$1.20', basis: 'payout x assumed 2% CVR' }],
    risks: [
      { type: 'saturation', description: 'Heavily promoted in content channels.', severity: 'medium' },
    ],
    unknowns: ['Research contradicts the page on cookie window.'],
    missing_data: ['No published minimum payout.'],
    human_review_required: true,
    human_review_reasons: ['Health vertical with medium compliance risk.'],
    payload: {
      scores: Object.fromEntries(
        [
          'economics', 'demand', 'competition', 'creative_opportunity', 'funnel_fit',
          'compliance', 'operator_fit', 'data_confidence', 'offer_trust',
          'scale_potential', 'cashflow_fit', 'high_ceiling_potential',
          'execution_complexity',
        ].map((k) => [k, { score: 70, reasoning: `because of ${k}` }])
      ),
      weighted_score: 62,
      verdict: 'small_paid_test',
      recommended_channel: 'paid_social',
      recommended_geo: ['US', 'CA'],
      minimum_test_budget_usd: 300,
      recommended_test_budget_usd: 750,
      main_reason_to_test: 'Recurring commission on a growing category.',
      main_reason_to_avoid: 'Paid-traffic rules are unconfirmed.',
      warnings: {
        trust: null,
        scale: 'No cap stated, but volume is unproven.',
        cashflow: null,
        compliance: 'Health claims on the landing page need review.',
      },
      kill_criteria: ['CPA above $80 after 200 clicks'],
      scale_criteria: ['ROAS above 1.4 across three days'],
      verdict_caps_applied: ["Paid traffic rules unknown -> capped at 'small_paid_test'"],
    },
  } as StoredUnderwritingResponse
}

describe('OfferVerdict rendering', () => {
  it('renders a full payload without throwing', () => {
    expect(() => renderToStaticMarkup(<OfferVerdict evaluation={full()} />)).not.toThrow()
  })

  it('shows the fields that used to be computed and never displayed', () => {
    const html = renderToStaticMarkup(<OfferVerdict evaluation={full()} />)
    // warnings.* — the prompt REQUIRES one before recommending an unconfirmed
    // paid channel, and it was written straight into a void.
    expect(html).toContain('Health claims on the landing page need review.')
    expect(html).toContain('No cap stated, but volume is unproven.')
    // why the verdict was capped
    expect(html).toContain("capped at &#x27;small_paid_test&#x27;")
    expect(html).toContain('ROAS above 1.4 across three days') // scale_criteria
    expect(html).toContain('US, CA') // recommended_geo
    expect(html).toContain('300') // minimum_test_budget_usd
    expect(html).toContain('62%') // envelope confidence_score
    expect(html).toContain('Pricing read off the landing page') // assumptions
    expect(html).toContain('Research contradicts the page') // unknowns
    expect(html).toContain('No published minimum payout.') // missing_data
    expect(html).toContain('payout x assumed 2% CVR') // estimates basis
    expect(html).toContain('Heavily promoted in content channels.') // risks
    expect(html).toContain('85%') // facts[].confidence
  })

  it('renders a legacy payload that predates every one of those fields', () => {
    const legacy = {
      orchestrator_name: 'UnderwritingOrchestrator',
      agent_version: 'real-v1',
      status: 'success',
      confidence_score: 40,
      facts: [],
      assumptions: [],
      estimates: [],
      risks: [],
      unknowns: [],
      missing_data: [],
      human_review_required: false,
      human_review_reasons: [],
      payload: {
        // bare numbers, the pre-reasoning shape
        scores: { economics: 50 },
        weighted_score: 50,
        verdict: 'watch',
        recommended_channel: null,
        recommended_geo: [],
        minimum_test_budget_usd: null,
        recommended_test_budget_usd: null,
        main_reason_to_test: 'a',
        main_reason_to_avoid: 'b',
        warnings: { trust: null, scale: null, cashflow: null, compliance: null },
        kill_criteria: [],
        scale_criteria: [],
        verdict_caps_applied: [],
      },
    } as unknown as StoredUnderwritingResponse
    expect(() => renderToStaticMarkup(<OfferVerdict evaluation={legacy} />)).not.toThrow()
  })

  it('survives a payload missing the envelope arrays entirely', () => {
    const sparse = {
      payload: {
        scores: {},
        verdict: 'reject',
        warnings: {},
        main_reason_to_test: 'x',
        main_reason_to_avoid: 'y',
      },
    } as unknown as StoredUnderwritingResponse
    expect(() => renderToStaticMarkup(<OfferVerdict evaluation={sparse} />)).not.toThrow()
  })

  it('says so when there is no verdict', () => {
    const html = renderToStaticMarkup(<OfferVerdict evaluation={null} />)
    expect(html).toContain('No verdict yet')
  })
})
