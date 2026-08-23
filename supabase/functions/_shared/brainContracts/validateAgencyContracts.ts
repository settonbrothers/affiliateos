// @ts-nocheck -- source is executable JavaScript and is imported into Deno as a signed runtime contract.
import {
  classifyCopyFindings,
  copyGatePasses,
  normalizeCopyGateReport,
} from './classifyCopyFindings.mjs'
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
  'שמונה', 'תשעה', 'תשע', 'עשרה', 'עשר', 'אחת עשרה', 'אחד עשר',
  'שתים עשרה', 'שנים עשר', 'עשרים', 'שלושים', 'ארבעים', 'חמישים',
  'שישים', 'שבעים', 'שמונים', 'תשעים', 'מאה', 'מאות', 'אלף', 'אלפים',
  'חצי', 'רבע',
]

const ENGLISH_NUMBER_WORDS = [
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'twenty', 'thirty', 'forty', 'fifty', 'sixty',
  'seventy', 'eighty', 'ninety', 'hundred', 'thousand', 'half', 'quarter',
]

const UNSUPPORTED_ORDINAL_WORDS = [
  'השני', 'השנייה', 'השניי', 'השלישי', 'השלישית', 'הרביעי', 'הרביעית',
  'החמישי', 'החמישית', 'השישי', 'השישית', 'השביעי', 'השביעית',
  'השמיני', 'השמינית', 'התשיעי', 'התשיעית', 'העשירי', 'העשירית',
]

const UNIT_WORDS = [
  'שנייה', 'שניות', 'שניה', 'שניות', 'דקה', 'דקות', 'שעה', 'שעות', 'יום', 'ימים', 'שבוע', 'שבועות',
  'חודש', 'חודשים', 'עובד', 'עובדים', 'איש', 'אנשים', 'אחוז', 'אחוזים',
  'קליק', 'קליקים', 'המרה', 'המרות', 'טיוטה', 'טיוטות',
]

const ENGLISH_UNIT_WORDS = [
  'second', 'seconds', 'minute', 'minutes', 'hour', 'hours', 'day', 'days',
  'week', 'weeks', 'month', 'months', 'year', 'years', 'time', 'times',
  'employee', 'employees', 'person',
  'people', 'percent', 'click', 'clicks', 'conversion', 'conversions',
  'draft', 'drafts', 'asset', 'assets', 'campaign', 'campaigns', 'workspace',
  'workspaces', 'format', 'formats', 'channel', 'channels', 'team', 'teams',
  'call', 'calls', 'caller', 'callers', 'business', 'businesses',
]

const CLAIM_BEARING_SPINE_FIELDS = [
  'unmet_need_now',
  'scene_evidence',
  'consequence_without_offer',
  'dominant_emotional_peak',
  'build_to_peak',
  'offer_mechanism',
  'why_offer_is_causal_solution',
  'unresolved_at_ask',
]

const UNSUPPORTED_CATEGORY_BEHAVIOR =
  /(?:כל\s+כלי(?:\s+ai)?|כלי(?:ם)?(?:\s+(?:כתיבה|ai))?\s+(?:גנרי(?:ים|ות)?|אחר(?:ים|ות)?)|כלים אחרים|המתחרים|בינה מלאכותית כללית|ה[-־–— ]?ai|הכלי|generic (?:ai )?tools?|general(?:-purpose)? ai(?: writing)? tools?|the ai|the tool|other (?:ai )?tools?|competitors?).{0,160}(?:שוכח|שוכחים|לא זוכר|לא זוכרים|לא שומר|לא שומרים|אין (?:לו|להם) זיכרון|מתחיל(?:ים)? מאפס|חסר(?:ת)? זיכרון|לא כולל|חסר|לא יכול|לא יכולים|תמיד|אף פעם|אף אחד(?:\s+מהם)?|stateless|no (?:persistent )?memory|has no (?:persistent )?memory|forget|forgets|do not remember|don't remember|does not retain|did not retain|never retained|does not store|does not include|without (?:persistent )?|lacks?|context resets?|starts? (?:again )?from (?:a )?(?:blank|zero)|cannot|can't|never|always)/iu

const UNSUPPORTED_SYSTEM_DESIGN_BEHAVIOR =
  /(?:workflow|system|platform|תהליך|מערכת).{0,120}(?:was never designed|not designed|never built|cannot carry|does not carry|לא תוכנ|לא נבנ|אינ(?:ו|ה) יכול(?:ה)? לשאת)/iu

const UNSOURCED_ABSOLUTE_OR_MEASUREMENT =
  /(?:majority of (?:the )?time|fully consumed|(?:exactly )?(?:at )?the same rate|every (?:asset|campaign|draft|format|session|generation)|all (?:assets|campaigns|drafts|formats|sessions|generations)|רוב הזמן|כל (?:נכס|קמפיין|טיוטה|פורמט|סשן)|באותו קצב בדיוק)/iu

const UNSOURCED_TIME_PROMISE =
  /(?:(?:תוך|בתוך)\s+(?:שניות|דקות|שעות|ימים)|(?:within|in)\s+(?:seconds|minutes|hours|days))/iu

