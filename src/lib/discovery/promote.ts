// Turns a Discovery deep analysis into the evidence rows an approved offer
// starts life with. Before this, approveCandidate read `deep_analysis` and
// threw it away: the promoted offer had zero facts, so UnderwritingOrchestrator
// scored it from the offer name alone and its own hard rules capped it
// ('data_confidence < 50' -> 'watch'; fewer than 5 verified facts -> nothing
// above 'small_paid_test'). Every discovered offer was structurally stuck.
//
// Pure on purpose — the DB writes live in src/lib/actions/discovery.ts.
import { z } from 'zod'

import {
  HARD_FILTER_STATUSES,
  SIGNAL_CONFIDENCES,
} from '@/types/agents/discovery'
import type { FactType } from '@/types/db'

// What is actually sitting in discovery_candidates.deep_analysis, as opposed to
// what DeepAnalysisSchema demands of a fresh run. Candidates analysed before
// Discovery v2 Phase B have no `signals`; older ones predate the quality rubric
// and have no `hard_filters` either. Validating those strictly would return
// null and approve them with nothing attached — the exact bug this module
// exists to fix. So: tolerate absence, never tolerate a wrong shape.
const StoredHardFilterSchema = z.object({
  status: z.enum(HARD_FILTER_STATUSES).optional(),
  evidence: z.string().optional(),
  source_url: z.string().nullable().optional(),
})

const StoredSignalSchema = z.object({
  value: z.string().optional(),
  confidence: z.enum(SIGNAL_CONFIDENCES).optional(),
  evidence: z.string().optional(),
})

export const StoredDeepAnalysisSchema = z.object({
  overall_score: z.number().optional(),
  summary: z.string().optional(),
  key_strengths: z.array(z.string()).optional(),
  key_risks: z.array(z.string()).optional(),
  estimated_commission: z.string().nullable().optional(),
  estimated_epc_band: z.string().nullable().optional(),
  network: z.string().nullable().optional(),
  recommended: z.boolean().optional(),
  must_verify_before_budget: z.array(z.string()).optional(),
  hard_filters: z
    .object({
      economics: StoredHardFilterSchema.optional(),
      paid_traffic: StoredHardFilterSchema.optional(),
      monetization_integrity: StoredHardFilterSchema.optional(),
      scale_ceiling: StoredHardFilterSchema.optional(),
    })
    .optional(),
  signals: z
    .object({
      demand_trend: StoredSignalSchema.optional(),
      scale_proxy: StoredSignalSchema.optional(),
      momentum: StoredSignalSchema.optional(),
      best_payout_route: StoredSignalSchema.optional(),
    })
    .optional(),
})

export type StoredDeepAnalysis = z.infer<typeof StoredDeepAnalysisSchema>
type StoredHardFilter = z.infer<typeof StoredHardFilterSchema>
type StoredSignal = z.infer<typeof StoredSignalSchema>

