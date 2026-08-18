import { z } from 'npm:zod@^3.24.0'

export const BrainAnchorSchema = z.enum([
  'quote',
  'category_inference',
  'unknown',
])
export const AnchoredFieldSchema = z
  .object({
    value: z.string().nullable(),
    anchor: BrainAnchorSchema,
    source: z.string().nullable(),
  })
  .superRefine((field, ctx) => {
    if (field.anchor === 'unknown' && field.value !== null)
      ctx.addIssue({ code: 'custom', message: 'unknown fields must be null' })
    if (field.anchor !== 'unknown' && !field.value?.trim())
      ctx.addIssue({
        code: 'custom',
        message: 'anchored fields require a value',
      })
    if (field.anchor === 'quote' && !field.source?.trim())
      ctx.addIssue({ code: 'custom', message: 'quotes require a source' })
  })

const fearLadder = z.object({
  surface_fear: AnchoredFieldSchema,
  deep_fear: AnchoredFieldSchema,
  wordless_fear: AnchoredFieldSchema,
})
const dreams = z.object({
  near_dream: AnchoredFieldSchema,
  deep_dream: AnchoredFieldSchema,
  identity_dream: AnchoredFieldSchema,
})

export const DeepAvatarV2Schema = z.object({
  schema_version: z.literal('deep-avatar-v2'),
  offer_id: z.string().min(1),
  segment_name: z.string().min(1),
  identity: z.object({
    portrait: AnchoredFieldSchema,
    week_texture: AnchoredFieldSchema,
    identity_gap: AnchoredFieldSchema,
  }),
  emotion_map: z.object({
    fear_ladder: fearLadder,
    three_am_thoughts: AnchoredFieldSchema,
    shame_and_hiding: AnchoredFieldSchema,
    dreams,
    envy_comparison: AnchoredFieldSchema,
  }),
  belief_map: z.object({
    cause_theory: AnchoredFieldSchema,
    who_is_blamed: AnchoredFieldSchema,
    solution_beliefs: AnchoredFieldSchema,
    past_attempts_scars: AnchoredFieldSchema,
  }),
  market_position: z.object({
    awareness_sophistication: z.object({
      awareness_stage: z.enum([
        'unaware',
        'problem_aware',
        'solution_aware',
        'product_aware',
        'most_aware',
      ]),
      sophistication_stage: z.number().int().min(1).max(5),
      entry_point_note: z.string().min(1),
      anchor: BrainAnchorSchema,
    }),
    already_seen: AnchoredFieldSchema,
    consumer_trust_wounds: AnchoredFieldSchema,
  }),
  buying_psychology: z.object({
    stated_vs_real_objection: z.object({
      stated: z.string().min(1),
      real: z.string().min(1),
      anchor: BrainAnchorSchema,
    }),
    purchase_context: AnchoredFieldSchema,
    internal_price_anchor: AnchoredFieldSchema,
    permission_needed: AnchoredFieldSchema,
    decision_moment: AnchoredFieldSchema,
  }),
  action_fields: z.object({
    voc_lines: z.array(
      z.object({
        line: z.string().min(1),
        anchor: BrainAnchorSchema,
        source: z.string().nullable(),
      })
    ),
    the_one_trigger: AnchoredFieldSchema,
    transformation_arc: AnchoredFieldSchema,
    forbidden_word: AnchoredFieldSchema,
  }),
  summary: z.object({
    core_identity: z.string(),
    current_state: z.array(z.string()),
    central_problem_in_their_words: z.string().nullable(),
    pains: z.array(z.string()),
    psychological_drivers: z.array(z.string()),
    desired_result: z.string(),
    product_meaning: z.string(),
  }),
  declared_gaps: z.array(z.string()),
})

export const LegacyAvatarV1Schema = z.object({
  who: z.string(),
  life_situation: z.string(),
  pain_points: z.array(z.string()),
  objections: z.array(z.string()),
  desires: z.array(z.string()),
  voice_of_customer: z.array(z.string()),
  transformation: z.string(),
  emotional_trigger: z.string(),
  trust_signals: z.array(z.string()),
})
export const StoredAvatarSchema = z.union([
  DeepAvatarV2Schema,
  LegacyAvatarV1Schema,
])
export const BrainSourceSchema = z.object({
  source_id: z.string(),
  source_type: z.enum([
    'network_platform',
    'independent_research',
    'independent_review',
    'first_party_document',
    'operator_note',
    'spy_example',
    'campaign_result',
  ]),
  source_url: z.string().url().nullable(),
  source_quote: z.string().nullable(),
  claim: z.string(),
  priority: z.number().int().min(1).max(5),
  verified: z.boolean(),
  snapshot_sha256: z.string().regex(/^[a-f0-9]{64}$/),
})
export const PerformanceWinnerSchema = z.object({
  winner_id: z.string(),
  offer_id: z.string(),
  campaign_id: z.string(),
  creative_id: z.string().nullable(),
  hook: z.string(),
  metrics: z.record(z.string(), z.number()),
  decision_rule: z.string(),
  source_ref: z.string(),
})
export const CopyBrainInputSnapshotV1Schema = z.object({
  schema_version: z.literal('copy-brain-input-v1'),
  snapshot_id: z.string(),
  captured_at: z.string().datetime(),
  origin: z.enum(['affx', 'synthetic_fixture']),
  fixture_only: z.boolean(),
  offer: z.object({
    id: z.string(),
    name: z.string(),
    website_url: z.string().url().nullable(),
    affiliate_program_url: z.string().url().nullable(),
    network: z.string().nullable(),
    vendor_name: z.string().nullable(),
    vertical: z.string().nullable(),
    primary_language: z.string().nullable(),
    description: z.string().nullable(),
  }),
  campaign_context: z.object({
    channel: z.string().nullable(),
    geo: z.array(z.string()),
    audience: z.string().nullable(),
    generation_language: z.literal('he'),
  }),
  underwriting: z.record(z.string(), z.unknown()).nullable(),
  compliance: z.record(z.string(), z.unknown()).nullable(),
  sources: z.array(BrainSourceSchema),
  research_documents: z.array(z.record(z.string(), z.unknown())),
  deep_brief: z.record(z.string(), z.unknown()).nullable(),
  spy_analyses: z.array(z.record(z.string(), z.unknown())),
  market_examples: z.array(z.record(z.string(), z.unknown())),
  performance_winners: z.array(PerformanceWinnerSchema),
  avatar: StoredAvatarSchema.nullable(),
  test_kit: z.record(z.string(), z.unknown()).nullable(),
  taste_corpus: z.array(z.record(z.string(), z.unknown())),
  hook_library: z.array(z.record(z.string(), z.unknown())),
  creative_hint: z.string().nullable(),
  missing_inputs: z.array(z.string()),
  omitted_context: z.array(
    z.object({
      section: z.string(),
      reason: z.string(),
      source_refs: z.array(z.string()),
    })
  ),
  snapshot_sha256: z.string().regex(/^[a-f0-9]{64}$/),
})

export type DeepAvatarV2 = z.infer<typeof DeepAvatarV2Schema>
export type StoredAvatar = z.infer<typeof StoredAvatarSchema>
export type CopyBrainInputSnapshotV1 = z.infer<
  typeof CopyBrainInputSnapshotV1Schema
>