const UNIQUENESS_OR_COMPARISON_CLAIM =
  /(?:\bonly\s+(?:ai\s+)?(?:tool|product|service|platform|solution|system|app|software|provider|option)\b|\b(?:unique|uniquely|exclusive|unmatched|unlike|better than|superior to|no (?:other )?(?:tool|product|competitor)|without competition)\b|(?:היחיד|היחידה|ייחודי|ייחודית|בלעדי|בלעדית|ללא מתחרים|אין (?:עוד|אף )?(?:כלי|מוצר|מתחרה)|בניגוד ל|טוב יותר מ|עדיף על))/iu

const DEFINITE_COUNTERFACTUAL_LOSS =
  /(?:\b(?:caller|they|she|he)\b.{0,100}\b(?:has|had|will have|already)\b.{0,60}\b(?:found|booked|moved on|forgotten|given up)\b|\bonly (?:thing|reason)\b.{0,100}\b(?:lose|losing|lost|save|saved|saving|kept|stayed)\b)/iu

const MATERIAL_NUMBER_CONTEXT =
  /(?:[$€£₪%]|\b(?:price|cost|trial|revenue|income|profit|booking|bookings|conversion|conversions|lead|leads|customer|customers|client|clients|reply rate|callback rate|per month|per year|guarantee|guaranteed)\b|(?:מחיר|עלות|ניסיון|הכנסה|רווח|הזמנה|הזמנות|המרה|המרות|ליד|לידים|לקוח|לקוחות|מובטח|אחוז))/iu

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

function evidenceAnchorIds(envelope) {
  return new Set([
    ...(envelope?.sources ?? []).map((source) => source.source_id),
    ...(envelope?.supported_outcomes ?? []).map((outcome) => outcome.outcome_id),
  ])
}

function competitiveFindings(envelope) {
  return new Map(
    (envelope?.competitive_findings ?? []).map((finding) => [
      finding.finding_id,
      finding,
    ])
  )
}

function quantifiedFragments(value) {
  const text = normalize(value)
  const fragments = []
  const times = [...text.matchAll(/\b\d{1,2}:\d{2}\b/gu)]
  for (const match of times) fragments.push(match[0])
  const numericText = text.replace(/\b\d{1,2}:\d{2}\b/gu, (time) =>
    ' '.repeat(time.length)
  )
  const numeric = /\b\d+(?:[.,]\d+)?(?:\s*(?:-|–|עד)\s*\d+(?:[.,]\d+)?)?(?:%|\s+[\p{L}]+)?/gu
  for (const match of numericText.matchAll(numeric)) fragments.push(match[0].trim())
  const wordPattern = new RegExp(
    `(?<!\\p{L})(?:${NUMBER_WORDS.join('|')})(?:\\s+(?:${UNIT_WORDS.join('|')}))?(?!\\p{L})`,
    'gu'
  )
  for (const match of text.matchAll(wordPattern)) fragments.push(match[0].trim())
  const englishWordPattern = new RegExp(
    `(?<!\\p{L})(?:${ENGLISH_NUMBER_WORDS.join('|')})\\s+(?:${ENGLISH_UNIT_WORDS.join('|')})(?!\\p{L})`,
    'gu'
  )
  for (const match of text.matchAll(englishWordPattern))
    fragments.push(match[0].trim())
  const ordinalPattern = new RegExp(
    `(?<!\\p{L})(?:${UNSUPPORTED_ORDINAL_WORDS.join('|')})(?!\\p{L})`,
    'gu'
  )
  for (const match of text.matchAll(ordinalPattern)) fragments.push(match[0].trim())
  return unique(fragments.filter(Boolean))
}

function quantifiedFragmentSupported(fragment, supported) {
  const normalizedFragment = normalize(fragment)
  if (supported.includes(normalizedFragment)) return true
  if (/^\d{1,2}:\d{2}$/.test(normalizedFragment))
    return supported.includes(normalizedFragment)
  const number = normalizedFragment.match(/\d+(?:[.,]\d+)?/)?.[0]
  if (!number) return false
  const unit = normalizedFragment
    .slice((normalizedFragment.indexOf(number) + number.length))
    .trim()
    .split(/\s+/)[0]
  for (const match of supported.matchAll(new RegExp(number.replace('.', '\\.'), 'gu'))) {
    const start = Math.max(0, match.index - 80)
    const end = Math.min(supported.length, match.index + number.length + 80)
    const window = supported.slice(start, end)
    if (!unit || window.includes(unit)) return true
    const families = [
      ['call', 'calls', 'caller', 'callers'],
      ['business', 'businesses'],
      ['day', 'days'],
      ['second', 'seconds'],
    ]
    const family = families.find((items) => items.includes(unit))
    if (family?.some((item) => window.includes(item))) return true
  }
  return false
}

