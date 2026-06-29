// Deno copy of src/types/agents/adCopy.ts. See decisions/003 — KEEP IN SYNC
// with the Node-side copy. Execute Layer — Phase 1: Facebook ad copy.
// Pipeline: ProductExcavate + AvatarExcavate -> Angle -> Hook -> Copy(he+en) -> Judge/Refine(<=2).
import { z } from 'npm:zod@^3.24.0'

import { UniversalEnvelopeSchema } from './envelope.ts'

export const AD_COPY_LANGS = ['he', 'en'] as const

export const ProductExcavationSchema = z.object({
  real_problem: z.string(),
  real_solution: z.string(),
  why_better: z.string(),
  key_differentiators: z.array(z.string()).min(1),
})

export const AvatarExcavationSchema = z.object({
  who: z.string(),
  pain_points: z.array(z.string()).min(1),
  objections: z.array(z.string()),
  desires: z.array(z.string()).min(1),
  voice_of_customer: z.array(z.string()),
})

export const AdCopyAngleSchema = z.object({
  name: z.string(),
  positioning: z.string(),
  rooted_in: z.string(),
})

export const AdCopyHookSchema = z.object({
  text: z.string(),
  angle_index: z.number().int().min(0),
  lang: z.enum(AD_COPY_LANGS),
})

export const FacebookAdVariantSchema = z.object({
  lang: z.enum(AD_COPY_LANGS),
  primary_text: z.string(),
  headline: z.string(),
  hook: z.string(),
  angle_index: z.number().int().min(0),
})

export const JUDGE_PRINCIPLES = [
  'product_understanding',
  'eye_level_authentic',
  'depth_without_exaggeration',
] as const

export const JudgePrincipleResultSchema = z.object({
  principle: z.enum(JUDGE_PRINCIPLES),
  verdict: z.enum(['pass', 'fail']),
  reason: z.string(),
})

export const AdCopyJudgeSchema = z.object({
  principles: z.array(JudgePrincipleResultSchema).length(3),
  compliance_ok: z.boolean(),
  overall: z.enum(['pass', 'fail', 'advisory']),
  calibrated: z.boolean(),
  notes: z.string(),
})

export const AdCopyPayloadSchema = z.object({
  product_excavation: ProductExcavationSchema,
  avatar_excavation: AvatarExcavationSchema,
  angles: z.array(AdCopyAngleSchema).min(2).max(5),
  hooks: z.array(AdCopyHookSchema).min(4),
  variants: z.array(FacebookAdVariantSchema).min(2),
  judge: AdCopyJudgeSchema,
  refine_iterations: z.number().int().min(0).max(2),
})

export const AdCopyResponseSchema = UniversalEnvelopeSchema.extend({
  payload: AdCopyPayloadSchema,
})

export type AdCopyResponse = z.infer<typeof AdCopyResponseSchema>
export type AdCopyPayload = z.infer<typeof AdCopyPayloadSchema>
export type FacebookAdVariant = z.infer<typeof FacebookAdVariantSchema>
export type AdCopyJudge = z.infer<typeof AdCopyJudgeSchema>