/** Parse a stored deep_analysis blob, keeping whatever the run did produce. */
export function parseStoredDeepAnalysis(raw: unknown): StoredDeepAnalysis | null {
  const parsed = StoredDeepAnalysisSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

/** Mirrors AUTO_VERIFY_MIN_CONFIDENCE in supabase/functions/ingest-source. */
export const PROMOTE_VERIFY_MIN_CONFIDENCE = 70

// A claim the model backed with a URL beats one it only read off the offer's
// own page. Both clear the verify bar; neither pretends to be hand-checked.
const CONFIDENCE_CITED = 85
const CONFIDENCE_OWN_PAGE = 75

const SIGNAL_CONFIDENCE: Record<string, number | null> = {
  high: 85,
  medium: 65,
  low: 45,
  unknown: null, // no evidence -> no fact
}

/**
 * Where a promoted fact came from. Kept explicit rather than keying off the URL
 * because the three cases are genuinely different provenance, and two of them
 * have no URL: a signal like "raised a Series B" comes from the model's web
 * research, and filing it under the offer's own page would claim that page said
 * something it never did.
 */
export type SourceKind = 'page' | 'cited' | 'research'

export type PromotedSource = {
  /** Stable handle a PromotedFact points at. */
  key: string
  kind: SourceKind
  url: string | null
  summary: string
  reliability: number
}

export type PromotedFact = {
  sourceKey: string
  fact_type: FactType
  fact_value: string
  source_quote: string
  confidence_score: number
}

export type Promotion = {
  sources: PromotedSource[]
  facts: PromotedFact[]
}

type FilterKey = keyof NonNullable<StoredDeepAnalysis['hard_filters']>

// What a resolved filter actually tells us. `fact_value` stays a short, faithful
// statement — the evidence prose goes into source_quote untouched, so nothing
// here invents a payout, a term, or a number the model didn't produce.
const FILTER_FACTS: Record<
  FilterKey,
  { fact_type: FactType; pass: string; fail: string }
> = {
  economics: {
    fact_type: 'other',
    pass: 'economics: payout supports a competitive EPC',
    fail: 'economics: payout too thin for a competitive EPC',
  },
  paid_traffic: {
    fact_type: 'traffic_rule_paid_social',
    pass: 'allowed',
    fail: 'forbidden',
  },
  monetization_integrity: {
    fact_type: 'other',
    pass: 'payment integrity: sane terms, no shaving reputation found',
    fail: 'payment integrity: shaving, late payment or punitive terms reported',
  },
  scale_ceiling: {
    fact_type: 'cap',
    pass: 'no punitive cap found',
    fail: 'capped or unable to absorb real volume',
  },
}

const SIGNAL_LABELS: Record<keyof NonNullable<StoredDeepAnalysis['signals']>, string> = {
  demand_trend: 'demand trend',
  scale_proxy: 'promoted at scale',
  momentum: 'momentum',
  best_payout_route: 'best payout route',
}

function isResolved(f: StoredHardFilter | undefined): f is StoredHardFilter {
  return f?.status === 'pass' || f?.status === 'fail'
}

// A signal is usable only if the model gave it a value AND said how well it
// could back it. Older runs stored signals without a confidence; those are
// unscoreable, so they stay out of the fact list.
// Real runs sometimes hand back values already wrapped in quotes ("35%
// recurring..."), which then read as part of the fact. Strip one balanced pair.
function unquote(value: string): string {
  const t = value.trim()
  const quoted =
    (t.startsWith('"') && t.endsWith('"')) || (t.startsWith('“') && t.endsWith('”'))
  return quoted && t.length > 1 ? t.slice(1, -1).trim() : t
}

function signalScore(s: StoredSignal | undefined): number | null {
  if (!s?.value || !s.confidence) return null
  if (s.value.trim().toLowerCase() === 'unknown') return null
  return SIGNAL_CONFIDENCE[s.confidence] ?? null
}

// Everything here is second-hand: the model's reading of a page, not a verbatim
// extraction, so all three sit below the 85-95 an official terms page earns in
// source_extraction. A cited third-party page still beats an uncited claim.
function describeSource(
  key: string,
  deep: StoredDeepAnalysis,
  candidateUrl: string | null
): PromotedSource {
  if (key === 'research') {
    return {
      key,
      kind: 'research',
      url: null,
      summary:
        'Discovery gap-fill research (web search). No single source page; each fact carries its own quote.',
      reliability: 55,
    }
  }
  if (key === 'page') {
    return {
      key,
      kind: 'page',
      url: candidateUrl,
      summary:
        `Discovery deep analysis of the offer's own page. ${deep.summary ?? ''}`.trim(),
      reliability: 60,
    }
  }
  return {
    key,
    kind: 'cited',
    url: key.slice('cited:'.length),
    summary: 'Cited by the Discovery deep analysis as evidence for a hard filter.',
    reliability: 70,
  }
}

/**
 * Fold a deep analysis into source documents + facts.
 *
 * Only `pass` / `fail` filters and evidenced signals become facts —
 * `unknown_verify` is the model saying it could not tell, and turning that into
 * a verified fact would be exactly the fabrication the rubric forbids. Those
 * items surface through buildOperatorNotes instead.
 */
export function deepAnalysisToFacts(
  deep: StoredDeepAnalysis | null | undefined,
  candidateUrl: string | null
): Promotion {
  if (!deep) return { sources: [], facts: [] }

  const facts: PromotedFact[] = []
  const push = (
    sourceKey: string,
    fact_type: FactType,
    fact_value: string,
    source_quote: string,
    confidence_score: number
  ) => {
    const value = unquote(fact_value)
    if (!value) return
    facts.push({
      sourceKey,
      fact_type,
      fact_value: value,
      source_quote: unquote(source_quote),
      confidence_score,
    })
  }
  // A filter with no source_url read it off the candidate's own page (the deep
  // prompt says so explicitly); signals carry no URL at all, so they belong to
  // the research pass rather than to any one document.
  const citedKey = (url: string | null) =>
    !url || url === candidateUrl ? 'page' : `cited:${url}`
  const RESEARCH = 'research'

  const filters = deep.hard_filters ?? ({} as NonNullable<StoredDeepAnalysis['hard_filters']>)
  for (const key of Object.keys(FILTER_FACTS) as FilterKey[]) {
    const filter = filters[key]
    if (!isResolved(filter)) continue
    const spec = FILTER_FACTS[key]
    const confidence = filter.source_url ? CONFIDENCE_CITED : CONFIDENCE_OWN_PAGE
    const value = filter.status === 'pass' ? spec.pass : spec.fail
    const key_ = citedKey(filter.source_url ?? null)
    push(key_, spec.fact_type, value, filter.evidence ?? '', confidence)

    // The economics filter is also where a stated commission and a derived EPC
    // band get their backing, so attach them to the same evidence.
    if (key === 'economics') {
      if (deep.estimated_commission) {
        push(
          key_,
          'commission_value',
          deep.estimated_commission,
          filter.evidence ?? '',
          confidence
        )
      }
      if (deep.estimated_epc_band) {
        push(
          key_,
          'other',
          `estimated EPC band: ${deep.estimated_epc_band}`,
          filter.evidence ?? '',
          confidence
        )
      }
    }
  }

  const signals = deep.signals ?? ({} as NonNullable<StoredDeepAnalysis['signals']>)
  for (const key of Object.keys(SIGNAL_LABELS) as (keyof typeof SIGNAL_LABELS)[]) {
    const signal = signals[key]
    const score = signalScore(signal)
    if (score == null) continue
    push(
      RESEARCH,
      'other',
      `${SIGNAL_LABELS[key]}: ${signal!.value}`,
      signal!.evidence ?? '',
      score
    )
  }

  if (deep.network) {
    const route = signals.best_payout_route
    push(
      RESEARCH,
      'other',
      `network: ${deep.network}`,
      route?.evidence ?? deep.summary ?? '',
      CONFIDENCE_OWN_PAGE
    )
  }

  // One source document per distinct provenance, in first-referenced order, so
  // the offer's fact list links each claim back to where it came from.
  const sources: PromotedSource[] = []
  const seen = new Set<string>()
  for (const f of facts) {
    if (seen.has(f.sourceKey)) continue
    seen.add(f.sourceKey)
    sources.push(describeSource(f.sourceKey, deep, candidateUrl))
  }

  return { sources, facts }
}

/**
 * Operator-facing digest of everything the analysis found that isn't a fact.
 *
 * Underwriting prompt v3 treats `operator_notes` as verified input and lifts
 * `data_confidence` for a substantial note, so this is where the unresolved
 * filters (`must_verify_before_budget`) and the qualitative read belong.
 */
export function buildOperatorNotes(deep: StoredDeepAnalysis | null | undefined): string {
  if (!deep) return ''
  const parts: string[] = ['Approved from Discovery Scanner.']

  if (deep.summary) parts.push(deep.summary)
  if (deep.key_strengths?.length) {
    parts.push(`Strengths: ${deep.key_strengths.join('; ')}`)
  }
  if (deep.key_risks?.length) {
    parts.push(`Risks: ${deep.key_risks.join('; ')}`)
  }
  if (deep.must_verify_before_budget?.length) {
    parts.push(
      `Verify before spending: ${deep.must_verify_before_budget.join('; ')}`
    )
  }

  return parts.join('\n\n')
}
