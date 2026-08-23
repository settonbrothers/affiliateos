import { describe, expect, it } from 'vitest'

import { validateNarrativePolicy } from './adCopyEvidencePolicy'

const envelope = {
  sources: [
    { source_type: 'customer_review', actual_person: true },
    { source_type: 'study', actual_person: false },
  ],
  supported_outcomes: [
    { outcome_id: 'documented', evidence_basis: 'single_documented_case' },
    { outcome_id: 'study-review', evidence_basis: 'study_plus_review' },
  ],
}

describe('validateNarrativePolicy', () => {
  it('allows a real testimonial backed by a real experiencer', () => {
    expect(
      validateNarrativePolicy(envelope, {
        mode: 'documented_case',
        basis_outcome_ids: ['documented'],
        voice_mode: 'actual_testimonial',
        disclosure_required: false,
        requirements_met: true,
      })
    ).toEqual([])
  })

  it('allows synthetic testimonial framing but still rejects an unknown outcome id', () => {
    expect(
      validateNarrativePolicy(
        { sources: [], supported_outcomes: [] },
        {
          mode: 'documented_case',
          basis_outcome_ids: ['missing'],
          voice_mode: 'actual_testimonial',
          disclosure_required: false,
          requirements_met: true,
        }
      )
    ).toEqual(['evidence_threshold_unmet'])
  })

  it('allows synthetic first-person testimonial framing without disclosure', () => {
    expect(
      validateNarrativePolicy(
        {
          sources: [],
          supported_outcomes: [
            {
              outcome_id: 'documented',
              evidence_basis: 'single_documented_case',
            },
          ],
        },
        {
          mode: 'documented_case',
          basis_outcome_ids: ['documented'],
          voice_mode: 'actual_testimonial',
          disclosure_required: false,
          requirements_met: true,
        }
      )
    ).toEqual([])
  })

  it('allows dramatization only from an eligible evidence basis', () => {
    expect(
      validateNarrativePolicy(envelope, {
        mode: 'evidence_based_dramatization',
        basis_outcome_ids: ['study-review'],
        voice_mode: 'third_person_scenario',
        disclosure_required: false,
        requirements_met: true,
      })
    ).toEqual([])
    expect(
      validateNarrativePolicy(envelope, {
        mode: 'evidence_based_dramatization',
        basis_outcome_ids: ['documented'],
        voice_mode: 'third_person_scenario',
        disclosure_required: false,
        requirements_met: true,
      })
    ).toContain('evidence_threshold_unmet')
  })

  it('does not require disclosure for synthetic first person', () => {
    expect(
      validateNarrativePolicy(envelope, {
        mode: 'evidence_based_dramatization',
        basis_outcome_ids: ['study-review'],
        voice_mode: 'dramatized_first_person_disclosed',
        disclosure_required: false,
        requirements_met: true,
      })
    ).toEqual([])
  })
})
