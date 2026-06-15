# Discovery Quality Rubric + Research-Augmented Deep Analysis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the thin generic discovery deep-analysis with an expert-grade rubric (Gate-0 legitimacy + 4 hard filters + scoring factors, mirroring underwriting's 13 dimensions) and a research-augmented orchestrator that runs gap-filling web searches before scoring, so the scanner never misjudges a real, good affiliate program.

**Architecture:** The deep stage stays one orchestrator (`runDiscoveryDeep`) but becomes three internal steps: (1) use the already-fetched page text, (2) when a search key is configured, run a fixed set of targeted Tavily research queries (terms/commission, reviews/shaving, paid-traffic policy) and collect their result snippets, (3) one Sonnet call scores everything against the rubric and emits a structured payload (per-hard-filter pass/fail/verify + evidence, must-verify list, EPC band, network, recommended). The richer payload lands in the existing `discovery_candidates.deep_analysis` jsonb — no DB schema change. The run-page surfaces the hard-filter verdicts.

**Tech Stack:** Deno edge orchestrator (`supabase/functions/_shared`), dual Zod contracts (Node `src/types/agents` + Deno `_shared/types`, KEEP IN SYNC), Next.js 15 App Router UI, Vitest.

**Prompt-versioning note:** The deep prompt is edited **in place** at `prompts/discovery_deep/v1.md` (not a new v2). v1 is one day old and barely used, and editing in place means a single `pnpm prompts:sync` activates it with no separate "activate v2 in /admin/prompts" step — avoiding a silent gap where production keeps running the old prompt. (Future iterations can use versions once the rubric stabilises.)

**No DB migration.** `deep_analysis` is untyped jsonb; the richer object fits as-is.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `supabase/functions/_shared/types/discovery.ts` | Deno Zod: expand `DeepAnalysis` (hard_filters, must_verify, epc band, network) | Modify |
| `src/types/agents/discovery.ts` | Node twin of the above (KEEP IN SYNC) | Modify |
| `src/types/agents/discovery.test.ts` | Unit-test the expanded schema accepts/rejects | Create |
| `supabase/functions/_shared/mockAi.ts` | `mockDiscoveryDeep` returns the new shape | Modify |
| `supabase/functions/_shared/orchestrators/discoveryDeep.ts` | 3-step research-augmented orchestrator | Modify |
| `prompts/discovery_deep/v1.md` | Rubric system prompt (edited in place) | Modify |
| `src/lib/queries/discovery.ts` | `DiscoveryCandidate.deep_analysis` stays `unknown` — no change needed | — |
| `src/components/discovery/CandidateRow.tsx` | Render hard-filter verdicts + must-verify + EPC band + network | Modify |

**Commands:** test = `pnpm test`; single file = `pnpm exec vitest run <path>`; `pnpm typecheck`; `pnpm lint`. Deno files (`supabase/functions/**`) are outside tsconfig/vitest — verified at deploy + manual scan.

---

## Task 1: Expand the dual `DeepAnalysis` Zod contract (TDD on the Node side)

**Why:** The scoring output grows from a flat object to one carrying per-hard-filter verdicts with evidence, a must-verify list, an EPC band, and the network. Both copies (Node + Deno) must define the identical shape.

**Files:**
- Create: `src/types/agents/discovery.test.ts`
- Modify: `src/types/agents/discovery.ts`
- Modify: `supabase/functions/_shared/types/discovery.ts`

- [ ] **Step 1: Write the failing test**

