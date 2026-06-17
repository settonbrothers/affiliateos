# Discovery v2 Phase B — Enrichment Signals

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attach the four buyer-grade enrichment signals to every deep-analyzed offer — where it pays most (#2), proof it's run at scale (#4 proxy), demand trend + lifecycle stage (#5), and funding/exit momentum (#6) — plus fold the v2 rubric factors (lifecycle timing, funnel quality, churn, geo/seasonality) into the score.

**Architecture:** The deep stage already does research-augmented scoring (page fetch + gap-fill Tavily searches → one Sonnet call against the rubric). Phase B adds two more gap-fill queries (momentum, best-payout), expands the `DeepAnalysis` contract with a `signals` object, and rewrites the deep prompt to emit those signals + weigh the new factors. The richer object fits the existing `discovery_candidates.deep_analysis` jsonb — no migration. The run page renders the signals under each candidate.

**Tech Stack:** Deno edge orchestrator (`supabase/functions/_shared`), dual Zod contracts (Node `src/types/agents` + Deno `_shared/types`, KEEP IN SYNC), Vitest, Next.js 15 App Router UI, CI deploy via the existing `deploy-edge.yml` + `sync-prompts.yml` workflows.

**No DB migration. No new secrets** (reuses `DISCOVERY_SEARCH_API_KEY` + `ANTHROPIC_API_KEY`). #4 is a **proxy** (real spy tools / Meta Ad Library are a later phase).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/types/agents/discovery.ts` | Node Zod: add `SignalSchema` + `signals` on `DeepAnalysis` | Modify |
| `supabase/functions/_shared/types/discovery.ts` | Deno twin (KEEP IN SYNC) | Modify |
| `src/types/agents/discovery.test.ts` | Tests for the `signals` shape | Modify |
| `supabase/functions/_shared/mockAi.ts` | `mockDiscoveryDeep` returns `signals` | Modify |
| `supabase/functions/_shared/orchestrators/discoveryDeep.ts` | Add momentum + best-payout research queries | Modify |
| `prompts/discovery_deep/v1.md` | Emit `signals` + weigh v2 rubric factors | Modify |
| `src/components/discovery/CandidateRow.tsx` | Render the four signals | Modify |

**Commands:** test = `pnpm test`; single = `pnpm exec vitest run <path>`; `pnpm typecheck`; `pnpm lint`. Deno files verified at deploy.

---

## Task 1: Add the `signals` contract (TDD)

**Why:** Each candidate gains four signals, each a `{ value, confidence, evidence }` triple. Both Zod copies (Node + Deno) must define the identical shape.

**Files:**
- Modify: `src/types/agents/discovery.ts`
- Modify: `supabase/functions/_shared/types/discovery.ts`
- Modify: `src/types/agents/discovery.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/types/agents/discovery.test.ts`, extend the `valid` object used by the `DeepAnalysisSchema` tests so it includes `signals` (add this property inside the existing `valid` literal, after `hard_filters`):

```ts
  signals: {
    demand_trend: { value: 'rising', confidence: 'medium', evidence: 'Search interest up' },
    scale_proxy: { value: 'widely promoted', confidence: 'low', evidence: 'Appears in many roundups' },
    momentum: { value: 'Series B 2026', confidence: 'high', evidence: 'TechCrunch' },
    best_payout_route: { value: 'Impact — $200/sale', confidence: 'medium', evidence: 'PostAffiliatePro' },
  },
```

Then add a dedicated describe block at the end of the file:

```ts
describe('DeepAnalysisSchema signals', () => {
  const base = {
    overall_score: 70,
    summary: 's',
    key_strengths: [],
    key_risks: [],
    estimated_commission: null,
    estimated_epc_band: null,
    network: null,
    recommended: false,
    must_verify_before_budget: [],
    hard_filters: {
      economics: { status: 'pass', evidence: 'e', source_url: null },
      paid_traffic: { status: 'pass', evidence: 'e', source_url: null },
      monetization_integrity: { status: 'pass', evidence: 'e', source_url: null },
      scale_ceiling: { status: 'pass', evidence: 'e', source_url: null },
    },
    signals: {
      demand_trend: { value: 'rising', confidence: 'medium', evidence: 'x' },
      scale_proxy: { value: 'unknown', confidence: 'unknown', evidence: 'x' },
      momentum: { value: 'none found', confidence: 'low', evidence: 'x' },
      best_payout_route: { value: 'in-house', confidence: 'low', evidence: 'x' },
    },
  }

  it('accepts a payload with all four signals', () => {
    expect(DeepAnalysisSchema.safeParse(base).success).toBe(true)
  })

  it('rejects an invalid signal confidence', () => {
    const bad = {
      ...base,
      signals: {
        ...base.signals,
        demand_trend: { value: 'rising', confidence: 'sometimes', evidence: 'x' },
      },
    }
    expect(DeepAnalysisSchema.safeParse(bad).success).toBe(false)
  })

  it('requires all four signal keys', () => {
    const { best_payout_route: _omit, ...partial } = base.signals
    expect(
      DeepAnalysisSchema.safeParse({ ...base, signals: partial }).success
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/types/agents/discovery.test.ts`
Expected: FAIL — `signals` not in schema (the "accepts" / "requires all four" cases fail).

- [ ] **Step 3: Extend the Node contract**

In `src/types/agents/discovery.ts`, add the signal schema just above `DeepAnalysisSchema`:

```ts
export const SIGNAL_CONFIDENCES = ['high', 'medium', 'low', 'unknown'] as const

// A buyer-grade enrichment signal: a short value, how confident we are, and the
// evidence/source behind it.
export const SignalSchema = z.object({
  value: z.string(),
  confidence: z.enum(SIGNAL_CONFIDENCES),
  evidence: z.string(),
})
```

Then add `signals` as the last property inside the `DeepAnalysisSchema` object (after `hard_filters`):

```ts
  signals: z.object({
    demand_trend: SignalSchema,
    scale_proxy: SignalSchema,
    momentum: SignalSchema,
    best_payout_route: SignalSchema,
  }),
```

And export the type after `DeepAnalysis`:

```ts
export type Signal = z.infer<typeof SignalSchema>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/types/agents/discovery.test.ts`
Expected: PASS.

- [ ] **Step 5: Mirror in the Deno twin**

In `supabase/functions/_shared/types/discovery.ts`, make the identical changes: add `SIGNAL_CONFIDENCES` + `SignalSchema` above `DeepAnalysisSchema`, add the `signals` object as the last property of `DeepAnalysisSchema`, and add `export type Signal = z.infer<typeof SignalSchema>`.

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm typecheck`

```bash
git add src/types/agents/discovery.ts src/types/agents/discovery.test.ts supabase/functions/_shared/types/discovery.ts
git commit -m "feat(discovery): add enrichment signals to the DeepAnalysis contract"
```

---

## Task 2: Mock returns signals

**Files:**
- Modify: `supabase/functions/_shared/mockAi.ts`

- [ ] **Step 1: Add `signals` to `mockDiscoveryDeep`**

In `supabase/functions/_shared/mockAi.ts`, inside the object returned by `mockDiscoveryDeep`, add a `signals` property (after the `hard_filters` block, before the closing brace):

```ts
    signals: {
      demand_trend: {
        value: 'rising (scaling stage)',
        confidence: 'medium',
        evidence: 'Mock: search interest trending up over 12 months',
      },
      scale_proxy: {
        value: 'widely promoted by affiliates',
        confidence: 'low',
        evidence: 'Mock: appears across multiple affiliate roundups',
      },
      momentum: {
        value: 'Series B raised 2026',
        confidence: 'medium',
        evidence: 'Mock: funding news',
      },
      best_payout_route: {
        value: 'in-house — 20% lifetime recurring',
        confidence: 'medium',
        evidence: 'Mock: own affiliate page',
      },
    },
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/mockAi.ts
git commit -m "feat(discovery): mock deep analysis returns enrichment signals"
```

---

## Task 3: Add momentum + best-payout research queries

**Why:** The deep stage can only assess momentum (#6) and best-payout (#2) if it searches for them. Add two gap-fill queries to the existing three.

**Files:**
- Modify: `supabase/functions/_shared/orchestrators/discoveryDeep.ts:30-36`

- [ ] **Step 1: Extend `researchQueries`**

Replace the `researchQueries` function with:

```ts
// Fixed gap-filling queries. The first three target the hard filters a landing
// page can't confirm alone (terms/commission, payment reputation, paid-traffic
// policy); the last two feed the enrichment signals (funding momentum, and
// which network pays the most for this product).
function researchQueries(name: string): string[] {
  return [
    `${name} affiliate program commission payout terms`,
    `${name} affiliate program review does it pay shaving`,
    `${name} affiliate paid traffic brand bidding policy`,
    `${name} funding round raised acquisition news`,
    `${name} affiliate program highest commission which network`,
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/orchestrators/discoveryDeep.ts
git commit -m "feat(discovery): research queries for momentum + best-payout signals"
```

---

## Task 4: Rewrite the deep prompt to emit signals + weigh v2 factors

**Why:** The Sonnet call must now also produce the four signals from the research, and let the v2 factors (lifecycle timing, funnel quality, churn, geo/seasonality) move the score.

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
payouts, EPC, caps, terms, funding, or trends from outside knowledge.

# Gate 0 — legitimacy
This must be a SINGLE company's own affiliate/partner program (in-house or via a
named network: Impact, PartnerStack, CJ, ShareASale, Awin, Rakuten, ClickBank,
Tune…). If it is a directory, listicle, review/comparison site, blog, forum, or
news page, set overall_score ≤ 20, recommended=false, and say so in summary.

# The 4 hard filters — for EACH set status + evidence + source_url
Resolution rule: if the evidence CONFIRMS the filter is bad → "fail". If page +
research CONFIRM it is good → "pass". If still unknown after using the research →
"unknown_verify" and add a line to must_verify_before_budget. Put the exact
quote/finding in `evidence` and the URL it came from in `source_url` (null if
from the candidate's own page).

1. economics — payout × realistic conversion × AOV → competitive EPC. Recurring/
   lifetime rev-share is a strong positive. Trivial payout on a cheap product → fail.
2. paid_traffic — permits the paid channels a media buyer uses (paid social,
   search, native)? All-paid-forbidden → fail; note brand-bidding / direct-link.
3. monetization_integrity — sane net terms, reasonable minimum payout, real
   payout methods, NO reputation for shaving/scrubbing or late payment.
4. scale_ceiling — no punitive cap; advertiser can absorb real volume; category
   demand supports $10K+/mo for a top operator.

# Scoring factors (move overall_score; not deal-breakers)
Cookie window/attribution; **lifecycle timing** (a proven-but-not-yet-saturated
offer beats a burned, over-promoted one); the advertiser's own **funnel /
conversion quality** (trial vs paid, friction); **recurring durability** (for
SaaS, high churn erodes a "lifetime" commission); **geo/language fit + payout
currency + seasonality**; competition/saturation; creative/angle differentiation;
compliance/platform risk; advertiser trust/longevity.

# Enrichment signals — set `signals` with value + confidence + evidence each
- demand_trend — is search/market interest rising, flat, or declining, and the
  lifecycle stage (emerging / scaling / saturated / declining). Use the
  research; value e.g. "rising (scaling stage)".
- scale_proxy — is it being promoted at scale by affiliates (proxy: appears
  across many affiliate roundups/reviews, active recruiting, marketplace
  popularity). value e.g. "widely promoted" / "limited evidence".
- momentum — any recent funding round, acquisition, or notable launch that could
  blow the product up. value e.g. "Series B raised 2026" / "none found".
- best_payout_route — of the ways to promote THIS product (in-house vs networks
  found in research), which pays the most and the stated commission. value e.g.
  "Impact — $200/sale (highest found)". If you can't tell, value "unknown" and
  confidence "unknown".
Set confidence high/medium/low by how directly the page/research supports it;
use "unknown" when there's no evidence — never guess.

# Output (submit_deep_analysis tool, exactly once)
overall_score 0-100; summary; key_strengths; key_risks; estimated_commission
(as stated else null); estimated_epc_band (a range only if derivable else null);
network (else null); hard_filters (the 4 above); signals (the 4 above);
must_verify_before_budget; recommended (true ONLY if all four hard_filters are
"pass" AND overall_score ≥ 55).

For health / mental_wellness verticals, weight compliance risk heavily and be
conservative with recommended.
```

- [ ] **Step 2: Commit**

```bash
git add prompts/discovery_deep/v1.md
git commit -m "feat(discovery): deep prompt emits enrichment signals + weighs v2 factors"
```

---

## Task 5: Render the signals in the UI

**Why:** The admin should see the four signals under each deep-analyzed candidate, alongside the hard-filter verdicts.

**Files:**
- Modify: `src/components/discovery/CandidateRow.tsx`

- [ ] **Step 1: Widen the deep view type**

In `src/components/discovery/CandidateRow.tsx`, add a `Signal` shape and a `signals` field to the `DeepView` type (after the `hard_filters` field):

```ts
type SignalView = { value?: string; confidence?: string; evidence?: string }
```

and inside `DeepView`, after `hard_filters?: {...}`:

```ts
  signals?: {
    demand_trend?: SignalView
    scale_proxy?: SignalView
    momentum?: SignalView
    best_payout_route?: SignalView
  }
```

- [ ] **Step 2: Add the signal label map (module scope)**

Below the existing `FILTER_STATUS_CLASS` constant, add:

```ts
const SIGNAL_LABELS: Array<[keyof NonNullable<DeepView['signals']>, string]> = [
  ['best_payout_route', 'Best payout'],
  ['demand_trend', 'Demand'],
  ['scale_proxy', 'At scale'],
  ['momentum', 'Momentum'],
]

const SIGNAL_CONFIDENCE_CLASS: Record<string, string> = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-blue-100 text-blue-800',
  low: 'bg-zinc-100 text-zinc-600',
  unknown: 'bg-amber-100 text-amber-800',
}
```

- [ ] **Step 3: Render the signals block**

In the JSX, immediately AFTER the `must_verify_before_budget` block and BEFORE the `{candidate.rejection_reason && (` block, insert:

```tsx
      {deep?.signals && (
        <div className="mt-1 flex flex-col gap-1">
          {SIGNAL_LABELS.map(([key, label]) => {
            const sig = deep.signals?.[key]
            if (!sig?.value) return null
            return (
              <div key={key} className="flex items-baseline gap-2 text-xs">
                <span className="w-24 shrink-0 font-medium">{label}</span>
                <span>{sig.value}</span>
                {sig.confidence && (
                  <span
                    className={`rounded px-1 py-0.5 ${SIGNAL_CONFIDENCE_CLASS[sig.confidence] ?? ''}`}
                  >
                    {sig.confidence}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
```

- [ ] **Step 4: Typecheck + lint + full tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/components/discovery/CandidateRow.tsx
git commit -m "feat(discovery): show enrichment signals on each candidate"
```

---

## Task 6: Verify + deploy

- [ ] **Step 1: Full suite + build**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Then: `rm -rf .next && pnpm build`
Expected: all green; `/admin/discovery/[runId]` compiles.

- [ ] **Step 2: Merge to main + deploy via CI**

```bash
git checkout main && git merge --ff-only <feature-branch> && git push origin main
```
Then trigger (agent via GitHub MCP, or owner from the Actions tab):
- **Deploy Edge Functions** with `function = discover-offers` (bundles the new research queries)
- **Sync Prompts** (updates `discovery_deep`)

No migration. No new secrets.

- [ ] **Step 3: Update CLAUDE.md**

Add to the Discovery note: deep analysis now emits four enrichment signals (demand_trend + lifecycle, scale_proxy #4 proxy, momentum #6, best_payout_route #2) from two added gap-fill research queries, folded into `deep_analysis` jsonb; deep prompt also weighs v2 factors (lifecycle timing, funnel quality, churn, geo/seasonality); run page shows the signals. No DB change. Commit + push.

- [ ] **Step 4: Smoke test (after deploy + sync)**

Run a scan in `/admin/discovery`. A deep-analyzed candidate should now show, under its hard filters: Best payout, Demand, At scale, Momentum — each with a confidence chip. Strong known offers (e.g. Semrush) should show real values; obscure ones show "unknown".

---

## Final Verification
- [ ] `pnpm test` green (new `signals` contract tests).
- [ ] `pnpm typecheck && pnpm lint` clean.
- [ ] `rm -rf .next && pnpm build` builds.
- [ ] Node + Deno `DeepAnalysisSchema` (incl. `signals`) identical.
- [ ] Owner/CI: deploy `discover-offers` + Sync Prompts (no migration, no secrets).

## Out of scope (later phases)
Real ad-intel for #4 (Meta Ad Library / paid spy tools), affiliate-network API
adapters (CJ/Impact inside) for authoritative best-payout, a dedicated
ClickBank/Digistore marketplace adapter, scheduled auto-scans.