function measuredWordFragments(value) {
  const text = normalize(value)
  const hebrewPattern = new RegExp(
    `(?<!\\p{L})(?:${NUMBER_WORDS.join('|')})\\s+(?:${UNIT_WORDS.join('|')})(?!\\p{L})`,
    'gu'
  )
  const englishPattern = new RegExp(
    `(?<!\\p{L})(?:${ENGLISH_NUMBER_WORDS.join('|')})\\s+(?:${ENGLISH_UNIT_WORDS.join('|')})(?!\\p{L})`,
    'gu'
  )
  const englishArticleDuration =
    /(?<!\p{L})(?:a|an)\s+(?:second|minute|hour|day|week|month|year)(?!\p{L})/gu
  return unique(
    [
      ...text.matchAll(hebrewPattern),
      ...text.matchAll(englishPattern),
      ...text.matchAll(englishArticleDuration),
    ].map((match) => match[0].trim())
  )
}

function measuredWordFragmentSupported(fragment, supported, candidateText) {
  if (supported.includes(fragment)) return true
  if (
    fragment === 'one month' &&
    /\bper month\b/u.test(supported) &&
    /\bone month\b.{0,100}\b(?:is|costs?)\b.{0,30}\d/u.test(candidateText)
  )
    return true
  return false
}

/** @returns {{pass: boolean, flags: string[], details: string[]}} */
export function validateAngleDecision(angles, envelope) {
  const flags = []
  const details = []
  const sourceIds = new Set((envelope?.sources ?? []).map((source) => source.source_id))
  const anchorIds = evidenceAnchorIds(envelope)
  const findings = competitiveFindings(envelope)
  const supported = evidenceText(envelope)
  const recommended = angles.filter((angle) => angle.is_recommended)
  if (recommended.length !== 1) {
    flags.push('angle_recommendation_cardinality')
    details.push(`Expected exactly one recommended angle; received ${recommended.length}.`)
  }

  for (const [angleIndex, angle] of angles.entries()) {
    const spine = angle.conversion_spine
    const claimBearingAngleText = [
      angle.positioning,
      angle.positive_differentiation?.offer_strength,
      angle.positive_differentiation?.market_claim,
      ...CLAIM_BEARING_SPINE_FIELDS.flatMap((field) => spine?.[field] ?? []),
      spine?.causal_dependency_test?.removed_offer_mechanism,
      spine?.causal_dependency_test?.explanation,
      spine?.swap_test?.replacement_offer,
      spine?.swap_test?.conclusion,
    ]
      .filter(Boolean)
      .join(' ')
    if (
      UNSUPPORTED_CATEGORY_BEHAVIOR.test(normalize(claimBearingAngleText)) ||
      UNSUPPORTED_SYSTEM_DESIGN_BEHAVIOR.test(normalize(claimBearingAngleText))
    ) {
      flags.push('angle_unsupported_category_claim')
      details.push(
        `Angle ${angleIndex} assigns unsupported behavior or absence to a tool category.`
      )
    }
    const absoluteMeasurement = normalize(claimBearingAngleText).match(
      UNSOURCED_ABSOLUTE_OR_MEASUREMENT
    )?.[0]
    if (absoluteMeasurement && !supported.includes(absoluteMeasurement)) {
      flags.push('angle_unsupported_quantified_detail')
      details.push(
        `Angle ${angleIndex} adds an unsupported absolute or measured relationship: ${absoluteMeasurement}`
      )
    }
    const differentiation = angle.positive_differentiation
    if (!differentiation) {
      flags.push('angle_positive_differentiation_missing')
      details.push(`Angle ${angleIndex} does not state a positive supported offer strength.`)
    } else {
      for (const anchorId of differentiation.offer_strength_source_ids ?? []) {
        if (!anchorIds.has(anchorId)) {
          flags.push('angle_differentiation_source_invalid')
          details.push(
            `Angle ${angleIndex} references unknown differentiation source: ${anchorId}`
          )
        }
      }
      const mode = differentiation.market_claim_mode
      const marketClaim = String(differentiation.market_claim ?? '').trim()
      const findingIds = differentiation.market_claim_evidence_ids ?? []
      if (mode === 'offer_only') {
        if (marketClaim || findingIds.length) {
          flags.push('angle_unverified_market_claim')
          details.push(
            `Angle ${angleIndex} uses offer_only mode but still includes a market claim or competitive evidence id.`
          )
        }
      } else {
        if (!marketClaim || findingIds.length === 0) {
          flags.push('angle_unverified_market_claim')
          details.push(
            `Angle ${angleIndex} makes a comparison or uniqueness claim without an explicit competitive finding.`
          )
        }
        for (const findingId of findingIds) {
          const finding = findings.get(findingId)
          const correctType =
            mode === 'verified_comparison'
              ? finding?.finding_type === 'comparison'
              : finding?.finding_type === 'uniqueness'
          if (!finding || finding.verified !== true || !correctType) {
            flags.push('angle_competitive_evidence_invalid')
            details.push(
              `Angle ${angleIndex} references an unverified or mismatched competitive finding: ${findingId}`
            )
          }
        }
      }
      if (
        differentiation.competitor_denigration_used !== false ||
        (mode === 'offer_only' &&
          UNIQUENESS_OR_COMPARISON_CLAIM.test(
            `${differentiation.offer_strength ?? ''} ${angle.positioning ?? ''}`
          ))
      ) {
        flags.push('angle_unverified_market_claim')
        details.push(
          `Angle ${angleIndex} turns positive differentiation into an unsupported comparison, uniqueness claim or competitor put-down.`
        )
      }
    }
    if (!spine) {
      if (angle.narrative_license?.mode !== 'blocked') {
        flags.push('angle_conversion_spine_missing')
        details.push(
          `Angle ${angleIndex} is a conversion route without a causal conversion spine.`
        )
      }
      continue
    }
    if (spine.swap_test) {
      flags.push('angle_legacy_competitor_swap_test')
      details.push(
        `Angle ${angleIndex} uses the legacy replacement-offer test instead of a mechanism counterfactual.`
      )
    }
    const dependency = spine.causal_dependency_test
    if (
      !dependency ||
      dependency.reader_problem_still_resolves !== false ||
      !String(dependency.removed_offer_mechanism ?? '').trim()
    ) {
      flags.push('angle_causal_dependency_invalid')
      details.push(
        `Angle ${angleIndex} does not prove causality by removing the supported offer mechanism.`
      )
    }
    for (const sourceId of spine.truth_sources ?? []) {
      if (!sourceIds.has(sourceId)) {
        flags.push('angle_truth_source_invalid')
        details.push(`Angle ${angleIndex} references unknown source id: ${sourceId}`)
      }
    }
    const claimText = CLAIM_BEARING_SPINE_FIELDS
      .flatMap((field) => spine[field] ?? [])
      .concat([
        angle.positive_differentiation?.offer_strength,
        angle.positive_differentiation?.market_claim,
        spine.causal_dependency_test?.removed_offer_mechanism,
        spine.causal_dependency_test?.explanation,
      ])
      .filter(Boolean)
      .join(' ')
    for (const fragment of quantifiedFragments(claimText)) {
      if (!quantifiedFragmentSupported(fragment, supported)) {
        flags.push('angle_unsupported_quantified_detail')
        details.push(`Angle ${angleIndex} adds unsupported quantified detail: ${fragment}`)
      }
    }
  }

  return { pass: flags.length === 0, flags: unique(flags), details: unique(details) }
}

