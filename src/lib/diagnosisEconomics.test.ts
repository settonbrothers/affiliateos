import { describe, expect, it } from 'vitest'

import type { CampaignEconomicsAssessment } from '@/types/agents/offerEconomics'

import { applyDeterministicEconomics } from './diagnosisEconomics'

const raw = () => ({
  orchestrator_name: 'DiagnosisOrchestrator',
  agent_version: 'test',
  status: 'success',
  confidence_score: 80,
  facts: [],
  assumptions: [],
  estimates: [],
  risks: [],
  unknowns: [],
  missing_data: [],
  human_review_required: false,
  human_review_reasons: [],
  payload: {
    diagnosis_summary: 'The model blamed the landing page.',
    data_quality_assessment: 'Directional.',
    metric_analysis: {
      ctr: { actual: 1, expected: [0.8, 2], verdict: 'within' },
      cpc: { actual: 25, expected: [0.5, 1.5], verdict: 'above' },
      clickout_rate: { actual: 60, expected: [60, 95], verdict: 'within' },
      cvr: { actual: 5, expected: [2, 5], verdict: 'within' },
      epc: { actual: 1.5, expected: [0.8, 1.5], verdict: 'within' },
    },
    primary_bottleneck: 'landing_page',
    secondary_bottlenecks: [],
    recommended_action: 'improve_landing',
    specific_recommendations: [],
    not_enough_data: false,
    not_enough_data_reason: null,
  },
})

const assessment = (
  read: CampaignEconomicsAssessment['primary_economic_read'],
  sufficiency: CampaignEconomicsAssessment['data_sufficiency']
): CampaignEconomicsAssessment => ({
  reporting_currency: 'ILS',
  metrics: {
    ctr: 0.01,
    cpc: 25,
    landing_view_rate: 0.9,
    affiliate_click_rate: 0.6,
    raw_cvr_from_ad_click: 0.05,
    approved_cvr_from_ad_click: 0.05,
    cpa_raw: 500,
    cpa_approved: 500,
    epc_ad_click: 1.5,
    epc_affiliate_click: 2.5,
    roas: 0.06,
    profit: -470,
    profit_margin: -15.67,
  },
  planning: {
    net_value_per_approved_conversion: 30,
    net_value_per_raw_conversion: 30,
    break_even_cpa: 30,
    break_even_cpc: 1.5,
    required_click_to_approved_cvr: 0.8333,
    scale_headroom_ratio: -15.67,
  },
  revenue_basis: 'measured',
  data_sufficiency: sufficiency,
  primary_economic_read: read,
  flags:
    read === 'implausible'
      ? ['economically_implausible_at_current_cpc']
      : ['sample_too_small'],
})

describe('deterministic diagnosis economics override', () => {
  it('overrides a landing-page guess when economics are implausible', () => {
    const output = applyDeterministicEconomics(
      raw(),
      assessment('implausible', 'directional')
    ) as ReturnType<typeof raw>
    expect(output.payload.primary_bottleneck).toBe('unit_economics')
    expect(output.payload.recommended_action).toBe('stop_test')
  })

  it('does not overrule the model on a thin sample', () => {
    const output = applyDeterministicEconomics(
      raw(),
      assessment('implausible', 'thin')
    ) as ReturnType<typeof raw>
    expect(output.payload.primary_bottleneck).toBe('landing_page')
    expect(output.payload).toHaveProperty('economics_assessment')
  })
})
