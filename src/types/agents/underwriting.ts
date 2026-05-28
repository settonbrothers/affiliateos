import { z } from 'zod'

import { UniversalEnvelopeSchema } from './envelope'

export const ScoreDimensionSchema = z.object({
  economics: z.number().int().min(0).max(100),
  demand: z.number().int().min(0).max(100),
  competition: z.number().int().min(0).max(100),
  creative_opportunity: z.number().int().min(0).max(100),
  funnel_fit: z.number().int().min(0).max(100),
  compliance: z.number().int().min(0).max(100),
  operator_fit: z.number().int().min(0).max(100),
  data_confidence: z.number().int().min(0).max(100),
  offer_trust: z.number().int().min(0).max(100),
  scale_potential: z.number().int().min(0).max(100),
  cashflow_fit: z.number().int().min(0).max(100),
  high_ceiling_potential: z.number().int().min(0).max(100),
  execution_complexity: z.number().int().min(0).max(100),
})

export const VERDICTS = [
  'reject',
  'watch',
  'organic_only',
  'seo_review_only',
  'small_paid_test',
  'strong_test',
  'strategic_opportunity',
  'high_ceiling_opportunity',
] as const

export const UnderwritingPayloadSchema = z.object({
  scores: ScoreDimensionSchema,
  weighted_score: z.number().int().min(0).max(100),
  verdict: z.enum(VERDICTS),
  recommended_channel: z
    .enum([
      'paid_social',
      'google_ads',
      'native',
      'youtube',
      'email',
      'seo',
      'organic_social',
    ])
    .nullable(),
  recommended_geo: z.array(z.string()),
  minimum_test_budget_usd: z.number().nullable(),
  recommended_test_budget_usd: z.number().nullable(),
  main_reason_to_test: z.string(),
  main_reason_to_avoid: z.string(),
  warnings: z.object({
    trust: z.string().nullable(),
    scale: z.string().nullable(),
    cashflow: z.string().nullable(),
    compliance: z.string().nullable(),
  }),
  kill_criteria: z.array(z.string()),
  scale_criteria: z.array(z.string()),
  verdict_caps_applied: z.array(z.string()),
})

export const UnderwritingResponseSchema = UniversalEnvelopeSchema.extend({
  payload: UnderwritingPayloadSchema,
})

export type UnderwritingResponse = z.infer<typeof UnderwritingResponseSchema>
export type ScoreDimensions = z.infer<typeof ScoreDimensionSchema>
export type Verdict = (typeof VERDICTS)[number]

// Human-readable labels for the 13 scorecard dimensions (UI rendering order).
export const SCORE_DIMENSION_LABELS: Record<keyof ScoreDimensions, string> = {
  economics: 'Economics',
  demand: 'Demand',
  competition: 'Competition',
  creative_opportunity: 'Creative Opportunity',
  funnel_fit: 'Funnel Fit',
  compliance: 'Compliance',
  operator_fit: 'Operator Fit',
  data_confidence: 'Data Confidence',
  offer_trust: 'Offer Trust',
  scale_potential: 'Scale Potential',
  cashflow_fit: 'Cashflow Fit',
  high_ceiling_potential: 'High-Ceiling Potential',
  execution_complexity: 'Execution Complexity',
}

export const VERDICT_LABELS: Record<Verdict, string> = {
  reject: 'Reject',
  watch: 'Watch',
  organic_only: 'Organic Only',
  seo_review_only: 'SEO Review Only',
  small_paid_test: 'Small Paid Test',
  strong_test: 'Strong Test',
  strategic_opportunity: 'Strategic Opportunity',
  high_ceiling_opportunity: 'High-Ceiling Opportunity',
}
