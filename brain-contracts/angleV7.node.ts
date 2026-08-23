import { z } from 'zod'

export const PositiveDifferentiationV7Schema = z.object({
  offer_strength: z.string().min(1),
  offer_strength_source_ids: z.array(z.string().min(1)).min(1),
  market_claim_mode: z.enum(['offer_only', 'verified_comparison', 'verified_uniqueness']),
  market_claim: z.string().nullable(),
  market_claim_evidence_ids: z.array(z.string().min(1)),
  competitor_denigration_used: z.literal(false),
}).strict()

export const CausalDependencyTestV7Schema = z.object({
  removed_offer_mechanism: z.string().min(1),
  reader_problem_still_resolves: z.literal(false),
  explanation: z.string().min(1),
}).strict()

export const ConversionSpineV7Schema = z.object({
  person: z.string().min(1),
  unmet_need_now: z.string().min(1),
  scene_evidence: z.string().min(1),
  consequence_without_offer: z.string().min(1),
  truth_sources: z.array(z.string().min(1)).min(1),
  dominant_emotional_peak: z.string().min(1),
  build_to_peak: z.array(z.string().min(1)).min(1),
  offer_mechanism: z.string().min(1),
  why_offer_is_causal_solution: z.string().min(1),
  unresolved_at_ask: z.string().min(1),
  causal_dependency_test: CausalDependencyTestV7Schema,
}).strict()

export const AngleV7Schema = z.object({
  name: z.string().min(1),
  positioning: z.string().min(1),
  rooted_in: z.string().min(1),
  positive_differentiation: PositiveDifferentiationV7Schema,
  narrative_license: z.object({}).passthrough(),
  conversion_spine: ConversionSpineV7Schema.nullable(),
  is_recommended: z.boolean(),
}).strict()

export const AnglesV7Schema = z.object({
  angles: z.array(AngleV7Schema).min(1).max(5),
}).strict()
