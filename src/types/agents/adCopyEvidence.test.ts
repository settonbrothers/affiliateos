import { describe, expect, it } from 'vitest'

import {
  CopyDepartmentPlanSchema,
  CREATIVE_DEPARTMENT_FOUNDATION,
  EvidenceEnvelopeSchema,
  EvidenceHookSchema,
  EvidenceVariantSchema,
} from './adCopyEvidence'

describe('EvidenceEnvelopeSchema', () => {
  it('accepts a frozen owner-verified general condition', () => {
    const result = EvidenceEnvelopeSchema.safeParse({
      research_status: 'ready',
      real_problem: 'An approved stop is not funded.',
      real_solution: 'Fund the bounded delivery.',
      sources: [
        {
          source_id: 'owner-1',
          publisher_id: 'owner-ledger',
          source_type: 'owner_verified_general_fact',
          independence: 'owner_verified',
          quality: 'high',
          claim: 'Without funding, that delivery does not happen.',
          actual_person: false,
          source_url: null,
          source_quote: null,
          snapshot_sha256: 'a'.repeat(64),
        },
      ],
      supported_outcomes: [
        {
          outcome_id: 'delivery',
          statement: 'That delivery happens.',
          intensity_ceiling: 'The specific delivery only.',
          evidence_basis: 'owner_verified_general_condition',
          source_ids: ['owner-1'],
          typicality: 'representative',
        },
      ],
      allowed_scene_inventions: ['synthetic_person', 'setting'],
      source_required_elements: [
        'outcome',
        'quotation',
        'testimonial_attribution',
      ],
      forbidden_escalations: ['hunger'],
      vulnerability_constraints: ['Do not stack unsupported severity.'],
      missing_data: [],
    })
    expect(result.success).toBe(true)
  })
})

describe('agency foundations', () => {
  it('accepts the native campaign language on hooks and copy', () => {
    expect(
      EvidenceHookSchema.safeParse({
        text: 'The next caller should not have to wait.',
        angle_index: 0,
        lang: 'en',
        payoff_anchor: 'The caller keeps moving.',
      }).success
    ).toBe(true)
    expect(
      EvidenceVariantSchema.safeParse({
        lang: 'en',
        primary_text: 'Native campaign copy.',
        headline: 'Keep the caller moving',
        hook: 'The phone rang while both hands were busy.',
        angle_index: 0,
        block_ids: ['b1'],
        line_purpose_map: [],
      }).success
    ).toBe(true)
  })

  it('accepts a director plan with materially distinct specialists', () => {
    const result = CopyDepartmentPlanSchema.safeParse({
      schema_version: 'copy-department-v1',
      is_anchor_ad: false,
      story_feasibility: 'not_required',
      dominant_emotional_center: null,
      why_not_story: 'This test covers a short proof-led format.',
      primary_specialist: 'proof_mechanism',
      challenger_specialist: 'direct_response',
      routing_reason: 'Proof is the main reason to believe.',
      candidate_briefs: [
        {
          candidate_id: 'proof-1',
          specialist: 'proof_mechanism',
          test_hypothesis: 'Mechanism clarity increases qualified clicks.',
          reader_change: 'Skepticism becomes bounded belief.',
          evidence_anchor_ids: ['study-1'],
          spy_influence: 'Observed category language only.',
          material_difference: 'Tests proof before pain.',
          angle_index: 0,
        },
        {
          candidate_id: 'dr-1',
          specialist: 'direct_response',
          test_hypothesis: 'Immediate problem recognition increases action.',
          reader_change: 'Latent pain becomes an active decision.',
          evidence_anchor_ids: ['review-1'],
          spy_influence: 'Avoids the saturated promise.',
          material_difference: 'Tests cost of inaction before mechanism.',
          angle_index: 1,
        },
      ],
      diversity_limitations: [],
    })
    expect(result.success).toBe(true)
  })

  it('requires the director to make the anchor and story decision', () => {
    const result = CopyDepartmentPlanSchema.safeParse({
      schema_version: 'copy-department-v1',
      primary_specialist: 'proof_mechanism',
      challenger_specialist: null,
      routing_reason: 'Legacy plan without the current routing decision.',
      candidate_briefs: [],
      diversity_limitations: [],
    })

    expect(result.success).toBe(false)
    if (result.success)
      throw new Error('Legacy director plan unexpectedly passed')
    expect(result.error.issues.map((issue) => issue.path.join('.'))).toEqual(
      expect.arrayContaining([
        'is_anchor_ad',
        'story_feasibility',
        'dominant_emotional_center',
        'why_not_story',
      ])
    )
  })

  it('keeps the visual department present but disabled', () => {
    expect(CREATIVE_DEPARTMENT_FOUNDATION.activation).toBe(
      'foundation_only_not_runtime_enabled'
    )
    expect(CREATIVE_DEPARTMENT_FOUNDATION.specialists).toHaveLength(2)
  })
})
