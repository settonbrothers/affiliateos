// Mock orchestrator outputs for M1/M2 — lets the whole UI + flow be built
// before any real Anthropic spend. Shapes mirror the schemas in
// docs/plan/05_AGENT_ROSTER.md; they'll be typed against the Zod contracts
// once _shared/types/ lands (Task 4.1).

const envelope = (orchestratorName: string) => ({
  orchestrator_name: orchestratorName,
  agent_version: 'mock-v1',
  status: 'success' as const,
  confidence_score: 72,
  facts: [],
  assumptions: ['Mock output — not a real evaluation.'],
  estimates: [],
  risks: [],
  unknowns: [],
  missing_data: [],
  human_review_required: false,
  human_review_reasons: [],
})

export function mockUnderwriting(): Record<string, unknown> {
  return {
    ...envelope('UnderwritingOrchestrator'),
    payload: {
      scores: {
        economics: 74,
        demand: 78,
        competition: 52,
        creative_opportunity: 68,
        funnel_fit: 70,
        compliance: 88,
        operator_fit: 70,
        data_confidence: 60,
        offer_trust: 86,
        scale_potential: 75,
        cashflow_fit: 65,
        high_ceiling_potential: 72,
        execution_complexity: 58,
      },
      weighted_score: 73,
      verdict: 'strong_test',
      recommended_channel: 'paid_social',
      recommended_geo: ['US', 'CA', 'UK'],
      minimum_test_budget_usd: 300,
      recommended_test_budget_usd: 750,
      main_reason_to_test:
        'Recurring commission on a category-leading brand with an engaged community.',
      main_reason_to_avoid: 'Category is saturated; creative differentiation is the bottleneck.',
      warnings: {
        trust: null,
        scale: null,
        cashflow: null,
        compliance: null,
      },
      kill_criteria: ['CPA above $90 after $300 spend', 'CTR below 0.8% after 10k impressions'],
      scale_criteria: ['EPC above $1.20 across 3 angles', 'Stable CVR over 5 days'],
      verdict_caps_applied: [],
    },
  }
}

export function mockSourceExtraction(): Record<string, unknown> {
  return {
    ...envelope('SourceExtractionOrchestrator'),
    payload: {
      doc_type: 'affiliate_terms',
      source_summary: 'Mock extraction of an affiliate program terms page.',
      language: 'en',
      source_reliability_score: 80,
      facts: [
        {
          fact_type: 'commission_type',
          fact_value: 'recurring',
          source_quote: 'Earn 30% recurring commission for the lifetime of the customer.',
          confidence_score: 90,
        },
        {
          fact_type: 'cookie_duration',
          fact_value: '45 days',
          source_quote: '45-day cookie window.',
          confidence_score: 85,
        },
      ],
      detected_claims: [],
    },
  }
}

export function mockForOrchestrator(orchestratorName: string): Record<string, unknown> {
  switch (orchestratorName) {
    case 'SourceExtractionOrchestrator':
      return mockSourceExtraction()
    case 'UnderwritingOrchestrator':
    default:
      return mockUnderwriting()
  }
}