/**
 * Remove truth-failing angles after the single bounded revision. This is a
 * routing decision, not a copy edit: rejected angle text never reaches a
 * writer, and one surviving eligible angle becomes the recommendation.
 * @returns {{pass: boolean, angles: any[], rejected: any[]}}
 */
export function selectEligibleAngles(angles, envelope) {
  const eligible = []
  const rejected = []
  for (const [angleIndex, angle] of angles.entries()) {
    if (
      angle.narrative_license?.mode === 'blocked' ||
      !angle.conversion_spine
    ) {
      rejected.push({
        angle_index: angleIndex,
        name: angle.name ?? null,
        flags: ['angle_ineligible_or_blocked'],
        details: ['Angle has no eligible causal conversion spine.'],
      })
      continue
    }
    const single = validateAngleDecision(
      [{ ...angle, is_recommended: true }],
      envelope
    )
    if (single.pass) eligible.push({ angle, originalIndex: angleIndex })
    else
      rejected.push({
        angle_index: angleIndex,
        name: angle.name ?? null,
        flags: single.flags,
        details: single.details,
      })
  }
  if (eligible.length === 0) return { pass: false, angles: [], rejected }
  const originalRecommendation = eligible.find(
    (item) => item.angle.is_recommended
  )
  const selectedIndex = (
    originalRecommendation ?? eligible[0]
  ).originalIndex
  return {
    pass: true,
    angles: eligible.map(({ angle, originalIndex }) => ({
      ...angle,
      is_recommended: originalIndex === selectedIndex,
    })),
    rejected,
  }
}

