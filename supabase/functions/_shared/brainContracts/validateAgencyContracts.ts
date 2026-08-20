// @ts-nocheck -- source is executable JavaScript and is imported into Deno as a signed runtime contract.
const normalize = (value) =>
  String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u0591-\u05c7]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const NUMBER_WORDS = [
  'אחד', 'אחת', 'שניים', 'שתיים', 'שני', 'שתי', 'שלושה', 'שלוש',
  'ארבעה', 'ארבע', 'חמישה', 'חמש', 'שישה', 'שש', 'שבעה', 'שבע',
  'שמונה', 'תשעה', 'תשע', 'עשרה', 'עשר', 'חצי', 'רבע',
]

const UNIT_WORDS = [
  'דקה', 'דקות', 'שעה', 'שעות', 'יום', 'ימים', 'שבוע', 'שבועות',
  'חודש', 'חודשים', 'עובד', 'עובדים', 'איש', 'אנשים', 'אחוז', 'אחוזים',
]

const CLAIM_BEARING_SPINE_FIELDS = [
  'unmet_need_now',
  'scene_evidence',
  'consequence_without_offer',
  'dominant_emotional_peak',
  'offer_mechanism',
  'why_offer_is_causal_solution',
  'unresolved_at_ask',
]

const unique = (values) => [...new Set(values)]

function evidenceText(envelope) {
  return normalize(
    [
      envelope?.real_problem,
      envelope?.real_solution,
      ...(envelope?.sources ?? []).flatMap((source) => [
        source.claim,
        source.source_quote,
      ]),
      ...(envelope?.supported_outcomes ?? []).flatMap((outcome) => [
        outcome.statement,
        outcome.intensity_ceiling,
      ]),
    ]
      .filter(Boolean)
      .join(' ')
  )
}

function quantifiedFragments(value) {
  const text = normalize(value)
  const fragments = []
  const numeric = /\b\d+(?:[.,]\d+)?(?:\s*(?:-|–|עד)\s*\d+(?:[.,]\d+)?)?(?:%|\s+[\p{L}]+)?/gu
  for (const match of text.matchAll(numeric)) fragments.push(match[0].trim())
  const wordPattern = new RegExp(
    `(?:${NUMBER_WORDS.join('|')})(?:\\s+(?:${UNIT_WORDS.join('|')}))?`,
    'gu'
  )
  for (const match of text.matchAll(wordPattern)) fragments.push(match[0].trim())
  return unique(fragments.filter(Boolean))
}

/** @returns {{pass: boolean, flags: string[], details: string[]}} */
export function validateAngleDecision(angles, envelope) {
  const flags = []
  const details = []
  const sourceIds = new Set((envelope?.sources ?? []).map((source) => source.source_id))
  const supported = evidenceText(envelope)
  const recommended = angles.filter((angle) => angle.is_recommended)
  if (recommended.length !== 1) {
    flags.push('angle_recommendation_cardinality')
    details.push(`Expected exactly one recommended angle; received ${recommended.length}.`)
  }

  for (const [angleIndex, angle] of angles.entries()) {
    const spine = angle.conversion_spine
    if (!spine) continue
    for (const sourceId of spine.truth_sources ?? []) {
      if (!sourceIds.has(sourceId)) {
        flags.push('angle_truth_source_invalid')
        details.push(`Angle ${angleIndex} references unknown source id: ${sourceId}`)
      }
    }
    const claimText = CLAIM_BEARING_SPINE_FIELDS
      .flatMap((field) => spine[field] ?? [])
      .join(' ')
    for (const fragment of quantifiedFragments(claimText)) {
      if (!supported.includes(fragment)) {
        flags.push('angle_unsupported_quantified_detail')
        details.push(`Angle ${angleIndex} adds unsupported quantified detail: ${fragment}`)
      }
    }
  }

  return { pass: flags.length === 0, flags: unique(flags), details: unique(details) }
}

/** @returns {{pass: boolean, flags: string[], details: string[]}} */
export function validateDepartmentPlan(plan, angles, envelope) {
  const flags = []
  const details = []
  const candidateIds = new Set()
  const anchorIds = new Set([
    ...(envelope?.sources ?? []).map((source) => source.source_id),
    ...(envelope?.supported_outcomes ?? []).map((outcome) => outcome.outcome_id),
  ])
  for (const brief of plan?.candidate_briefs ?? []) {
    if (candidateIds.has(brief.candidate_id)) {
      flags.push('duplicate_candidate_id')
      details.push(`Candidate id is duplicated: ${brief.candidate_id}`)
    }
    candidateIds.add(brief.candidate_id)
    if (!angles[brief.angle_index]) {
      flags.push('candidate_angle_missing')
      details.push(`${brief.candidate_id} routes to missing angle ${brief.angle_index}.`)
    }
    for (const anchorId of brief.evidence_anchor_ids ?? []) {
      if (!anchorIds.has(anchorId)) {
        flags.push('candidate_evidence_anchor_invalid')
        details.push(`${brief.candidate_id} references unknown evidence anchor ${anchorId}.`)
      }
    }
  }
  return { pass: flags.length === 0, flags: unique(flags), details: unique(details) }
}