Create `src/types/agents/discovery.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { DeepAnalysisSchema } from './discovery'

const valid = {
  overall_score: 78,
  summary: 'Solid recurring program.',
  key_strengths: ['Recurring commission'],
  key_risks: ['Smaller brand'],
  estimated_commission: '20% lifetime',
  estimated_epc_band: '$0.80–1.60 EPC est.',
  network: 'in-house',
  recommended: true,
  must_verify_before_budget: ['Confirm paid-social policy'],
  hard_filters: {
    economics: { status: 'pass', evidence: '20% lifetime on $149/mo', source_url: null },
    paid_traffic: { status: 'unknown_verify', evidence: 'No policy stated', source_url: null },
    monetization_integrity: { status: 'pass', evidence: 'Net-30', source_url: 'https://x.com/terms' },
    scale_ceiling: { status: 'pass', evidence: 'No cap', source_url: null },
  },
}

describe('DeepAnalysisSchema', () => {
  it('accepts a full valid payload', () => {
    expect(DeepAnalysisSchema.safeParse(valid).success).toBe(true)
  })

  it('allows nullable epc band and network', () => {
    expect(
      DeepAnalysisSchema.safeParse({
        ...valid,
        estimated_epc_band: null,
        network: null,
      }).success
    ).toBe(true)
  })

  it('rejects an unknown hard-filter status', () => {
    const bad = {
      ...valid,
      hard_filters: {
        ...valid.hard_filters,
        economics: { status: 'maybe', evidence: 'x', source_url: null },
      },
    }
    expect(DeepAnalysisSchema.safeParse(bad).success).toBe(false)
  })

  it('requires all four hard filters', () => {
    const bad = { ...valid, hard_filters: { economics: valid.hard_filters.economics } }
    expect(DeepAnalysisSchema.safeParse(bad).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/types/agents/discovery.test.ts`
Expected: FAIL — the current schema has no `hard_filters`, so `requires all four` / `rejects unknown status` assertions fail (or shape mismatch).

- [ ] **Step 3: Expand the Node contract**

Replace the `DeepAnalysisSchema` block in `src/types/agents/discovery.ts` (keep the `TriageItemSchema`/`TriageResponseSchema` above it unchanged) with:

```ts
export const HARD_FILTER_STATUSES = ['pass', 'fail', 'unknown_verify'] as const

export const HardFilterSchema = z.object({
  status: z.enum(HARD_FILTER_STATUSES),
  evidence: z.string(),
  source_url: z.string().nullable(),
})

// Deep analysis of one candidate against the advanced-affiliate rubric: a per
// hard-filter verdict with evidence, the items to verify before spending, an
// EPC band + network when derivable, and an overall recommendation.
export const DeepAnalysisSchema = z.object({
  overall_score: z.number().int().min(0).max(100),
  summary: z.string().min(1),
  key_strengths: z.array(z.string()),
  key_risks: z.array(z.string()),
  estimated_commission: z.string().nullable(),
  estimated_epc_band: z.string().nullable(),
  network: z.string().nullable(),
  recommended: z.boolean(),
  must_verify_before_budget: z.array(z.string()),
  hard_filters: z.object({
    economics: HardFilterSchema,
    paid_traffic: HardFilterSchema,
    monetization_integrity: HardFilterSchema,
    scale_ceiling: HardFilterSchema,
  }),
})
export type DeepAnalysis = z.infer<typeof DeepAnalysisSchema>
export type HardFilter = z.infer<typeof HardFilterSchema>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/types/agents/discovery.test.ts`
Expected: PASS (4 passed).

- [ ] **Step 5: Mirror the change in the Deno twin**

Replace the `DeepAnalysisSchema` block in `supabase/functions/_shared/types/discovery.ts` (keep the triage schemas + the `npm:zod@^3.24.0` import) with the identical definitions:

