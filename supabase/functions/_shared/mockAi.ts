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

export function mockTestKit(): Record<string, unknown> {
  return {
    ...envelope('TestKitOrchestrator'),
    payload: {
      test_objective:
        'Validate paid-social demand for the offer with 3 distinct angles before scaling.',
      channel_plan: {
        primary: 'paid_social',
        secondary: 'native',
        reasoning:
          'Visual, problem-aware audience converts well on feed placements; native as a scale lane.',
      },
      budget_plan: {
        minimum_usd: 300,
        recommended_usd: 750,
        max_initial_usd: 1000,
        reasoning: 'Enough spend to clear 3 angles past statistical noise without overcommitting.',
      },
      geo_plan: {
        primary: ['US', 'CA'],
        secondary: ['UK', 'AU'],
        reasoning: 'Tier-1 English GEOs with the highest expected EPC for this category.',
      },
      audience_direction:
        'Problem-aware adults who have tried a cheaper alternative and were disappointed.',
      angles: [
        {
          name: 'Time saved',
          positioning: 'Reclaim hours each week vs the manual way.',
          target_audience: 'Busy operators drowning in repetitive work.',
        },
        {
          name: 'Cost of inaction',
          positioning: 'What the old way quietly costs you every month.',
          target_audience: 'Cost-conscious buyers comparing tools.',
        },
        {
          name: 'Proof & trust',
          positioning: 'Category leader with a track record you can verify.',
          target_audience: 'Skeptical buyers burned by hype before.',
        },
      ],
      hooks: [
        { text: 'Still doing this by hand?', angle_index: 0, format: 'headline' },
        { text: 'The old way costs more than you think.', angle_index: 1, format: 'headline' },
        { text: 'Here is what changed after one week.', angle_index: 0, format: 'first_line' },
        { text: 'Most people get this wrong on day one.', angle_index: 2, format: 'video_opener' },
        { text: 'Trusted by teams who hate wasting time.', angle_index: 2, format: 'headline' },
      ],
      ad_copy_variants: [
        {
          headline: 'Get hours back every week',
          body: 'Stop fighting the manual process. See how operators reclaim their week.',
          cta: 'Learn more',
          angle_index: 0,
        },
        {
          headline: 'The hidden cost of the old way',
          body: 'Every month on the old workflow is money left on the table. Compare for yourself.',
          cta: 'See the comparison',
          angle_index: 1,
        },
        {
          headline: 'Proof, not promises',
          body: 'A category leader with results you can verify. Check the track record.',
          cta: 'See the proof',
          angle_index: 2,
        },
      ],
      creative_briefs: [
        {
          format: 'UGC video',
          description: 'Operator talks through their before/after in a casual selfie style.',
          key_visual: 'Split screen: cluttered manual process vs clean dashboard.',
          tone: 'Honest, relatable.',
        },
        {
          format: 'Static carousel',
          description: 'Swipe-through of 3 cost-of-inaction stats ending on the offer.',
          key_visual: 'Bold numbers on a clean background.',
          tone: 'Direct, data-led.',
        },
        {
          format: 'Founder explainer',
          description: 'Short talking-head establishing credibility and track record.',
          key_visual: 'Founder on camera with logo lower-third.',
          tone: 'Confident, trustworthy.',
        },
      ],
      landing_structure: {
        above_fold: 'Lead with the time-saved promise + a single clear CTA.',
        main_argument: 'The manual way is slow and costly; this is the verifiable faster path.',
        proof_elements: ['Verified results', 'Recognizable customers', 'Clear refund policy'],
        cta: 'Start now',
        objections_addressed: ['Is it worth the price?', 'Will it actually work for me?'],
      },
      tracking_plan: {
        primary_kpi: 'EPC',
        secondary_kpis: ['CTR', 'CVR', 'CPC'],
        measurement_tools: ['Platform pixel', 'Affiliate network postback'],
      },
      kpi_targets: {
        ctr_target: 1.2,
        cpc_target: 1.1,
        cvr_target: 3.0,
        epc_target: 1.2,
      },
      kill_criteria: ['EPC below $0.60 after $300 spend', 'CTR below 0.8% after 10k impressions'],
      scale_criteria: ['EPC above $1.20 across 2+ angles', 'Stable CVR over 5 days'],
      compliance_warnings: ['Mock output — review all copy against the vertical compliance rules.'],
    },
  }
}

export function mockForOrchestrator(orchestratorName: string): Record<string, unknown> {
  switch (orchestratorName) {
    case 'SourceExtractionOrchestrator':
      return mockSourceExtraction()
    case 'TestKitOrchestrator':
      return mockTestKit()
    case 'UnderwritingOrchestrator':
    default:
      return mockUnderwriting()
  }
}