/** @returns {{pass: boolean, flags: string[], details: string[]}} */
export function validateDepartmentPlan(plan, angles, envelope, executionBrief = null) {
  const flags = []
  const details = []
  const candidateIds = new Set()
  const anchorIds = new Set([
    ...(envelope?.sources ?? []).map((source) => source.source_id),
    ...(envelope?.supported_outcomes ?? []).map((outcome) => outcome.outcome_id),
  ])
  if (typeof plan?.is_anchor_ad !== 'boolean') {
    flags.push('department_anchor_classification_missing')
    details.push('The director did not classify whether this is an anchor ad.')
  }
  if (!['supported', 'unsupported', 'not_required'].includes(plan?.story_feasibility)) {
    flags.push('department_story_feasibility_missing')
    details.push('The director did not record story feasibility.')
  }
  if (plan?.is_anchor_ad && plan?.story_feasibility === 'supported') {
    if (plan?.primary_specialist !== 'storytelling') {
      flags.push('anchor_story_bypassed_without_reason')
      details.push('A supported anchor story must route to storytelling as the primary specialist.')
    }
    if (!plan?.dominant_emotional_center) {
      flags.push('department_emotional_center_missing')
      details.push('A supported anchor story requires a dominant emotional center.')
    }
    if (plan?.why_not_story !== null) {
      flags.push('department_story_bypass_reason_inconsistent')
      details.push('why_not_story must be null when storytelling is the primary supported route.')
    }
  }
  if (
    plan?.is_anchor_ad &&
    plan?.primary_specialist !== 'storytelling' &&
    !plan?.why_not_story
  ) {
    flags.push('department_story_bypass_reason_missing')
    details.push('A non-story primary route for an anchor ad requires why_not_story.')
  }
  for (const brief of plan?.candidate_briefs ?? []) {
    if (candidateIds.has(brief.candidate_id)) {
      flags.push('duplicate_candidate_id')
      details.push(`Candidate id is duplicated: ${brief.candidate_id}`)
    }
    candidateIds.add(brief.candidate_id)
    const routedAngle = angles[brief.angle_index]
    if (!routedAngle) {
      flags.push('candidate_angle_missing')
      details.push(`${brief.candidate_id} routes to missing angle ${brief.angle_index}.`)
    } else if (
      !routedAngle.conversion_spine ||
      routedAngle.narrative_license?.mode === 'blocked'
    ) {
      flags.push('candidate_angle_ineligible')
      details.push(
        `${brief.candidate_id} routes to an angle without an eligible causal conversion spine.`
      )
    } else if (
      brief.specialist === 'storytelling' &&
      !['documented_case', 'evidence_based_dramatization'].includes(
        routedAngle.narrative_license?.mode
      )
    ) {
      flags.push('candidate_specialist_license_mismatch')
      details.push(
        `${brief.candidate_id} routes a non-story angle to the storytelling specialist.`
      )
    }
    for (const anchorId of brief.evidence_anchor_ids ?? []) {
      if (!anchorIds.has(anchorId)) {
        flags.push('candidate_evidence_anchor_invalid')
        details.push(`${brief.candidate_id} references unknown evidence anchor ${anchorId}.`)
      }
    }
  }
  const objectiveType = executionBrief?.campaign_objective?.objective_type
  const isFundraising = ['donation', 'fundraising'].includes(objectiveType)
  const planText = normalize(
    [
      plan?.routing_reason,
      ...(plan?.candidate_briefs ?? []).flatMap((brief) => [
        brief.test_hypothesis,
        brief.reader_change,
        brief.material_difference,
      ]),
    ]
      .filter(Boolean)
      .join(' ')
  )
  if (
    executionBrief &&
    !isFundraising &&
    /(?:\bfunding\b|\bdonation\b|\bdonor\b|תרומ|מימון)/u.test(planText)
  ) {
    flags.push('department_objective_domain_bleed')
    details.push(
      `Department planning introduced fundraising language for objective ${objectiveType ?? 'unknown'}.`
    )
  }
  return { pass: flags.length === 0, flags: unique(flags), details: unique(details) }
}

/** Reject invalid candidate routes without rewriting surviving hypotheses. */
export function selectEligibleCandidateBriefs(
  plan,
  angles,
  envelope,
  executionBrief = null
) {
  const candidateBriefs = []
  const rejected = []
  for (const brief of plan?.candidate_briefs ?? []) {
    const validation = validateDepartmentPlan(
      { ...plan, candidate_briefs: [brief] },
      angles,
      envelope,
      executionBrief
    )
    if (validation.pass) candidateBriefs.push(brief)
    else
      rejected.push({
        candidate_id: brief.candidate_id,
        flags: validation.flags,
        details: validation.details,
      })
  }
  if (candidateBriefs.length === 0)
    return { pass: false, plan: null, rejected }
  const specialists = candidateBriefs.map((brief) => brief.specialist)
  const primarySpecialist = specialists.includes(plan.primary_specialist)
    ? plan.primary_specialist
    : specialists[0]
  const challengerSpecialist =
    specialists.find((specialist) => specialist !== primarySpecialist) ?? null
  return {
    pass: true,
    plan: {
      ...plan,
      primary_specialist: primarySpecialist,
      challenger_specialist: challengerSpecialist,
      candidate_briefs: candidateBriefs,
    },
    rejected,
  }
}

/** @returns {{pass: boolean, flags: string[], details: string[]}} */
export function validateHookCoverage(
  plan,
  hooks,
  envelope = null,
  { minimumHooksPerCandidate = 3 } = {}
) {
  const flags = []
  const details = []
  const supported = envelope ? evidenceText(envelope) : ''
  for (const brief of plan?.candidate_briefs ?? []) {
    const pool = hooks.filter(
      (hook) =>
        hook.candidate_id === brief.candidate_id &&
        hook.angle_index === brief.angle_index
    )
    const recommended = pool.filter((hook) => hook.is_recommended)
    if (pool.length < minimumHooksPerCandidate) {
      flags.push('candidate_hook_pool_missing')
      details.push(
        `${brief.candidate_id} has ${pool.length} compatible hooks; expected at least ${minimumHooksPerCandidate}.`
      )
    }
    if (recommended.length !== 1) {
      flags.push('candidate_hook_recommendation_cardinality')
      details.push(`${brief.candidate_id} has ${recommended.length} recommended compatible hooks.`)
    }
    for (const hook of pool) {
      if (/[—–]/u.test(hook.text ?? '')) {
        flags.push('hook_forbidden_dash')
        details.push(`${brief.candidate_id} uses a forbidden long or medium dash in hook.`)
      }
      const normalizedHook = normalize(hook.text)
      if (
        UNSUPPORTED_CATEGORY_BEHAVIOR.test(normalizedHook) ||
        UNSUPPORTED_SYSTEM_DESIGN_BEHAVIOR.test(normalizedHook)
      ) {
        flags.push('hook_unsupported_category_claim')
        details.push(
          `${brief.candidate_id} assigns unsupported category-wide behavior in hook: ${hook.text}`
        )
      }
      if (envelope && hook.is_recommended) {
        const timePromise = normalizedHook.match(UNSOURCED_TIME_PROMISE)?.[0]
        if (timePromise && !supported.includes(timePromise)) {
          flags.push('hook_unsupported_quantified_detail')
          details.push(
            `${brief.candidate_id} adds an unsupported time promise in hook: ${timePromise}`
          )
        }
        for (const fragment of quantifiedFragments(hook.text)) {
          if (!quantifiedFragmentSupported(fragment, supported)) {
            flags.push('hook_unsupported_quantified_detail')
            details.push(
              `${brief.candidate_id} adds unsupported quantified detail in hook: ${fragment}`
            )
          }
        }
      }
    }
  }
  return { pass: flags.length === 0, flags: unique(flags), details: unique(details) }
}

