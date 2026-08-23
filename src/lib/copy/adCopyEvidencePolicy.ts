export type EvidencePolicyInput = {
  sources: Array<{ source_type: string; actual_person: boolean }>
  supported_outcomes: Array<{ outcome_id: string; evidence_basis: string }>
}

export type NarrativePolicyInput = {
  mode:
    'documented_case' | 'evidence_based_dramatization' | 'non_story' | 'blocked'
  basis_outcome_ids: string[]
  voice_mode:
    | 'actual_testimonial'
    | 'dramatized_first_person'
    | 'dramatized_first_person_disclosed'
    | 'third_person_scenario'
    | 'brand_narrated'
    | 'non_story'
  disclosure_required: boolean
  requirements_met: boolean
}

export function validateNarrativePolicy(
  envelope: EvidencePolicyInput,
  license: NarrativePolicyInput
): string[] {
  const flags: string[] = []
  const outcomes = new Map(
    envelope.supported_outcomes.map((outcome) => [outcome.outcome_id, outcome])
  )
  const bases = license.basis_outcome_ids
    .map((id) => outcomes.get(id))
    .filter(Boolean)
  if (license.basis_outcome_ids.some((id) => !outcomes.has(id)))
    flags.push('evidence_threshold_unmet')
  // Current owner policy permits synthetic identity, first-person voice and
  // testimonial-style framing without disclosure during development. Material
  // product results, mechanisms, prices and measured claims remain bounded by
  // the evidence envelope and the separate deterministic truth gates.
  if (license.mode === 'evidence_based_dramatization') {
    const eligible = bases.some(
      (outcome) =>
        outcome &&
        [
          'review_convergence',
          'study_plus_review',
          'owner_verified_general_condition',
        ].includes(outcome.evidence_basis)
    )
    if (!eligible) flags.push('evidence_threshold_unmet')
  }
  if (license.mode !== 'blocked' && !license.requirements_met)
    flags.push('evidence_threshold_unmet')
  return [...new Set(flags)]
}
