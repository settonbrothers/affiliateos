// Deno copy of src/types/agents/underwriting.ts. See decisions/003.
// KEEP IN SYNC with the Node-side copy.
import { z } from 'npm:zod@^3.24.0'

import { UniversalEnvelopeSchema } from './envelope.ts'

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