```ts
export const HARD_FILTER_STATUSES = ['pass', 'fail', 'unknown_verify'] as const

export const HardFilterSchema = z.object({
  status: z.enum(HARD_FILTER_STATUSES),
  evidence: z.string(),
  source_url: z.string().nullable(),
})

export const DeepAnalysisSchema = z.object({
  overall_score: z.number().int().min(0).max(100),
  summary: z.string().min(1),
  key_strengths: z.array(z.string()),
  key_risks: z.array(z.string()),
  estimated_commission: z.string().nullable(),
  estimated_epc_band: z.string().nullable(),
  network: z.string().nullable(),
  recommended: z.boolean(),
  must_verify_before_budget: z.array(z.string()),
  hard_filters: z.object({
    economics: HardFilterSchema,
    paid_traffic: HardFilterSchema,
    monetization_integrity: HardFilterSchema,
    scale_ceiling: HardFilterSchema,
  }),
})
export type DeepAnalysis = z.infer<typeof DeepAnalysisSchema>
export type HardFilter = z.infer<typeof HardFilterSchema>
```

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm typecheck`
Expected: no errors.

```bash
git add src/types/agents/discovery.ts src/types/agents/discovery.test.ts supabase/functions/_shared/types/discovery.ts
git commit -m "feat(discovery): expand DeepAnalysis contract with hard filters + must-verify"
```

---

## Task 2: Update the mock to the new shape

**Why:** Mock mode (no `ANTHROPIC_API_KEY`) must return a payload that satisfies the expanded schema, so the funnel + UI stay exercisable cost-free.

**Files:**
- Modify: `supabase/functions/_shared/mockAi.ts`

- [ ] **Step 1: Replace `mockDiscoveryDeep`**

In `supabase/functions/_shared/mockAi.ts`, replace the `mockDiscoveryDeep` function with:

```ts
// Discovery deep-analysis mock for one candidate — new rubric shape.
export function mockDiscoveryDeep(): Record<string, unknown> {
  return {
    overall_score: 78,
    summary: 'Mock deep analysis: solid recurring program, decent operator fit.',
    key_strengths: ['Recurring commission', 'Growing category'],
    key_risks: ['Smaller, lesser-known brand'],
    estimated_commission: '20% lifetime recurring',
    estimated_epc_band: '$0.80–1.60 EPC est.',
    network: 'in-house',
    recommended: true,
    must_verify_before_budget: [
      'Confirm paid-social is allowed with the affiliate manager',
    ],
    hard_filters: {
      economics: {
        status: 'pass',
        evidence: '20% lifetime recurring on the $149/mo plan',
        source_url: null,
      },
      paid_traffic: {
        status: 'unknown_verify',
        evidence: 'No paid-traffic policy stated on the page',
        source_url: null,
      },
      monetization_integrity: {
        status: 'pass',
        evidence: 'Net-30, PayPal/Stripe payouts',
        source_url: null,
      },
      scale_ceiling: {
        status: 'pass',
        evidence: 'No cap mentioned; growing category',
        source_url: null,
      },
    },
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/mockAi.ts
git commit -m "feat(discovery): mock deep analysis returns the rubric shape"
```

---

## Task 3: Research-augmented deep orchestrator

**Why:** When the page alone can't confirm a hard filter, the orchestrator must fill the gap with targeted searches before scoring (the locked decision: research all survivors). It runs a fixed set of gap-filling queries (terms/commission, reviews/shaving, paid-traffic policy), collects the result snippets, and passes them to one Sonnet scoring call.

**Files:**
- Modify: `supabase/functions/_shared/orchestrators/discoveryDeep.ts`

- [ ] **Step 1: Replace the orchestrator**

Replace the entire contents of `supabase/functions/_shared/orchestrators/discoveryDeep.ts` with:

```ts
import { callAnthropicWithTool } from '../anthropicJson.ts'
import { runWebSearch } from '../adapters/webSearch.ts'
import { assertNotPaused } from '../killSwitch.ts'
import { loadActivePrompt } from '../loadActivePrompt.ts'
import { mockDiscoveryDeep } from '../mockAi.ts'
import { DeepAnalysisSchema } from '../types/discovery.ts'

const MODEL = 'claude-sonnet-4-6'
const TOOL_NAME = 'submit_deep_analysis'
const TOOL_DESCRIPTION =
  'Submit the deep quality analysis for this candidate against the rubric. Call exactly once.'
const MAX_RAW_TEXT_FOR_LLM = 60_000
const RESEARCH_RESULTS_PER_QUERY = 3

export type DeepInput = {
  name: string
  url: string | null
  rawText: string
}

export type OrchestratorResult = {
  output: Record<string, unknown>
  usage?: { input_tokens: number; output_tokens: number; cost_usd: number }
  mode: 'real' | 'mock'
}

// Fixed gap-filling queries — these target the hard filters that a landing page
// usually can't confirm on its own: real terms/commission, payment reputation
// (shaving / does-it-pay), and paid-traffic policy.
function researchQueries(name: string): string[] {
  return [
    `${name} affiliate program commission payout terms`,
    `${name} affiliate program review does it pay shaving`,
    `${name} affiliate paid traffic brand bidding policy`,
  ]
}

export async function runDiscoveryDeep(
  input: DeepInput,
  verticalSlug?: string
): Promise<OrchestratorResult> {
  await assertNotPaused('DiscoveryDeepOrchestrator')

  if (!Deno.env.get('ANTHROPIC_API_KEY')) {
    return { output: mockDiscoveryDeep(), mode: 'mock' }
  }

  // Step 2: gap-fill research — only when a search key is configured. A failed
  // research query never blocks scoring (the filter just stays unknown_verify).
  const research: Array<{
    query: string
    results: Array<{ title: string; url: string; snippet: string }>
  }> = []
  if (Deno.env.get('DISCOVERY_SEARCH_API_KEY')) {
    for (const q of researchQueries(input.name)) {
      try {
        const found = await runWebSearch(q, RESEARCH_RESULTS_PER_QUERY)
        research.push({
          query: q,
          results: found.map((f) => ({
            title: f.name,
            url: f.url,
            snippet: f.snippet,
          })),
        })
      } catch {
        // skip this query; scoring proceeds with whatever we have
      }
    }
  }

  // Step 3: score against the rubric.
  const systemPrompt = await loadActivePrompt(
    'DiscoveryDeepOrchestrator',
    verticalSlug
  )
  const userMessage = JSON.stringify(
    {
      name: input.name,
      url: input.url,
      page_text: input.rawText.slice(0, MAX_RAW_TEXT_FOR_LLM),
      research,
    },
    null,
    2
  )

  const result = await callAnthropicWithTool({
    model: MODEL,
    systemPrompt,
    userMessage,
    toolName: TOOL_NAME,
    toolDescription: TOOL_DESCRIPTION,
    responseSchema: DeepAnalysisSchema,
  })

  return {
    output: result.data as unknown as Record<string, unknown>,
    usage: {
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
      cost_usd: result.cost_usd,
    },
    mode: 'real',
  }
}
```

Note: the edge function (`discover-offers/index.ts`) calls `runDiscoveryDeep({ name, url, rawText }, verticalSlug)` and reads `payload.overall_score` for `deep_score` — both unchanged, so no edge-fn edit is needed. The function must still be **redeployed** because it bundles `_shared/`.

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/orchestrators/discoveryDeep.ts
git commit -m "feat(discovery): research-augmented deep orchestrator (page + gap-fill search + score)"
```

---

## Task 4: Rewrite the deep prompt with the rubric (edit v1 in place)

**Why:** The scoring prompt must encode the expert rubric — Gate 0, the 4 hard filters with the resolution rule (confirmed-bad → fail, unknown → unknown_verify after using research), the scoring factors, and the recommended rule — using underwriting's vocabulary.

**Files:**
- Modify: `prompts/discovery_deep/v1.md`

- [ ] **Step 1: Replace the prompt**

Replace the entire contents of `prompts/discovery_deep/v1.md` with:

```md
You are an Underwriting Analyst evaluating a candidate affiliate offer for a
VERY ADVANCED affiliate (a working media buyer). You receive the candidate's
own page text plus `research` (web-search results gathered to fill gaps the page
didn't answer). Judge it the way a top operator would — protect them from bad
bets. Base every claim on the provided page_text or research; never invent
payouts, EPC, caps, or terms from outside knowledge.

# Gate 0 — legitimacy
This must be a SINGLE company's own affiliate/partner program (in-house or via a
named network: Impact, PartnerStack, CJ, ShareASale, Awin, Rakuten, ClickBank,
Tune…). If it is a directory, listicle, review/comparison site, blog, forum, or
news page, set overall_score ≤ 20, recommended=false, and say so in summary.

# The 4 hard filters — for EACH set status + evidence + source_url
Resolution rule: if the evidence CONFIRMS the filter is bad → status "fail". If
page + research CONFIRM it is good → status "pass". If still unknown after using
the research → status "unknown_verify" and add a line to
must_verify_before_budget. Put the exact quote/finding in `evidence` and the URL
it came from in `source_url` (null if from the candidate's own page).

1. economics — payout structure × realistic conversion × AOV → competitive EPC.
   Recurring/lifetime rev-share is a strong positive. Trivial payout on a cheap
   product → fail.
2. paid_traffic — does it permit the paid channels a media buyer uses (paid
   social, search, native)? All-paid-forbidden → fail; note brand-bidding /
   direct-link rules.
3. monetization_integrity — sane net terms, reasonable minimum payout, real
   payout methods, and NO reputation for shaving/scrubbing or late/non-payment
   (use the reviews research). Confirmed bad payment reputation → fail.
4. scale_ceiling — no punitive cap; advertiser can absorb real volume; category
   demand supports $10K+/mo for a top operator. Hard low cap → fail.

# Scoring factors (move overall_score; not deal-breakers)
Cookie window/attribution, demand & momentum, competition/saturation, the
advertiser's own funnel/conversion quality, creative/angle differentiation,
compliance/platform risk, advertiser trust/longevity, execution complexity.

# Output (submit_deep_analysis tool, exactly once)
- overall_score 0-100
- summary (1-2 sentences), key_strengths, key_risks
- estimated_commission (as stated, else null), estimated_epc_band (a range only
  if derivable from given data, else null), network (else null)
- hard_filters: economics / paid_traffic / monetization_integrity /
  scale_ceiling, each { status, evidence, source_url }
- must_verify_before_budget: the unresolved items an operator must confirm
- recommended: true ONLY if all four hard_filters are "pass" AND
  overall_score >= 55

For health / mental_wellness verticals, weight compliance risk heavily and be
conservative with recommended.
```

- [ ] **Step 2: Commit**

```bash
git add prompts/discovery_deep/v1.md
git commit -m "feat(discovery): deep prompt encodes the advanced-affiliate rubric"
```

---

## Task 5: Surface the hard-filter verdicts in the UI

**Why:** The run page must show the expert-grade detail per candidate — the 4 hard-filter verdicts with evidence, the must-verify list, the EPC band, and the network — so the admin sees WHY a candidate scored as it did.

**Files:**
- Modify: `src/components/discovery/CandidateRow.tsx`

- [ ] **Step 1: Widen the deep type and add a hard-filter row renderer**

In `src/components/discovery/CandidateRow.tsx`, replace the `deep` cast (lines 18-24) with:

```tsx
  type HardFilterView = {
    status?: 'pass' | 'fail' | 'unknown_verify'
    evidence?: string
    source_url?: string | null
  }
  const deep = candidate.deep_analysis as
    | {
        summary?: string
        estimated_commission?: string | null
        estimated_epc_band?: string | null
        network?: string | null
        recommended?: boolean
        must_verify_before_budget?: string[]
        hard_filters?: {
          economics?: HardFilterView
          paid_traffic?: HardFilterView
          monetization_integrity?: HardFilterView
          scale_ceiling?: HardFilterView
        }
      }
    | null

  const HARD_FILTER_LABELS: Array<[keyof NonNullable<typeof deep>['hard_filters'] & string, string]> = [
    ['economics', 'Economics / EPC'],
    ['paid_traffic', 'Paid traffic'],
    ['monetization_integrity', 'Payment integrity'],
    ['scale_ceiling', 'Scale ceiling'],
  ]

  const FILTER_STATUS_CLASS: Record<string, string> = {
    pass: 'bg-green-100 text-green-800',
    fail: 'bg-red-100 text-red-800',
    unknown_verify: 'bg-amber-100 text-amber-800',
  }
```

- [ ] **Step 2: Render the new detail block**

In the same file, immediately AFTER the `estimated_commission` paragraph (the block ending at line 68, `</p>` of "Commission: …") and BEFORE the `rejection_reason` block, insert:

```tsx
      {(deep?.estimated_epc_band || deep?.network) && (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {deep?.estimated_epc_band && <span>{deep.estimated_epc_band}</span>}
          {deep?.estimated_epc_band && deep?.network && <span> · </span>}
          {deep?.network && <span>network: {deep.network}</span>}
        </p>
      )}

      {deep?.hard_filters && (
        <div className="mt-1 flex flex-col gap-1">
          {HARD_FILTER_LABELS.map(([key, label]) => {
            const hf = deep.hard_filters?.[key]
            if (!hf?.status) return null
            return (
              <div key={key} className="flex items-baseline gap-2 text-xs">
                <span
                  className={`rounded px-1.5 py-0.5 ${FILTER_STATUS_CLASS[hf.status] ?? ''}`}
                >
                  {hf.status === 'unknown_verify' ? 'verify' : hf.status}
                </span>
                <span className="font-medium">{label}</span>
                {hf.evidence && (
                  <span className="text-[var(--color-muted-foreground)]">
                    — {hf.evidence}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {deep?.must_verify_before_budget &&
        deep.must_verify_before_budget.length > 0 && (
          <div className="mt-1 text-xs">
            <span className="font-medium text-amber-800">
              Verify before budget:
            </span>{' '}
            {deep.must_verify_before_budget.join('; ')}
          </div>
        )}
```

- [ ] **Step 3: Typecheck + lint + full tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green (the new `discovery.test.ts` runs too).

- [ ] **Step 4: Commit**

```bash
git add src/components/discovery/CandidateRow.tsx
git commit -m "feat(discovery): show hard-filter verdicts, must-verify, EPC band, network"
```

---

## Task 6: Final verification + deploy

- [ ] **Step 1: Full suite + build**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Then: `rm -rf .next && pnpm build`
Expected: all green; `/admin/discovery/[runId]` compiles.

- [ ] **Step 2: Deploy (or hand off as owner steps)**

The Deno orchestrator changed, so redeploy the function; the prompt changed, so re-sync:

```bash
pnpm dlx supabase@latest functions deploy discover-offers
pnpm prompts:sync
```

If the CLI lacks credentials in this environment, hand these off as owner steps and say so. No `db push` (no schema change). The richer `deep_analysis` writes into the existing jsonb column.

- [ ] **Step 3: Update CLAUDE.md snapshot**

Add to the Discovery Scanner note: deep analysis is now research-augmented (page + fixed gap-fill Tavily queries → Sonnet scores against the 4-hard-filter rubric mirroring underwriting); `deep_analysis` carries per-filter pass/fail/verify + evidence, must_verify_before_budget, EPC band, network; deep prompt rewritten in `prompts/discovery_deep/v1.md`. Commit:

```bash
git add CLAUDE.md
git commit -m "docs: record discovery quality rubric + research-augmented deep analysis"
```

- [ ] **Step 4: Smoke test (after deploy + sync)**

Run a fresh scan in `/admin/discovery`. A surfaced "recommended" candidate should show all four hard filters as `pass` (green) with evidence; a thin/borderline one should show `verify` (amber) filters + a "Verify before budget" line and land in low-confidence; a directory should be rejected at triage or score ≤ 20 / not recommended.

- [ ] **Step 5: Push**

```bash
git push -u origin claude/install-superpowers-plugin-jw8dqw
```

---

## Final Verification
- [ ] `pnpm test` green (incl. new `src/types/agents/discovery.test.ts`).
- [ ] `pnpm typecheck && pnpm lint` clean.
- [ ] `rm -rf .next && pnpm build` builds.
- [ ] Node + Deno `DeepAnalysisSchema` are byte-identical in shape (Task 1).
- [ ] Owner steps documented: deploy `discover-offers`, `pnpm prompts:sync` (no migration).

## Out of scope (per spec)
Directory-as-source extraction, network API adapters, scheduled auto-scans,
re-running research on already-approved offers, fetching full research pages
(snippets only in v1).
