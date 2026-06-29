// Pure logic for the AdCopyOrchestrator — no IO, no LLM, no runtime deps.
// Kept dependency-free (type-only imports) so it unit-tests under plain
// `deno test` without resolving any npm package. The orchestrator (adCopy.ts)
// composes these with the LLM calls and validates the assembled output.
import type { AdCopyJudge, AdCopyResponse } from '../types/adCopy.ts'

// At most this many refine passes after the first write+judge (plan: refine <= 2).
export const MAX_REFINE = 2

// How many Taste Corpus examples to inject as few-shot per stage.
export const FEWSHOT_LIMIT = 6

export type TasteExample = {
  kind: 'copy' | 'avatar'
  lang: 'he' | 'en'
  text: string
  improved_text?: string | null
  label: 'good' | 'bad'
  reason?: string | null
}

type Payload = AdCopyResponse['payload']

// Cost guard: a generation that has already spent at/above the cap must stop
// before incurring the next stage. Mirrors costCap.isOverDailyCap semantics.
export function isOverCostCap(accumUsd: number, maxUsd: number): boolean {
  return accumUsd >= maxUsd
}

// Few-shot selection: examples of the right kind + language, `good` first
// (imitate good; see bad only as contrast), capped to `limit`.
export function selectFewShot(
  corpus: TasteExample[],
  kind: 'copy' | 'avatar',
  lang: 'he' | 'en',
  limit = FEWSHOT_LIMIT
): TasteExample[] {
  const matching = corpus.filter((e) => e.kind === kind && e.lang === lang)
  const good = matching.filter((e) => e.label === 'good')
  const bad = matching.filter((e) => e.label === 'bad')
  return [...good, ...bad].slice(0, limit)
}

// Refine decision: keep refining while the judge flags a fixable problem
// (a failed principle or a compliance miss) AND we are under the pass cap.
// The judge is advisory — it drives refinement, it does not reject the run.
export function shouldRefine(
  judge: AdCopyJudge,
  iterations: number,
  maxRefine = MAX_REFINE
): boolean {
  if (iterations >= maxRefine) return false
  const anyPrincipleFailed = judge.principles.some((p) => p.verdict === 'fail')
  return anyPrincipleFailed || !judge.compliance_ok
}

// Serialize a stage's structured input for the model. Stable, pretty JSON so
// prompt diffs are readable and few-shot blocks render predictably.
export function buildStageUserMessage(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, null, 2)
}

// Build the envelope+payload object from stage outputs. Confidence = fraction of
// principles passed; a compliance miss forces human review and a 'partial' status.
// Pure: returns the object; the orchestrator validates it against the Zod schema.
export function assembleResponse(parts: {
  productExcavation: Payload['product_excavation']
  avatarExcavation: Payload['avatar_excavation']
  angles: Payload['angles']
  hooks: Payload['hooks']
  variants: Payload['variants']
  judge: AdCopyJudge
  refineIterations: number
}): AdCopyResponse {
  const passed = parts.judge.principles.filter((p) => p.verdict === 'pass').length
  const confidence = Math.round((passed / 3) * 100)
  const anyFailed = parts.judge.principles.some((p) => p.verdict === 'fail')
  const needsReview = !parts.judge.compliance_ok || anyFailed

  const reasons: string[] = []
  if (!parts.judge.compliance_ok) reasons.push('Judge flagged a compliance issue.')
  if (anyFailed) reasons.push('One or more quality principles failed (judge advisory).')

  return {
    orchestrator_name: 'AdCopyOrchestrator',
    agent_version: 'v1',
    status: parts.judge.compliance_ok ? 'success' : 'partial',
    confidence_score: confidence,
    facts: [],
    assumptions: [],
    estimates: [],
    risks: parts.judge.compliance_ok
      ? []
      : [
          {
            type: 'compliance',
            description:
              'Judge marked the copy as non-compliant; review before publishing.',
            severity: 'high',
          },
        ],
    unknowns: [],
    missing_data: [],
    human_review_required: needsReview,
    human_review_reasons: reasons,
    payload: {
      product_excavation: parts.productExcavation,
      avatar_excavation: parts.avatarExcavation,
      angles: parts.angles,
      hooks: parts.hooks,
      variants: parts.variants,
      judge: parts.judge,
      refine_iterations: parts.refineIterations,
    },
  }
}
