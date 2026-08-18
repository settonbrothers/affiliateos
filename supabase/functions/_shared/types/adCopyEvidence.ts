import { z } from 'npm:zod@^3.24.0'

import { UniversalEnvelopeSchema } from './envelope.ts'

export const EvidenceSourceSchema = z.object({
  source_id: z.string().min(1),
  publisher_id: z.string().min(1),
  source_type: z.enum([
    'documented_case',
    'customer_review',
    'independent_review',
    'study',
    'owner_verified_general_fact',
    'product_page',
    'program_record',
    'manual_note',
  ]),
  independence: z.enum(['independent', 'first_party', 'owner_verified']),
  quality: z.enum(['low', 'medium', 'high']),
  claim: z.string().min(1),
  actual_person: z.boolean(),
  source_url: z.string().nullable(),
  source_quote: z.string().nullable(),
  snapshot_sha256: z.string().regex(/^[a-f0-9]{64}$/),
})

export const SupportedOutcomeSchema = z.object({
  outcome_id: z.string().min(1),
  statement: z.string().min(1),
  intensity_ceiling: z.string().min(1),
  evidence_basis: z.enum([
    'single_documented_case',
    'review_convergence',
    'study_plus_review',
    'owner_verified_general_condition',
    'mechanism_only',
  ]),
  source_ids: z.array(z.string().min(1)).min(1),
  typicality: z.enum(['individual_only', 'representative', 'unknown']),
})

export const EvidenceEnvelopeSchema = z.object({
  research_status: z.enum([
    'ready',
    'story_insufficient_non_story_ready',
    'insufficient',
  ]),
  real_problem: z.string(),
  real_solution: z.string(),
  sources: z.array(EvidenceSourceSchema),
  supported_outcomes: z.array(SupportedOutcomeSchema),
  allowed_scene_inventions: z.array(
    z.enum([
      'synthetic_name',
      'synthetic_person',
      'setting',
      'chronology',
      'mundane_action',
      'non_claim_dialogue',
      'sensory_detail',
    ])
  ),
  source_required_elements: z.array(
    z.enum([
      'outcome',
      'measurement',
      'diagnosis',
      'urgency',
      'scarcity',
      'quotation',
      'testimonial_attribution',
      'high_impact_vulnerability',
      'combined_vulnerability',
    ])
  ),
  forbidden_escalations: z.array(z.string().min(1)),
  vulnerability_constraints: z.array(z.string().min(1)),
  missing_data: z.array(z.string()),
})

export const NarrativeLicenseSchema = z.object({
  mode: z.enum([
    'documented_case',
    'evidence_based_dramatization',
    'non_story',
    'blocked',
  ]),
  decision_reason: z.string().min(1),
  basis_outcome_ids: z.array(z.string().min(1)),
  character_status: z.enum(['real', 'synthetic', 'not_applicable']),
  voice_mode: z.enum([
    'actual_testimonial',
    'dramatized_first_person_disclosed',
    'third_person_scenario',
    'brand_narrated',
    'non_story',
  ]),
  disclosure_required: z.boolean(),
  allowed_inventions: z.array(z.string()),
  forbidden_inventions: z.array(z.string()),
  fallback_format: z.string().nullable(),
  requirements_met: z.boolean(),
})

export const ConversionSpineV4Schema = z.object({
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
  swap_test: z.object({
    replacement_offer: z.string().min(1),
    story_still_works: z.literal(false),
    conclusion: z.string().min(1),
  }),
})

export const EvidenceAngleSchema = z.object({
  name: z.string(),
  positioning: z.string(),
  rooted_in: z.string(),
  narrative_license: NarrativeLicenseSchema,
  conversion_spine: ConversionSpineV4Schema.nullable(),
  is_recommended: z.boolean(),
})

export const EvidenceHookSchema = z.object({
  text: z.string(),
  angle_index: z.number().int().min(0),
  lang: z.literal('he'),
  payoff_anchor: z.string(),
  is_recommended: z.boolean().optional(),
})
export const EvidenceVariantSchema = z.object({
  lang: z.literal('he'),
  primary_text: z.string(),
  headline: z.string(),
  subheadline: z.string().optional(),
  hook: z.string(),
  cta_button: z.string().optional(),
  angle_index: z.number().int().min(0),
  block_ids: z.array(z.string()),
  line_purpose_map: z.array(z.record(z.unknown())),
})

export const KillFlagV4Schema = z.enum([
  'no_dominant_peak',
  'unmet_need_not_scene',
  'problem_closed_before_ask',
  'offer_not_causal',
  'swap_test_passes',
  'wording_stronger_than_fact',
  'claim_violation',
  'evidence_threshold_unmet',
  'fake_testimonial',
  'disclosure_required',
  'invented_claim_detail',
  'vulnerability_stack',
  'missing_block_coverage',
  'wrong_audience',
  'weak_fold',
  'visual_density',
  'no_soul',
  'low_momentum',
  'boring',
])
export const BlindReaderSchema = z.object({
  perceived_attribution: z.enum([
    'actual_testimonial',
    'documented_case',
    'dramatization',
    'brand_argument',
    'unclear',
  ]),
  strongest_moment: z.string().nullable(),
  who_without_what: z.string(),
  why_offer_solves_it: z.string(),
  block_coverage: z.array(z.string()),
  concerns: z.array(z.string()),
})
export const EvidenceCriticSchema = z.object({
  kill_flags: z.array(KillFlagV4Schema),
  evidence: z.array(z.string()),
  intent_experience_mismatches: z.array(z.string()),
})
export const EvidenceJudgeSchema = z.object({
  principles: z
    .array(
      z.object({
        principle: z.enum([
          'product_understanding',
          'eye_level_authentic',
          'depth_without_exaggeration',
        ]),
        verdict: z.enum(['pass', 'fail']),
        reason: z.string(),
      })
    )
    .length(3),
  compliance_ok: z.boolean(),
  overall: z.enum(['pass', 'fail', 'advisory']),
  calibrated: z.literal(false),
  notes: z.string(),
  kill_flags: z.array(KillFlagV4Schema),
  evidence: z.array(z.string()),
})

export const AdCopyEvidencePayloadSchema = z.object({
  engine_version: z.literal('evidence-story-v4'),
  output_status: z.enum([
    'ready_for_user',
    'needs_evidence',
    'compliance_review',
    'blocked',
  ]),
  evidence_envelope: EvidenceEnvelopeSchema,
  narrative_license: NarrativeLicenseSchema,
  angles: z.array(EvidenceAngleSchema).min(1).max(5),
  hooks: z.array(EvidenceHookSchema),
  variants: z.array(EvidenceVariantSchema),
  reader_report: BlindReaderSchema.nullable(),
  critic_report: EvidenceCriticSchema.nullable(),
  judge: EvidenceJudgeSchema,
  refine_iterations: z.number().int().min(0).max(2),
  trace: z.object({
    source_snapshot_refs: z.array(z.string()),
    selected_angle_index: z.number().int().min(0).nullable(),
  }),
  user_message: z.string(),
})

export const AdCopyEvidenceResponseSchema = UniversalEnvelopeSchema.extend({
  payload: AdCopyEvidencePayloadSchema,
})
export type AdCopyEvidenceResponse = z.infer<
  typeof AdCopyEvidenceResponseSchema
>