function hookTruthViolations(hook, envelope) {
  const supported = evidenceText(envelope)
  const normalizedHook = normalize(hook?.text)
  const flags = []
  const details = []
  if (/[—–]/u.test(hook?.text ?? '')) {
    flags.push('hook_forbidden_dash')
    details.push('Hook uses a forbidden long or medium dash.')
  }
  if (
    UNSUPPORTED_CATEGORY_BEHAVIOR.test(normalizedHook) ||
    UNSUPPORTED_SYSTEM_DESIGN_BEHAVIOR.test(normalizedHook)
  ) {
    flags.push('hook_unsupported_category_claim')
    details.push(`Hook assigns unsupported behavior to a category: ${hook?.text}`)
  }
  const timePromise = normalizedHook.match(UNSOURCED_TIME_PROMISE)?.[0]
  if (timePromise && !supported.includes(timePromise)) {
    flags.push('hook_unsupported_quantified_detail')
    details.push(`Hook adds an unsupported time promise: ${timePromise}`)
  }
  for (const fragment of quantifiedFragments(hook?.text)) {
    if (!quantifiedFragmentSupported(fragment, supported)) {
      flags.push('hook_unsupported_quantified_detail')
      details.push(`Hook adds unsupported quantified detail: ${fragment}`)
    }
  }
  return { flags: unique(flags), details: unique(details) }
}

/** Keep only truth-cleared hooks and promote an existing survivor without rewriting it. */
export function selectEligibleHooks(plan, hooks, envelope) {
  const eligible = []
  const rejected = []
  for (const brief of plan?.candidate_briefs ?? []) {
    const pool = hooks.filter(
      (hook) =>
        hook.candidate_id === brief.candidate_id &&
        hook.angle_index === brief.angle_index
    )
    const survivors = []
    for (const hook of pool) {
      const validation = hookTruthViolations(hook, envelope)
      if (validation.flags.length === 0) survivors.push(hook)
      else
        rejected.push({
          candidate_id: brief.candidate_id,
          hook_text: hook.text,
          ...validation,
        })
    }
    if (survivors.length === 0) continue
    const chosen = survivors.find((hook) => hook.is_recommended) ?? survivors[0]
    eligible.push(
      ...survivors.map((hook) => ({
        ...hook,
        is_recommended: hook === chosen,
      }))
    )
  }
  const coveredCandidates = new Set(eligible.map((hook) => hook.candidate_id))
  const expectedCandidates = new Set(
    (plan?.candidate_briefs ?? []).map((brief) => brief.candidate_id)
  )
  return {
    pass:
      expectedCandidates.size > 0 &&
      [...expectedCandidates].every((candidateId) =>
        coveredCandidates.has(candidateId)
      ),
    hooks: eligible,
    rejected,
  }
}

/** @returns {Record<string, any> | null} */
export function selectCandidateHook(brief, hooks) {
  const compatible = hooks.filter(
    (hook) =>
      hook.candidate_id === brief.candidate_id &&
      hook.angle_index === brief.angle_index
  )
  const recommended = compatible.filter((hook) => hook.is_recommended)
  if (compatible.length < 1 || recommended.length !== 1) return null
  return recommended[0]
}

