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

export type DiagnosisResultsInput = {
  spend_usd: number
  impressions: number
  clicks: number
  landing_views: number
  conversions: number
  revenue_usd: number
  days_running: number
}

export function mockDiagnosis(
  results?: DiagnosisResultsInput
): Record<string, unknown> {
  const r = results ?? {
    spend_usd: 500,
    impressions: 100000,
    clicks: 900,
    landing_views: 800,
    conversions: 6,
    revenue_usd: 420,
    days_running: 5,
  }
  const ctr = r.impressions ? (r.clicks / r.impressions) * 100 : 0
  const cpc = r.clicks ? r.spend_usd / r.clicks : 0
  const cvr = r.clicks ? (r.conversions / r.clicks) * 100 : 0
  const epc = r.clicks ? r.revenue_usd / r.clicks : 0
  const clickout = r.clicks ? (r.landing_views / r.clicks) * 100 : 0
  const thin = r.clicks < 100 || r.conversions < 5
  const m = (actual: number, lo: number, hi: number) => ({
    actual: Math.round(actual * 100) / 100,
    expected: [lo, hi] as [number, number],
    verdict: (actual < lo ? 'below' : actual > hi ? 'above' : 'within') as
      | 'below'
      | 'within'
      | 'above',
  })

  return {
    ...envelope('DiagnosisOrchestrator'),
    confidence_score: thin ? 35 : 70,
    assumptions: ['Mock output — not a real diagnosis.'],
    human_review_required: thin,
    human_review_reasons: thin ? ['Not enough data for a confident read.'] : [],
    payload: {
      diagnosis_summary: thin
        ? 'Sample is too thin to draw a confident conclusion — keep gathering data.'
        : 'Clicks are healthy but conversion rate lags expectations; the bottleneck is likely the landing page.',
      data_quality_assessment: thin
        ? 'Low volume: fewer than 100 clicks or 5 conversions.'
        : 'Adequate click volume for a directional read; conversions still light.',
      metric_analysis: {
        ctr: m(ctr, 0.8, 2.0),
        cpc: m(cpc, 0.5, 1.5),
        clickout_rate: m(clickout, 60, 95),
        cvr: m(cvr, 2.0, 5.0),
        epc: m(epc, 0.8, 1.5),
      },
      primary_bottleneck: thin ? 'not_enough_data' : 'landing_page',
      secondary_bottlenecks: thin ? [] : ['offer'],
      recommended_action: thin ? 'continue_test' : 'improve_landing',
      specific_recommendations: thin
        ? [
            {
              area: 'data',
              action: 'Run until at least 100 clicks and 5+ conversions.',
              reasoning: 'Current volume is below a reliable read.',
            },
          ]
        : [
            {
              area: 'landing_page',
              action: 'Tighten the above-fold promise and add proof near the CTA.',
              reasoning: 'CTR is fine but CVR is below range — the drop-off is post-click.',
            },
          ],
      not_enough_data: thin,
      not_enough_data_reason: thin
        ? 'Fewer than 100 clicks or 5 conversions.'
        : null,
    },
  }
}

export function mockCompliance(
  verticalSlug?: string
): Record<string, unknown> {
  const health = verticalSlug === 'health' || verticalSlug === 'mental_wellness'
  return {
    ...envelope('ComplianceCheckOrchestrator'),
    confidence_score: 70,
    assumptions: ['Mock output — not a real compliance review.'],
    payload: {
      overall_risk_level: health ? 'high' : 'low',
      compliance_score: health ? 45 : 85,
      detected_claims: health
        ? [
            {
              claim_type: 'medical_cure',
              claim_text: 'Supports liver health and detoxifies the body.',
              risk_level: 'high',
              why_risky:
                'Implies a disease/treatment benefit — FDA/FTC and Meta health-policy violation.',
              safe_framing: 'Part of a healthy lifestyle; describe ingredients, not outcomes.',
              forbidden_framing: 'Cures, detoxifies, or treats any condition.',
              requires_disclaimer: true,
            },
          ]
        : [],
      platform_risks: health ? ['meta_health_ads'] : [],
      geo_risks: [],
      tos_risks: [],
      required_disclaimers: health
        ? ['These statements have not been evaluated by the FDA.']
        : [],
      paid_traffic_recommendation: health ? 'blocked_until_review' : 'allowed',
    },
  }
}

// Deterministic spread: most are offers, every 3rd a reject, every 5th a
// container — so the funnel + mining are both exercised in mock mode.
export function mockDiscoveryTriage(count: number): Record<string, unknown> {
  return {
    results: Array.from({ length: count }, (_, i) => {
      const classification =
        i % 5 === 4 ? 'container' : i % 3 === 2 ? 'reject' : 'offer'
      return {
        index: i,
        classification,
        score: classification === 'offer' ? 70 + ((i * 7) % 25) : 30,
        reason:
          classification === 'container'
            ? 'Lists multiple programs — mine for the offers inside.'
            : classification === 'reject'
              ? 'Not a concrete affiliate offer.'
              : 'Plausible single affiliate program.',
      }
    }),
  }
}

// Discovery deep-analysis mock for one candidate — new rubric shape.
export function mockDiscoveryDeep(): Record<string, unknown> {
  return {
    overall_score: 78,
    summary: 'Mock deep analysis: solid recurring program, decent operator fit.',
    key_strengths: ['Recurring commission', 'Growing category'],
    key_risks: ['Smaller, lesser-known brand'],
    estimated_commission: '20% lifetime recurring',
    estimated_epc_band: '$0.80–1.60 EPC est.',
    network: 'in-house',
    recommended: true,
    must_verify_before_budget: [
      'Confirm paid-social is allowed with the affiliate manager',
    ],
    hard_filters: {
      economics: {
        status: 'pass',
        evidence: '20% lifetime recurring on the $149/mo plan',
        source_url: null,
      },
      paid_traffic: {
        status: 'unknown_verify',
        evidence: 'No paid-traffic policy stated on the page',
        source_url: null,
      },
      monetization_integrity: {
        status: 'pass',
        evidence: 'Net-30, PayPal/Stripe payouts',
        source_url: null,
      },
      scale_ceiling: {
        status: 'pass',
        evidence: 'No cap mentioned; growing category',
        source_url: null,
      },
    },
  }
}

// Mining mock: a couple of concrete offers "extracted" from a container page.
export function mockDiscoveryMine(): Record<string, unknown> {
  return {
    offers: [
      { name: 'Mined Offer One', url: 'https://mined-one.com/affiliates' },
      { name: 'Mined Offer Two', url: 'https://mined-two.com/partners' },
    ],
  }
}

export function mockForOrchestrator(orchestratorName: string): Record<string, unknown> {
  switch (orchestratorName) {
    case 'SourceExtractionOrchestrator':
      return mockSourceExtraction()
    case 'TestKitOrchestrator':
      return mockTestKit()
    case 'DiagnosisOrchestrator':
      return mockDiagnosis()
    case 'ComplianceCheckOrchestrator':
      return mockCompliance()
    case 'UnderwritingOrchestrator':
    default:
      return mockUnderwriting()
  }
}
