import { z } from 'zod'
const ObjectiveSchema = z.object({ objective_type: z.enum(['sale','lead','donation','trial','signup','affiliate_recruitment','unknown']), desired_action: z.string().nullable(), audience_side: z.enum(['consumer','affiliate_marketer','donor','unknown']), source: z.enum(['campaign_context','deep_brief','test_kit','explicit_eval_override','unknown']) }).strict()
const DeliveryLanguageSchema = z.object({ language: z.string().min(2), source: z.enum(['campaign_context','offer_market','explicit_eval_override','unknown']), operator_language_independent: z.literal(true) }).strict()
const AudienceSchema = z.object({ summary: z.string().nullable(), awareness: z.string().nullable(), sophistication: z.number().int().min(1).max(5).nullable(), avatar_ref: z.string().nullable(), avatar_completeness: z.number().min(0).max(1), voc: z.array(z.record(z.string(), z.unknown())), source: z.enum(['campaign_context','avatar_v2','explicit_eval_override','unknown']) }).strict()
const TasteSelectionSchema = z.object({ selected: z.array(z.record(z.string(), z.unknown())).max(6), excluded: z.array(z.record(z.string(), z.unknown())), selection_policy: z.string().min(1), requirement_status: z.enum(['loaded', 'none_available']) }).strict()
const NarrativePolicySchema = z.object({ profile: z.literal('owner_creative_truth_v1'), synthetic_characters: z.literal('allowed'), synthetic_names_dialogue_quotes: z.literal('allowed'), testimonial_style_framing: z.literal('allowed_without_disclosure'), material_product_claims: z.literal('evidence_bounded') }).strict()
export const CopyExecutionBriefV2Schema = z.object({
  schema_version: z.literal('copy-execution-brief-v2'), brief_id: z.string().min(1), snapshot_id: z.string().min(1), readiness_status: z.enum(['ready_to_write','needs_avatar','needs_audience','needs_objective','needs_language','objective_conflict','blocked']),
  consumer_offer: z.object({ offer_id: z.string().min(1), name: z.string().min(1), description: z.string().nullable(), vertical: z.string().nullable(), destination_url: z.string().nullable(), promise_source_refs: z.array(z.string()) }).strict(),
  affiliate_program: z.object({ program_url: z.string().nullable(), network: z.string().nullable(), vendor: z.string().nullable(), internal_only: z.literal(true) }).strict(),
  campaign_objective: ObjectiveSchema, delivery_language: DeliveryLanguageSchema, audience: AudienceSchema,
  evidence: z.object({ verified_claims: z.array(z.record(z.string(), z.unknown())), source_refs: z.array(z.string()), forbidden_claims: z.array(z.string()), narrative_readiness: z.enum(['documented_case','evidence_based_dramatization','non_story','blocked','unresolved']) }).strict(),
  upstream_context: z.object({ deep_brief: z.record(z.string(), z.unknown()).nullable(), test_kit: z.unknown(), spy_analyses: z.array(z.record(z.string(), z.unknown())), market_examples: z.array(z.record(z.string(), z.unknown())), performance_winners: z.array(z.record(z.string(), z.unknown())), omitted_context: z.array(z.record(z.string(), z.unknown())) }).strict(),
  taste_selection: TasteSelectionSchema,
  narrative_policy: NarrativePolicySchema.optional(),
  doctrine_bundle: z.object({ bundle_version: z.literal('latest-owner-doctrine-v3'), registry_version: z.string().min(1), active_lesson_ids: z.array(z.string()).min(1), superseded_lesson_ids: z.array(z.string()), checksum: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  internal_economics: z.record(z.string(), z.unknown()).nullable(), critical_missing: z.array(z.string()), conflicts: z.array(z.record(z.string(), z.unknown())),
  trace: z.object({ input_sections_consumed: z.array(z.string()), input_sections_rejected: z.array(z.string()), lesson_routes: z.array(z.record(z.string(), z.unknown())), applied_policy_profiles: z.array(z.string()).optional(), warnings: z.array(z.string()) }).strict()
}).strict()
export type CopyExecutionBriefV2 = z.infer<typeof CopyExecutionBriefV2Schema>