/** @returns {{pass: boolean, flags: string[], details: string[]}} */
export function validateCandidateClaims(candidate, envelope, executionBrief = null) {
  const operationalFacts = normalize(
    [
      executionBrief?.campaign_objective?.desired_action,
      executionBrief?.upstream_context?.deep_brief?.decision_point,
      executionBrief?.upstream_context?.deep_brief?.honest_limit,
    ]
      .filter(Boolean)
      .join(' ')
  )
  const supported = [evidenceText(envelope), operationalFacts]
    .filter(Boolean)
    .join(' ')
  const candidateText = [candidate?.hook, candidate?.primary_text, candidate?.headline]
    .filter(Boolean)
    .join(' ')
  const standaloneNumbers = (value) =>
    normalize(value).match(/(?<![\p{L}])\d+(?:[.,]\d+)?(?![\p{L}])/gu) ?? []
  const supportedNumbers = new Set(standaloneNumbers(supported))
  const candidateNumbers = unique(standaloneNumbers(candidateText))
  const unsupported = candidateNumbers.filter((number) => !supportedNumbers.has(number))
  const unsupportedMeasuredWords = measuredWordFragments(candidateText).filter(
    (fragment) =>
      !measuredWordFragmentSupported(
        fragment,
        supported,
        normalize(candidateText)
      )
  )
  const allUnsupported = unique([...unsupported, ...unsupportedMeasuredWords])
  const normalizedCandidate = normalize(candidateText)
  const flags = []
  const details = []
  for (const fragment of allUnsupported) {
    const index = normalizedCandidate.indexOf(normalize(fragment))
    const window = normalizedCandidate.slice(
      Math.max(0, index - 90),
      Math.min(normalizedCandidate.length, index + String(fragment).length + 90)
    )
    if (MATERIAL_NUMBER_CONTEXT.test(window)) {
      flags.push('material_claim_fabrication')
      details.push(`Candidate uses an unsupported material number: ${fragment}`)
    } else {
      flags.push('unsupported_scene_detail')
      details.push(`Candidate uses an unsupported scene number: ${fragment}`)
    }
  }
  if (/[—–]/u.test(candidateText)) {
    flags.push('forbidden_dash')
    details.push('Candidate uses a forbidden long or medium dash; only the short hyphen is permitted.')
  }
  if (
    UNSUPPORTED_CATEGORY_BEHAVIOR.test(normalizedCandidate) ||
    UNSUPPORTED_SYSTEM_DESIGN_BEHAVIOR.test(normalizedCandidate)
  ) {
    flags.push('candidate_unsupported_category_claim')
    details.push('Candidate assigns unsupported behavior or absence to a tool category.')
  }
  const timePromise = normalizedCandidate.match(UNSOURCED_TIME_PROMISE)?.[0]
  if (timePromise && !supported.includes(timePromise)) {
    flags.push('candidate_unsupported_quantified_detail')
    details.push(`Candidate adds an unsupported time promise: ${timePromise}`)
  }
  const absoluteMeasurement = normalizedCandidate.match(
    UNSOURCED_ABSOLUTE_OR_MEASUREMENT
  )?.[0]
  if (absoluteMeasurement && !supported.includes(absoluteMeasurement)) {
    flags.push('candidate_unsupported_quantified_detail')
    details.push(
      `Candidate adds an unsupported absolute or measured relationship: ${absoluteMeasurement}`
    )
  }
  const definiteCounterfactual = normalizedCandidate.match(
    DEFINITE_COUNTERFACTUAL_LOSS
  )?.[0]
  if (
    definiteCounterfactual &&
    !DEFINITE_COUNTERFACTUAL_LOSS.test(supported)
  ) {
    flags.push('rhetorical_counterfactual_stronger_than_source')
    details.push(
      `Candidate states a possible no-offer loss more definitely than the source: ${definiteCounterfactual}`
    )
  }
  if (UNIQUENESS_OR_COMPARISON_CLAIM.test(normalizedCandidate)) {
    const findings = competitiveFindings(envelope)
    const citedFindingIds = candidate?.competitive_evidence_ids ?? []
    const hasVerifiedCompetitiveSupport =
      citedFindingIds.length > 0 &&
      citedFindingIds.every((id) => findings.get(id)?.verified === true)
    if (!hasVerifiedCompetitiveSupport) {
      flags.push('candidate_unverified_market_claim')
      details.push(
        'Candidate makes a comparison or uniqueness claim without verified competitive research.'
      )
    }
  }
  const uniqueFlags = unique(flags)
  const classified = classifyCopyFindings(uniqueFlags)
  return {
    pass:
      classified.system_errors.length === 0 &&
      classified.material_truth_blocks.length === 0,
    flags: uniqueFlags,
    system_errors: classified.system_errors,
    material_truth_blocks: classified.material_truth_blocks,
    quality_findings: classified.quality_findings,
    auto_fix_findings: classified.auto_fix_findings,
    details: unique(details),
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

const PERMITTED_SYNTHETIC_CHARACTER_FLAGS = new Set([
  'fake_testimonial',
  'disclosure_required',
])

/**
 * Current owner policy permits synthetic characters, attributed speech and
 * testimonial-style framing. These legacy flags remain schema-compatible but
 * are advisory only and can never block readiness.
 */
export function normalizePermittedSyntheticCharacterFlags(report) {
  const originalFlags = report?.kill_flags ?? []
  const killFlags = originalFlags.filter(
    (flag) => !PERMITTED_SYNTHETIC_CHARACTER_FLAGS.has(flag)
  )
  const syntheticOnlyFailure =
    originalFlags.length > 0 &&
    killFlags.length === 0 &&
    originalFlags.every((flag) =>
      PERMITTED_SYNTHETIC_CHARACTER_FLAGS.has(flag)
    )
  return {
    ...report,
    ...(syntheticOnlyFailure && report?.overall === 'fail'
      ? { overall: 'pass' }
      : {}),
    ...(syntheticOnlyFailure && report?.compliance_ok === false
      ? { compliance_ok: true }
      : {}),
    ...(syntheticOnlyFailure && Array.isArray(report?.principles)
      ? {
          principles: report.principles.map((principle) =>
            principle?.verdict === 'fail' &&
            /synthetic|testimonial|disclosure|actual_person/i.test(
              principle?.reason ?? ''
            )
              ? {
                  ...principle,
                  verdict: 'pass',
                  reason: `${principle.reason} Current owner policy permits this framing, so it is non-blocking.`,
                }
              : principle
          ),
        }
      : {}),
    kill_flags: killFlags,
  }
}

export { copyGatePasses, normalizeCopyGateReport }

const UNREPAIRABLE_FLAGS = new Set([
  'claim_violation',
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
  const normalizedReviews = (reviews ?? []).map((review) => ({
    ...review,
    critic: normalizeCopyGateReport(
      normalizePermittedSyntheticCharacterFlags(review.critic ?? {})
    ),
    judge: normalizeCopyGateReport(
      normalizePermittedSyntheticCharacterFlags(review.judge ?? {})
    ),
  }))
  const passed = new Set(
    normalizedReviews
      .filter(
        (review) =>
          copyGatePasses(review.judge) && copyGatePasses(review.critic)
      )
      .map((review) => review.candidate_id)
  )
  if (passed.size > 0) return null
  const eligible = candidates
    .map((candidate, order) => {
      const review = normalizedReviews.find(
        (item) => item.candidate_id === candidate.candidate_id
      )
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

export function routedDoctrineLessonIds(
  executionBrief,
  route = 'all_writers'
) {
  const active = new Set(
    executionBrief?.doctrine_bundle?.active_lesson_ids ?? []
  )
  return [
    ...new Set(
      (executionBrief?.trace?.lesson_routes ?? [])
        .filter(
          (entry) =>
            active.has(entry?.lesson_id) &&
            Array.isArray(entry?.routes) &&
            entry.routes.includes(route)
        )
        .map((entry) => entry.lesson_id)
    ),
  ]
}

/**
 * Doctrine loading is an orchestrator fact, not a writer memory test. The
 * writer may report additional active lessons it deliberately used, while the
 * runtime records every active lesson routed into that writer's prompt.
 */
export function normalizeCandidateDoctrineTrace(candidate, executionBrief) {
  const active = new Set(
    executionBrief?.doctrine_bundle?.active_lesson_ids ?? []
  )
  const reported = (candidate?.consumed_doctrine_lesson_ids ?? []).filter(
    (lessonId) => active.has(lessonId)
  )
  return {
    ...candidate,
    consumed_doctrine_lesson_ids: [
      ...new Set([
        ...routedDoctrineLessonIds(executionBrief, 'all_writers'),
        ...reported,
      ]),
    ],
  }
}

export function normalizeDoctrineTraceKillFlag(
  report,
  candidate,
  executionBrief
) {
  const required = routedDoctrineLessonIds(executionBrief, 'all_writers')
  const consumed = new Set(candidate?.consumed_doctrine_lesson_ids ?? [])
  const traceComplete =
    required.length > 0 && required.every((lessonId) => consumed.has(lessonId))
  if (!traceComplete) return report
  const killFlags = (report?.kill_flags ?? []).filter(
    (flag) => flag !== 'doctrine_bundle_mismatch'
  )
  const removedOnlyFlag =
    (report?.kill_flags ?? []).includes('doctrine_bundle_mismatch') &&
    killFlags.length === 0
  return {
    ...report,
    ...(removedOnlyFlag && report?.overall === 'fail'
      ? { overall: 'pass' }
      : {}),
    kill_flags: killFlags,
  }
}

/**
 * Turns the audit trail into the user-visible department result.
 * A portfolio ranking is necessary but never sufficient: the independent
 * critic and judge must both be clean, otherwise the candidate stays in the
 * audit trail and cannot be surfaced as ready copy.
 */
export function finalizeDepartmentDecision(candidates, reviews, portfolio) {
  const rankedIds = portfolio?.ranked_candidate_ids ?? []
  const rankedOrder = new Map(
    rankedIds.map((candidateId, index) => [candidateId, index])
  )
  const reviewById = new Map(
    (reviews ?? []).map((review) => [
      review.candidate_id,
      {
        ...review,
        critic: normalizeCopyGateReport(
          normalizePermittedSyntheticCharacterFlags(review.critic ?? {})
        ),
        judge: normalizeCopyGateReport(
          normalizePermittedSyntheticCharacterFlags(review.judge ?? {})
        ),
      },
    ])
  )
  const readyCandidates = (candidates ?? [])
    .filter((candidate) => {
      if (!rankedOrder.has(candidate.candidate_id)) return false
      const review = reviewById.get(candidate.candidate_id)
      return copyGatePasses(review?.judge) && copyGatePasses(review?.critic)
    })
    .sort(
      (left, right) =>
        rankedOrder.get(left.candidate_id) -
        rankedOrder.get(right.candidate_id)
    )

  return {
    output_status: readyCandidates.length ? 'ready_for_user' : 'blocked',
    recommended_candidate_id: readyCandidates[0]?.candidate_id ?? null,
    ready_candidates: readyCandidates,
    audited_candidates: candidates ?? [],
  }
}
