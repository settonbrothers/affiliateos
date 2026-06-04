// Deno copy of src/types/agents/testKit.ts. See decisions/003 — KEEP IN SYNC
// with the Node-side copy. Shape mirrors docs/plan/05_AGENT_ROSTER.md.
import { z } from 'npm:zod@^3.24.0'

import { UniversalEnvelopeSchema } from './envelope.ts'

export const TRAFFIC_CHANNELS = [
  'paid_social',
  'google_ads',
  'native',
  'youtube',
  'email',
  'seo',
  'organic_social',
] as const

const AngleSchema = z.object({
  name: z.string(),
  positioning: z.string(),
  target_audience: z.string(),
})

const HookSchema = z.object({
  text: z.string(),
  angle_index: z.number().int().min(0),
  format: z.enum(['headline', 'first_line', 'video_opener']),
})

const AdCopyVariantSchema = z.object({
  headline: z.string(),
  body: z.string(),
  cta: z.string(),
  angle_index: z.number().int().min(0),
})

const CreativeBriefSchema = z.object({
  format: z.string(),
  description: z.string(),
  key_visual: z.string(),
  tone: z.string(),
})

export const TestKitPayloadSchema = z.object({
  test_objective: z.string(),
  channel_plan: z.object({
    primary: z.enum(TRAFFIC_CHANNELS),
    secondary: z.enum(TRAFFIC_CHANNELS).nullable(),
    reasoning: z.string(),
  }),
  budget_plan: z.object({
    minimum_usd: z.number(),
    recommended_usd: z.number(),
    max_initial_usd: z.number(),
    reasoning: z.string(),
  }),
  geo_plan: z.object({
    primary: z.array(z.string()),
    secondary: z.array(z.string()).nullable(),
    reasoning: z.string(),
  }),
  audience_direction: z.string(),
  angles: z.array(AngleSchema).min(2).max(4),
  hooks: z.array(HookSchema).min(4).max(12),
  ad_copy_variants: z.array(AdCopyVariantSchema).min(2).max(4),
  creative_briefs: z.array(CreativeBriefSchema).min(2).max(6),
  landing_structure: z.object({
    above_fold: z.string(),
    main_argument: z.string(),
    proof_elements: z.array(z.string()),
    cta: z.string(),
    objections_addressed: z.array(z.string()),
  }),
  tracking_plan: z.object({
    primary_kpi: z.string(),
    secondary_kpis: z.array(z.string()),
    measurement_tools: z.array(z.string()),
  }),
  kpi_targets: z.object({
    ctr_target: z.number(),
    cpc_target: z.number(),
    cvr_target: z.number(),
    epc_target: z.number(),
  }),
  kill_criteria: z.array(z.string()),
  scale_criteria: z.array(z.string()),
  compliance_warnings: z.array(z.string()),
})

export const TestKitResponseSchema = UniversalEnvelopeSchema.extend({
  payload: TestKitPayloadSchema,
})

export type TestKitResponse = z.infer<typeof TestKitResponseSchema>
export type TestKitPayload = z.infer<typeof TestKitPayloadSchema>
