import { describe, expect, it } from 'vitest'

import { EvidenceEnvelopeSchema } from './adCopyEvidence'

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
