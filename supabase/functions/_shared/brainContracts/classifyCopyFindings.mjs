const unique = (values) => [...new Set((values ?? []).filter(Boolean))]

// These findings mean the pipeline did not give the brain a valid task or did
// not preserve its own routing contract. They trigger an internal repair or
// retry. They are not judgments about whether the copy is ethical or good.
export const SYSTEM_ERROR_FLAGS = new Set([
  'execution_brief_missing',
  'needs_objective',
  'needs_language',
  'needs_audience',
  'needs_avatar',
  'objective_conflict',
  'blocked',
  'objective_unknown',
  'audience_unknown',
  'wrong_audience',
  'objective_mismatch',
  'delivery_language_mismatch',
  'doctrine_bundle_mismatch',
  'doctrine_not_consumed',
  'taste_not_loaded',
  'hook_assignment_mismatch',
  'missing_block_coverage',
  'angle_recommendation_cardinality',
  'angle_differentiation_source_invalid',
  'angle_conversion_spine_missing',
  'angle_legacy_competitor_swap_test',
  'angle_causal_dependency_invalid',
  'angle_truth_source_invalid',
  'department_anchor_classification_missing',
  'department_story_feasibility_missing',
  'department_emotional_center_missing',
  'department_story_bypass_reason_inconsistent',
  'department_story_bypass_reason_missing',
  'duplicate_candidate_id',
  'candidate_angle_missing',
  'candidate_angle_ineligible',
  'candidate_specialist_license_mismatch',
  'candidate_evidence_anchor_invalid',
  'department_objective_domain_bleed',
  'candidate_hook_pool_missing',
  'candidate_hook_recommendation_cardinality',
])

// Only direct, material falsehoods and explicit unsupported market claims may
// veto copy under the current development policy. A model's general sense of
// caution is never enough to add a new blocker.
export const MATERIAL_TRUTH_BLOCK_FLAGS = new Set([
  'claim_violation',
  'unsupported_outcome',
  'material_claim_fabrication',
  'material_result_stronger_than_evidence',
  'extreme_invented_consequence',
  'angle_unsupported_category_claim',
  'angle_unsupported_quantified_detail',
  'angle_unverified_market_claim',
  'angle_competitive_evidence_invalid',
  'hook_unsupported_category_claim',
  'hook_unsupported_quantified_detail',
  'candidate_unsupported_category_claim',
  'candidate_unsupported_quantified_detail',
  'candidate_unverified_market_claim',
])

// These surface defects are deterministic and should be repaired or normalized
// instead of burning an otherwise usable candidate.
export const AUTO_FIX_FLAGS = new Set([
  'forbidden_dash',
  'hook_forbidden_dash',
  'hook_body_duplicate',
])

// These legacy legal-policy labels are intentionally inactive until the
// company completes a separate market and legal review.
export const REMOVED_POLICY_FLAGS = new Set([
  'fake_testimonial',
  'disclosure_required',
])

export function classifyCopyFindings(flags = []) {
  const result = {
    system_errors: [],
    material_truth_blocks: [],
    quality_findings: [],
    auto_fix_findings: [],
    removed_policy_findings: [],
  }
  for (const flag of unique(flags)) {
    if (SYSTEM_ERROR_FLAGS.has(flag)) result.system_errors.push(flag)
    else if (MATERIAL_TRUTH_BLOCK_FLAGS.has(flag))
      result.material_truth_blocks.push(flag)
    else if (AUTO_FIX_FLAGS.has(flag)) result.auto_fix_findings.push(flag)
    else if (REMOVED_POLICY_FLAGS.has(flag))
      result.removed_policy_findings.push(flag)
    else result.quality_findings.push(flag)
  }
  return result
}

export function normalizeCopyGateReport(report = {}) {
  const originalFindings = unique([
    ...(report.original_findings ?? []),
    ...(report.kill_flags ?? []),
    ...(report.quality_findings ?? []),
    ...(report.system_errors ?? []),
    ...(report.material_truth_blocks ?? []),
  ])
  const classified = classifyCopyFindings(originalFindings)
  const blocking = unique([
    ...classified.system_errors,
    ...classified.material_truth_blocks,
  ])
  const quality = unique([
    ...(report.quality_findings ?? []),
    ...classified.quality_findings,
  ])
  return {
    ...report,
    original_findings: originalFindings,
    system_errors: classified.system_errors,
    material_truth_blocks: classified.material_truth_blocks,
    quality_findings: quality,
    auto_fix_findings: classified.auto_fix_findings,
    removed_policy_findings: classified.removed_policy_findings,
    kill_flags: blocking,
    overall:
      blocking.length > 0
        ? 'fail'
        : report.overall === 'fail' || quality.length > 0
          ? 'advisory'
          : report.overall ?? 'pass',
    // A language model does not get an independent legal veto. Material truth
    // blocks are explicit above; legal policy will be added later with counsel.
    compliance_ok: classified.material_truth_blocks.length === 0,
  }
}

export function copyGatePasses(report = {}) {
  const normalized = normalizeCopyGateReport(report)
  return (
    normalized.system_errors.length === 0 &&
    normalized.material_truth_blocks.length === 0
  )
}
