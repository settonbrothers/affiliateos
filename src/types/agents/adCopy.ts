// Node-side AdCopyOrchestrator contract (Execute Layer — Phase 1: Facebook ad copy).
// See decisions/003 — KEEP IN SYNC with supabase/functions/_shared/types/adCopy.ts (Deno copy).
// Pipeline: ProductExcavate + AvatarExcavate -> Angle -> Hook -> Copy(he+en) -> Judge/Refine(<=2).
import { z } from 'zod'

import { UniversalEnvelopeSchema } from './envelope'

// Phase 1 generates copy natively in both languages (transcreation, not translation).
export const AD_COPY_LANGS = ['he', 'en'] as const

// Leg 1 of excavation: the product. What it truly solves — not feature-listing.
export const ProductExcavationSchema = z.object({
  real_problem: z.string(),
  real_solution: z.string(),
  why_better: z.string(),
  key_differentiators: z.array(z.string()).min(1),
})

// Leg 2 of excavation: the avatar. Copy foundation — NOT audience targeting (that is Phase 3).
export const AvatarExcavationSchema = z.object({
  who: z.string(),
  pain_points: z.array(z.string()).min(1), // in the reader's own words
  objections: z.array(z.string()),
  desires: z.array(z.string()).min(1),
  voice_of_customer: z.array(z.string()), // phrases/language cues to echo
})

export const AdCopyAngleSchema = z.object({
  name: z.string(),
  positioning: z.string(),
  rooted_in: z.string(), // which excavation insight this angle is born from
})

export const AdCopyHookSchema = z.object({
  text: z.string(),
  angle_index: z.number().int().min(0),
  lang: z.enum(AD_COPY_LANGS),
  is_recommended: z.boolean().optional(),
})

// A Facebook ad copy variant in one language.
export const FacebookAdVariantSchema = z.object({
  lang: z.enum(AD_COPY_LANGS),
  primary_text: z.string(),
  headline: z.string(),
  subheadline: z.string().optional(),
  hook: z.string(),
  cta_button: z.string().optional(),
  angle_index: z.number().int().min(0),
})

// Judge scores against Izhak's 3 principles. Advisory (non-blocking) until the
// judge is calibrated against the human-labelled Taste Corpus.
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
  calibrated: z.boolean(), // false until calibrated vs Taste Corpus
  notes: z.string(),
})

export const AdCopyPayloadSchema = z.object({
  product_excavation: ProductExcavationSchema,
  avatar_excavation: AvatarExcavationSchema,
  angles: z.array(AdCopyAngleSchema).min(2).max(5),
  hooks: z.array(AdCopyHookSchema).min(4),
  // Both languages present; bounds lenient so one off-by-one doesn't force a retry.
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
