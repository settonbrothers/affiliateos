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

export type UnderwritingFactInput = {
  fact_type: string
  fact_value: string
  source_quote: string | null
  confidence_score: number | null
}

export function mockUnderwriting(
  inputFacts: UnderwritingFactInput[] = []
): Record<string, unknown> {
  const envelopeFacts = inputFacts.map((f) => ({
    statement: `${f.fact_type}: ${f.fact_value}`,
    source: f.source_quote ?? null,
    confidence: f.confidence_score ?? 80,
  }))
  // Data confidence reflects how many verified facts we actually have.
  const dataConfidence =
    inputFacts.length === 0 ? 35 : Math.min(60 + inputFacts.length * 5, 90)
  const base = envelope('UnderwritingOrchestrator')
  const noFacts = inputFacts.length === 0

  return {
    ...base,
    confidence_score: dataConfidence,
    facts: envelopeFacts,
    assumptions: noFacts
      ? ['Mock output — no verified facts attached to this offer.']
      : [`Mock output — informed by ${inputFacts.length} verified fact(s).`],
    human_review_required: noFacts,
    human_review_reasons: noFacts ? ['No verified facts available for this offer.'] : [],
    payload: {
      scores: {
        economics: 74,
        demand: 78,
        competition: 52,
        creative_opportunity: 68,
        funnel_fit: 70,
        compliance: 88,
        operator_fit: 70,
        data_confidence: dataConfidence,
        offer_trust: 86,
        scale_potential: 75,
        cashflow_fit: 65,
        high_ceiling_potential: 72,
        execution_complexity: 58,
      },
      weighted_score: noFacts ? 55 : 73,
      verdict: noFacts ? 'watch' : 'strong_test',
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
        compliance: noFacts ? 'No verified facts — review claims before scaling.' : null,
      },
      kill_criteria: ['CPA above $90 after $300 spend', 'CTR below 0.8% after 10k impressions'],
      scale_criteria: ['EPC above $1.20 across 3 angles', 'Stable CVR over 5 days'],
      verdict_caps_applied: noFacts ? ['capped to watch — no verified facts'] : [],
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
