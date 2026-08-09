// Rule conformance for a stored deep analysis.
//
// docs/plan/07_EVAL_HARNESS.md specifies evals per orchestrator; what exists
// measures only whether Underwriting's verdict matches a golden label, and
// discovery has no eval at all. A labelled golden set is the owner's bottleneck
// (R10: 20 offers x 30 minutes), so this measures something that needs no
// labels: whether the model obeyed the rules its own prompt states.
//
// That is a genuine quality signal. A run where `recommended` drifts from the
// stated all-pass rule, or where filters are resolved without evidence, is
// producing verdicts an operator cannot trust — and you learn that without
// labelling anything.
import type { StoredDeepAnalysis } from '@/lib/discovery/promote'

export const RECOMMEND_MIN_SCORE = 55
/** Gate 0 in prompts/discovery_deep: a directory or listicle scores at most this. */
export const GATE0_MAX_SCORE = 20

const FILTER_KEYS = [
  'economics',
  'paid_traffic',
  'monetization_integrity',
  'scale_ceiling',
] as const

export type Violation = {
  rule: string
  detail: string
}

/**
 * Whether the rubric actually recommends this candidate.
 *
 * `deep.recommended` is a boolean we ask a language model to compute from a
 * purely mechanical rule ("all four hard_filters pass AND overall_score >= 55")
 * — and auditing the stored runs, it gets it wrong: candidates came back
 * recommended with paid_traffic marked `fail`, meaning the offer forbids the
 * traffic the operator would buy. Derive it instead of trusting it.
 *
 * Payloads that predate the rubric have no filters to derive from, so their
 * stored value stands.
 */
export function deriveRecommended(deep: StoredDeepAnalysis | null): boolean {
  if (!deep) return false
  const filters = deep.hard_filters
  if (!filters || FILTER_KEYS.every((k) => !filters[k])) {
    return deep.recommended ?? false
  }
  const allPass = FILTER_KEYS.every((k) => filters[k]?.status === 'pass')
  const score = deep.overall_score ?? 0
  return allPass && score >= RECOMMEND_MIN_SCORE
}


/**
 * Check one deep analysis against the hard rules in its prompt.
 *
 * Returns the rules it broke. An empty array means the output is internally
 * consistent — not that the judgement is correct, which is what a labelled set
 * would tell you.
 */
export function checkDeepAnalysis(deep: StoredDeepAnalysis | null): Violation[] {
  if (!deep) return [{ rule: 'unparseable', detail: 'deep_analysis did not parse' }]
  const v: Violation[] = []
  const filters = deep.hard_filters
  const score = deep.overall_score

  // Nothing to check on a payload that predates the rubric.
  if (!filters) return v

  const present = FILTER_KEYS.map((k) => filters[k]).filter(Boolean)
  const allPass =
    present.length === FILTER_KEYS.length &&
    FILTER_KEYS.every((k) => filters[k]?.status === 'pass')

  // "recommended = true ONLY if all four hard_filters are pass AND
  //  overall_score >= 55"
  if (deep.recommended === true) {
    if (!allPass) {
      v.push({
        rule: 'recommended_requires_all_pass',
        detail: `recommended=true but filters are ${FILTER_KEYS.map(
          (k) => `${k}:${filters[k]?.status ?? 'missing'}`
        ).join(', ')}`,
      })
    }
    if (typeof score === 'number' && score < RECOMMEND_MIN_SCORE) {
      v.push({
        rule: 'recommended_requires_min_score',
        detail: `recommended=true at score ${score} (< ${RECOMMEND_MIN_SCORE})`,
      })
    }
  }

  // The inverse is a softer signal, but a candidate that clears every stated
  // bar and is still not recommended means the rule is not what drives it.
  if (
    deep.recommended === false &&
    allPass &&
    typeof score === 'number' &&
    score >= RECOMMEND_MIN_SCORE
  ) {
    v.push({
      rule: 'unrecommended_despite_all_pass',
      detail: `all filters pass and score ${score} but recommended=false`,
    })
  }

  for (const key of FILTER_KEYS) {
    const f = filters[key]
    if (!f?.status) continue

    // "Put the exact quote/finding in `evidence`" — a verdict with no evidence
    // is unfalsifiable.
    if ((f.status === 'pass' || f.status === 'fail') && !f.evidence?.trim()) {
      v.push({ rule: 'resolved_filter_without_evidence', detail: `${key} is ${f.status} with no evidence` })
    }

    // "if still unknown after using the research -> unknown_verify AND add a
    //  line to must_verify_before_budget"
    if (f.status === 'unknown_verify' && !(deep.must_verify_before_budget?.length)) {
      v.push({
        rule: 'unknown_without_must_verify',
        detail: `${key} is unknown_verify but must_verify_before_budget is empty`,
      })
    }
  }

  // Signals must carry their evidence; "never guess" is explicit in the prompt.
  for (const [key, sig] of Object.entries(deep.signals ?? {})) {
    if (!sig?.value || sig.value.trim().toLowerCase() === 'unknown') continue
    if (sig.confidence && sig.confidence !== 'unknown' && !sig.evidence?.trim()) {
      v.push({
        rule: 'signal_without_evidence',
        detail: `${key} claims "${sig.value}" at ${sig.confidence} confidence with no evidence`,
      })
    }
  }

  return v
}

export type QualityReport = {
  total: number
  clean: number
  byRule: Record<string, number>
  /** Share of resolved hard filters that cite a source URL. */
  citedFilterRate: number
}

export function summarize(
  analyses: Array<StoredDeepAnalysis | null>
): QualityReport {
  const byRule: Record<string, number> = {}
  let clean = 0
  let resolved = 0
  let cited = 0

  for (const deep of analyses) {
    const violations = checkDeepAnalysis(deep)
    if (violations.length === 0) clean++
    for (const { rule } of violations) byRule[rule] = (byRule[rule] ?? 0) + 1

    for (const key of FILTER_KEYS) {
      const f = deep?.hard_filters?.[key]
      if (f?.status === 'pass' || f?.status === 'fail') {
        resolved++
        if (f.source_url) cited++
      }
    }
  }

  return {
    total: analyses.length,
    clean,
    byRule,
    citedFilterRate: resolved === 0 ? 0 : cited / resolved,
  }
}
