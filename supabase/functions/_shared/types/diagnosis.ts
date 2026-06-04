// Deno copy of src/types/agents/diagnosis.ts. See decisions/003 — KEEP IN SYNC
// with the Node-side copy.
import { z } from 'npm:zod@^3.24.0'

import { UniversalEnvelopeSchema } from './envelope.ts'

export const PRIMARY_BOTTLENECKS = [
  'offer',
  'creative',
  'hook',
  'angle',
  'landing_page',
  'geo',
  'audience',
  'traffic_source',
  'budget',
  'tracking',
  'compliance',
  'cashflow',
  'not_enough_data',
] as const

export const RECOMMENDED_ACTIONS = [
  'stop_test',
  'continue_test',
  'change_hook',
  'change_angle',
  'change_geo',
  'change_channel',
  'improve_landing',
  'change_audience',
  'reduce_budget',
  'increase_budget_carefully',
  'move_to_organic',
  'request_human_review',
  'generate_new_test_kit',
] as const

const MetricSchema = z.object({
  actual: z.number(),
  expected: z.tuple([z.number(), z.number()]),
  verdict: z.enum(['below', 'within', 'above']),
})

export const DiagnosisPayloadSchema = z.object({
  diagnosis_summary: z.string(),
  data_quality_assessment: z.string(),
  metric_analysis: z.object({
    ctr: MetricSchema,
    cpc: MetricSchema,
    clickout_rate: MetricSchema,
    cvr: MetricSchema,
    epc: MetricSchema,
  }),
  primary_bottleneck: z.enum(PRIMARY_BOTTLENECKS),
  secondary_bottlenecks: z.array(z.string()),
  recommended_action: z.enum(RECOMMENDED_ACTIONS),
  specific_recommendations: z.array(
    z.object({
      area: z.string(),
      action: z.string(),
      reasoning: z.string(),
    })
  ),
  not_enough_data: z.boolean(),
  not_enough_data_reason: z.string().nullable(),
})

export const DiagnosisResponseSchema = UniversalEnvelopeSchema.extend({
  payload: DiagnosisPayloadSchema,
})

export type DiagnosisResponse = z.infer<typeof DiagnosisResponseSchema>
export type DiagnosisPayload = z.infer<typeof DiagnosisPayloadSchema>