/** @returns {{pass: boolean, flags: string[], details: string[]}} */
export function validateHookCoverage(plan, hooks) {
  const flags = []
  const details = []
  for (const brief of plan?.candidate_briefs ?? []) {
    const pool = hooks.filter(
      (hook) =>
        hook.candidate_id === brief.candidate_id &&
        hook.angle_index === brief.angle_index
    )
    const recommended = pool.filter((hook) => hook.is_recommended)
    if (pool.length < 3) {
      flags.push('candidate_hook_pool_missing')
      details.push(`${brief.candidate_id} has ${pool.length} compatible hooks; expected at least 3.`)
    }
    if (recommended.length !== 1) {
      flags.push('candidate_hook_recommendation_cardinality')
      details.push(`${brief.candidate_id} has ${recommended.length} recommended compatible hooks.`)
    }
  }
  return { pass: flags.length === 0, flags: unique(flags), details: unique(details) }
}

/** @returns {Record<string, any> | null} */
export function selectCandidateHook(brief, hooks) {
  const compatible = hooks.filter(
    (hook) =>
      hook.candidate_id === brief.candidate_id &&
      hook.angle_index === brief.angle_index
  )
  const recommended = compatible.filter((hook) => hook.is_recommended)
  if (compatible.length < 3 || recommended.length !== 1) return null
  return recommended[0]
}

/** @returns {{pass: boolean, flags: string[], details: string[]}} */
export function validateCandidateClaims(candidate, envelope) {
  const supported = evidenceText(envelope)
  const standaloneNumbers = (value) =>
    normalize(value).match(/(?<![\p{L}])\d+(?:[.,]\d+)?(?![\p{L}])/gu) ?? []
  const supportedNumbers = new Set(standaloneNumbers(supported))
  const candidateNumbers = unique(
    standaloneNumbers(
      [candidate?.hook, candidate?.primary_text, candidate?.headline]
        .filter(Boolean)
        .join(' ')
    )
  )
  const unsupported = candidateNumbers.filter((number) => !supportedNumbers.has(number))
  return {
    pass: unsupported.length === 0,
    flags: unsupported.length ? ['invented_claim_detail'] : [],
    details: unsupported.map(
      (number) => `Candidate uses unsupported numeric detail: ${number}`
    ),
  }
}

/**
 * @param {any} tasteSelection
 * @param {string[]} consumedIds
 * @returns {'loaded'|'none_available'|'required_but_not_consumed'|'claimed_but_not_available'}
 */
export function tasteRequirementStatus(tasteSelection, consumedIds = []) {
  const selected = tasteSelection?.selected ?? []
  if (selected.length === 0) return 'none_available'
  const selectedIds = new Set(
    selected.map((item, index) =>
      String(item.example_id ?? item.id ?? item.entry?.id ?? `taste-${index}`)
    )
  )
  if (consumedIds.length === 0) return 'required_but_not_consumed'
  if (consumedIds.some((id) => !selectedIds.has(String(id))))
    return 'claimed_but_not_available'
  return 'loaded'
}

export function normalizeTasteKillFlag(report, status) {
  if (status !== 'none_available') return report
  const onlyFalseTasteFlag =
    report.kill_flags.length > 0 &&
    report.kill_flags.every((flag) => flag === 'taste_not_loaded')
  const principlesPass =
    !Array.isArray(report.principles) ||
    report.principles.every((principle) => principle.verdict === 'pass')
  return {
    ...report,
    ...(onlyFalseTasteFlag && principlesPass && report.compliance_ok !== false
      ? { overall: 'pass' }
      : {}),
    kill_flags: report.kill_flags.filter(
      (flag) => flag !== 'taste_not_loaded'
    ),
  }
}

const UNREPAIRABLE_FLAGS = new Set([
  'claim_violation',
  'fake_testimonial',
  'vulnerability_stack',
  'wrong_audience',
  'objective_unknown',
  'audience_unknown',
  'objective_mismatch',
  'doctrine_bundle_mismatch',
  'taste_not_loaded',
])

const REVISION_EFFORT = {
  wording_stronger_than_fact: 1,
  evidence_threshold_unmet: 1,
  disclosure_required: 1,
  hook_body_duplicate: 1,
  weak_close: 2,
  low_momentum: 2,
  weak_fold: 2,
  generic_angle: 4,
  swap_test_passes: 4,
}

function revisionEffort(flags) {
  return flags.reduce((sum, flag) => sum + (REVISION_EFFORT[flag] ?? 3), 0)
}

/** @returns {{candidate: any, review: any, flags: string[], effort: number, order: number} | null} */
export function selectRevisionCandidate(candidates, reviews) {
  const passed = new Set(
    reviews
      .filter(
        (review) =>
          review.judge?.overall === 'pass' &&
          review.judge?.compliance_ok &&
          (review.judge?.kill_flags ?? []).length === 0 &&
          (review.critic?.kill_flags ?? []).length === 0
      )
      .map((review) => review.candidate_id)
  )
  if (passed.size > 0) return null
  const eligible = candidates
    .map((candidate, order) => {
      const review = reviews.find((item) => item.candidate_id === candidate.candidate_id)
      const flags = unique([
        ...(review?.critic?.kill_flags ?? []),
        ...(review?.judge?.kill_flags ?? []),
      ])
      return { candidate, review, flags, effort: revisionEffort(flags), order }
    })
    .filter(
      (item) =>
        item.review &&
        item.flags.length > 0 &&
        !item.flags.some((flag) => UNREPAIRABLE_FLAGS.has(flag))
    )
    .sort(
      (left, right) =>
        left.effort - right.effort ||
        left.flags.length - right.flags.length ||
        left.order - right.order
    )
  return eligible[0] ?? null
}
