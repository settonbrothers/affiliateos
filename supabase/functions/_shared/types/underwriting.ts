// Deno copy of src/types/agents/underwriting.ts. See decisions/003.
// KEEP IN SYNC with the Node-side copy.
import { z } from 'npm:zod@^3.24.0'

import { UniversalEnvelopeSchema } from './envelope.ts'

// One of the 13 dimensions.
//
// The prompt has always asked for "each scored 0-100, with one-sentence
// reasoning", but this was a bare z.number(): the reasoning had nowhere to go
// and the forced-tool schema dropped it, leaving the operator with 13 bars and
// no explanation of any of them. A fresh run must now supply both.
export const DimensionScoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  reasoning: z.string(),
})

// What may actually be sitting in ai_runs.output_payload. Every row written
// before this change stores a bare number, and those rows are what the offer
// list and the scorecard read — so the read path accepts either shape. Same
// split as StoredDeepAnalysisSchema in src/lib/discovery/promote.ts: strict for
// what we ask a model to produce, tolerant for what is already on disk.
export const StoredDimensionScoreSchema = z.union([
  z.number().int().min(0).max(100),
  DimensionScoreSchema,
])

const dimensions = <T extends z.ZodTypeAny>(dim: T) =>
  z.object({
    economics: dim,
    demand: dim,
    competition: dim,
    creative_opportunity: dim,
    funnel_fit: dim,
    compliance: dim,
    operator_fit: dim,
    data_confidence: dim,
    offer_trust: dim,
    scale_potential: dim,
    cashflow_fit: dim,
    high_ceiling_potential: dim,
    execution_complexity: dim,
  })

export const ScoreDimensionSchema = dimensions(DimensionScoreSchema)
export const StoredScoreDimensionSchema = dimensions(StoredDimensionScoreSchema)

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

// The read-path twin: same payload, but tolerant of the pre-reasoning score
// shape. This is what types ai_runs.output_payload and offers.evaluation.
export const StoredUnderwritingResponseSchema = UniversalEnvelopeSchema.extend({
  payload: UnderwritingPayloadSchema.extend({
    scores: StoredScoreDimensionSchema,
  }),
})

export type UnderwritingResponse = z.infer<typeof UnderwritingResponseSchema>
export type StoredUnderwritingResponse = z.infer<
  typeof StoredUnderwritingResponseSchema
>
export type ScoreDimensions = z.infer<typeof ScoreDimensionSchema>
export type StoredScoreDimensions = z.infer<typeof StoredScoreDimensionSchema>
export type StoredDimensionScore = z.infer<typeof StoredDimensionScoreSchema>
export type Verdict = (typeof VERDICTS)[number]

/** Flatten either dimension shape. Pre-reasoning rows have none to show. */
export function normalizeDimension(value: StoredDimensionScore | undefined): {
  score: number
  reasoning: string | null
} {
  if (typeof value === 'number') return { score: value, reasoning: null }
  if (!value) return { score: 0, reasoning: null }
  return { score: value.score, reasoning: value.reasoning || null }
}

// Human-readable labels for the 13 scorecard dimensions (UI rendering order).
export const SCORE_DIMENSION_LABELS: Record<
  keyof StoredScoreDimensions,
  string
> = {
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
