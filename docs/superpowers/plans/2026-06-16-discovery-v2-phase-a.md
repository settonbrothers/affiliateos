# Discovery v2 Phase A — Concrete-Offer Unit + Container Mining

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make discovery surface only concrete individual offers — never networks/directories/listicles — and get volume by *mining* those container pages for the individual offers listed inside them.

**Architecture:** Triage gains a 3-way classification (`offer` / `container` / `reject`). Concrete offers proceed to deep analysis as today. Containers are fed to a new cheap `DiscoveryMineOrchestrator` (Haiku) that extracts the individual offers listed on the page; those mined offers are inserted as new candidates and triaged a second pass, then join the survivors. Web-search query templates are expanded for more raw material. No DB migration — mined offers are ordinary `discovery_candidates` rows (provenance noted in `raw_snippet`).

**Tech Stack:** Deno edge orchestrators (`supabase/functions/_shared`), dual Zod contracts (Node `src/types/agents` + Deno `_shared/types`, KEEP IN SYNC), pure helpers unit-tested in Node (vitest), prompts synced via CI.

**Phase boundary:** Enrichment signals (#2 best-payout, #4 scale-proxy, #5 trend, #6 momentum) + the v2 rubric factors are **Phase B** — a separate plan. This plan only fixes the unit + delivers volume.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/types/agents/discovery.ts` | Node Zod: triage `classification`; new `MineResponse` | Modify |
| `supabase/functions/_shared/types/discovery.ts` | Deno twin (KEEP IN SYNC) | Modify |
| `src/types/agents/discovery.test.ts` | Tests for the new triage + mine contracts | Modify |
| `supabase/functions/_shared/mockAi.ts` | `mockDiscoveryTriage` returns `classification`; new `mockDiscoveryMine` | Modify |
| `prompts/discovery_triage/v1.md` | Classify offer/container/reject (Gate 0) | Modify |
| `prompts/discovery_mine/v1.md` | Extract individual offers from a container page | Create |
| `supabase/functions/_shared/orchestrators/discoveryMine.ts` | Mining orchestrator (Haiku, real-or-mock) | Create |
| `src/lib/discovery/queries.ts` | Pure `expandQueries` (more search templates) | Create |
| `src/lib/discovery/queries.test.ts` | Unit tests | Create |
| `supabase/functions/discover-offers/index.ts` | Classification handling + mining loop + expanded queries + counts | Modify |

**Commands:** test = `pnpm test`; single = `pnpm exec vitest run <path>`; `pnpm typecheck`; `pnpm lint`. Deno files verified at deploy.

---

## Task 1: Triage `classification` + `MineResponse` contracts (TDD)

**Why:** Triage must distinguish a concrete offer from a container to mine. And mining needs an output contract (a list of `{name,url}`).

**Files:**
- Modify: `src/types/agents/discovery.ts`
- Modify: `supabase/functions/_shared/types/discovery.ts`
- Modify: `src/types/agents/discovery.test.ts`

- [ ] **Step 1: Add failing tests**

In `src/types/agents/discovery.test.ts`, add at the end:

```ts
import { TriageResponseSchema, MineResponseSchema } from './discovery'

describe('TriageResponseSchema (classification)', () => {
  it('accepts the three classifications', () => {
    for (const classification of ['offer', 'container', 'reject'] as const) {
      const r = TriageResponseSchema.safeParse({
        results: [{ index: 0, classification, score: 60, reason: 'x' }],
      })
      expect(r.success).toBe(true)
    }
  })

  it('rejects an unknown classification', () => {
    const r = TriageResponseSchema.safeParse({
      results: [{ index: 0, classification: 'maybe', score: 60, reason: 'x' }],
    })
    expect(r.success).toBe(false)
  })
})

describe('MineResponseSchema', () => {
  it('accepts a list of offers with name + nullable url', () => {
    const r = MineResponseSchema.safeParse({
      offers: [
        { name: 'Acme', url: 'https://acme.com/affiliates' },
        { name: 'NoUrl', url: null },
      ],
    })
    expect(r.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run src/types/agents/discovery.test.ts`
Expected: FAIL — `classification` not in schema; `MineResponseSchema` not exported.

- [ ] **Step 3: Update the Node contract**

In `src/types/agents/discovery.ts`, replace the `TriageItemSchema` block with:

```ts
export const TRIAGE_CLASSIFICATIONS = ['offer', 'container', 'reject'] as const

// Triage classifies each candidate: 'offer' = a single concrete offer to deep-
// analyze; 'container' = a network/directory/listicle to MINE for the offers
// inside it; 'reject' = neither (blog, forum, junk).
export const TriageItemSchema = z.object({
  index: z.number().int().min(0),
  classification: z.enum(TRIAGE_CLASSIFICATIONS),
  score: z.number().int().min(0).max(100),
  reason: z.string().min(1),
})
export const TriageResponseSchema = z.object({
  results: z.array(TriageItemSchema),
})
export type TriageResponse = z.infer<typeof TriageResponseSchema>
```

And append (after the existing exports):

```ts
// Mining extracts the individual offers listed on a container page.
export const MinedOfferSchema = z.object({
  name: z.string().min(1),
  url: z.string().nullable(),
})
export const MineResponseSchema = z.object({
  offers: z.array(MinedOfferSchema),
})
export type MineResponse = z.infer<typeof MineResponseSchema>
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm exec vitest run src/types/agents/discovery.test.ts`
Expected: PASS.

- [ ] **Step 5: Mirror in the Deno twin**

In `supabase/functions/_shared/types/discovery.ts`, make the identical changes: replace the `TriageItemSchema` block with the `TRIAGE_CLASSIFICATIONS` + `TriageItemSchema` + `TriageResponseSchema` above, and append the `MinedOfferSchema` + `MineResponseSchema` block. (Keep the `npm:zod@^3.24.0` import.)

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm typecheck`

```bash
git add src/types/agents/discovery.ts src/types/agents/discovery.test.ts supabase/functions/_shared/types/discovery.ts
git commit -m "feat(discovery): triage classification (offer/container/reject) + mine contract"
```

---

## Task 2: Triage mock + prompt (classify, Gate 0)

**Files:**
- Modify: `supabase/functions/_shared/mockAi.ts`
- Modify: `prompts/discovery_triage/v1.md`

- [ ] **Step 1: Update the triage mock**

In `supabase/functions/_shared/mockAi.ts`, replace `mockDiscoveryTriage` with:

```ts
// Deterministic spread: most are offers, every 3rd a reject, every 5th a
// container — so the funnel + mining are both exercised in mock mode.
export function mockDiscoveryTriage(count: number): Record<string, unknown> {
  return {
    results: Array.from({ length: count }, (_, i) => {
      const classification =
        i % 5 === 4 ? 'container' : i % 3 === 2 ? 'reject' : 'offer'
      return {
        index: i,
        classification,
        score: classification === 'offer' ? 70 + ((i * 7) % 25) : 30,
        reason:
          classification === 'container'
            ? 'Lists multiple programs — mine for the offers inside.'
            : classification === 'reject'
              ? 'Not a concrete affiliate offer.'
              : 'Plausible single affiliate program.',
      }
    }),
  }
}
```

- [ ] **Step 2: Rewrite the triage prompt**

Replace the contents of `prompts/discovery_triage/v1.md` with:

```md
You triage candidate pages found by a web search. For EACH candidate (matched by
its `index`) return a `classification`, a `score` (0-100), and a one-sentence
`reason`.

classification:
- "offer" — the page is a SINGLE company's own affiliate/partner program (one
  advertiser + one product you can sign up to promote). This is what we want.
- "container" — the page LISTS or aggregates many programs: an affiliate
  network or marketplace (ClickBank, Impact, PartnerStack, ShareASale…), a
  directory/review/comparison site (affiliate.watch, G2…), or a listicle /
  roundup ("best/top N … programs"). We will MINE these for the offers inside —
  so classify them "container", do NOT reject them.
- "reject" — neither: a blog post/guide, "what is an affiliate program"
  educational page, forum/Quora thread, or news article with no concrete
  program to extract.

score: for an "offer", how promising to test now (commission clarity, category
momentum, credibility). For "container"/"reject", score the underlying promise
loosely (it isn't used to gate them). When unsure between offer and container,
choose "container" (we'd rather mine it than surface an aggregator as an offer).

Return exactly one result per input candidate. Do not invent candidates. Call
the tool exactly once.
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/mockAi.ts prompts/discovery_triage/v1.md
git commit -m "feat(discovery): triage classifies offer/container/reject"
```

---

## Task 3: Mining orchestrator + prompt + mock

**Why:** Given a container page's text, extract the individual offers (name + best URL) listed on it.

**Files:**
- Create: `prompts/discovery_mine/v1.md`
- Modify: `supabase/functions/_shared/mockAi.ts`
- Create: `supabase/functions/_shared/orchestrators/discoveryMine.ts`

- [ ] **Step 1: Write the mining prompt**

Create `prompts/discovery_mine/v1.md`:

```md
You are given the text of a page that LISTS multiple affiliate programs/offers
(a network, marketplace, directory, or "best N" listicle). Extract the
individual offers it lists.

For each distinct offer return:
- name: the product/company being promoted (not the directory's own name).
- url: the best link to that offer's own site or program page if present in the
  text, else null.

Rules:
- One entry per distinct product. Do NOT include the directory/network/site
  itself, navigation, ads, or unrelated links.
- Do not invent offers that aren't on the page. If the page lists none, return
  an empty array.
- Call the tool exactly once with all offers.
```

- [ ] **Step 2: Add the mining mock**

In `supabase/functions/_shared/mockAi.ts`, append:

```ts
// Mining mock: a couple of concrete offers "extracted" from a container page.
export function mockDiscoveryMine(): Record<string, unknown> {
  return {
    offers: [
      { name: 'Mined Offer One', url: 'https://mined-one.com/affiliates' },
      { name: 'Mined Offer Two', url: 'https://mined-two.com/partners' },
    ],
  }
}
```

- [ ] **Step 3: Write the orchestrator**

Create `supabase/functions/_shared/orchestrators/discoveryMine.ts`:

```ts
import { callAnthropicWithTool } from '../anthropicJson.ts'
import { assertNotPaused } from '../killSwitch.ts'
import { loadActivePrompt } from '../loadActivePrompt.ts'
import { mockDiscoveryMine } from '../mockAi.ts'
import { MineResponseSchema } from '../types/discovery.ts'

const MODEL = 'claude-haiku-4-5-20251001'
const TOOL_NAME = 'submit_mined_offers'
const TOOL_DESCRIPTION =
  'Submit the individual offers extracted from the container page. Call exactly once.'
const MAX_TEXT_FOR_LLM = 80_000

export type MineInput = { url: string | null; pageText: string }

export type OrchestratorResult = {
  output: Record<string, unknown>
  usage?: { input_tokens: number; output_tokens: number; cost_usd: number }
  mode: 'real' | 'mock'
}

export async function runDiscoveryMine(
  input: MineInput,
  verticalSlug?: string
): Promise<OrchestratorResult> {
  await assertNotPaused('DiscoveryMineOrchestrator')

  if (!Deno.env.get('ANTHROPIC_API_KEY')) {
    return { output: mockDiscoveryMine(), mode: 'mock' }
  }

  const systemPrompt = await loadActivePrompt(
    'DiscoveryMineOrchestrator',
    verticalSlug
  )
  const userMessage = JSON.stringify(
    { url: input.url, page_text: input.pageText.slice(0, MAX_TEXT_FOR_LLM) },
    null,
    2
  )

  const result = await callAnthropicWithTool({
    model: MODEL,
    systemPrompt,
    userMessage,
    toolName: TOOL_NAME,
    toolDescription: TOOL_DESCRIPTION,
    responseSchema: MineResponseSchema,
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

- [ ] **Step 4: Commit**

```bash
git add prompts/discovery_mine supabase/functions/_shared/mockAi.ts supabase/functions/_shared/orchestrators/discoveryMine.ts
git commit -m "feat(discovery): mining orchestrator extracts offers from container pages"
```

---

## Task 4: `expandQueries` pure helper (TDD)

**Why:** More, more-varied search queries surface more container pages to mine (and more program pages) — the lever for volume.

**Files:**
- Create: `src/lib/discovery/queries.ts`
- Test: `src/lib/discovery/queries.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/discovery/queries.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { expandQueries } from './queries'

describe('expandQueries', () => {
  it('keeps the base templates', () => {
    const out = expandQueries(['custom base query'], 'AI/SaaS')
    expect(out).toContain('custom base query')
  })

  it('adds vertical-modifier variants', () => {
    const out = expandQueries([], 'AI/SaaS')
    expect(out).toContain('best AI/SaaS affiliate programs')
    expect(out).toContain('AI/SaaS affiliate program high commission')
    expect(out.length).toBeGreaterThan(3)
  })

  it('dedupes and is deterministic', () => {
    const out = expandQueries(['best AI/SaaS affiliate programs'], 'AI/SaaS')
    const seen = new Set(out)
    expect(seen.size).toBe(out.length)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run src/lib/discovery/queries.test.ts`
Expected: FAIL — `Failed to resolve import "./queries"`.

- [ ] **Step 3: Write the helper**

Create `src/lib/discovery/queries.ts`:

```ts
// Expand a source's base query templates into a wider, deduped set so the scan
// surfaces more container pages (to mine) and more program pages. Deterministic.
const MODIFIERS = [
  'high commission',
  'recurring commission',
  'affiliate program review',
  'partner program payout',
]

export function expandQueries(base: string[], vertical: string): string[] {
  const v = vertical.trim()
  const generated = [
    `best ${v} affiliate programs`,
    `top ${v} affiliate programs`,
    ...MODIFIERS.map((m) => `${v} ${m}`),
  ]
  const out: string[] = []
  const seen = new Set<string>()
  for (const q of [...base, ...generated]) {
    const key = q.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(q)
  }
  return out
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm exec vitest run src/lib/discovery/queries.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/discovery/queries.ts src/lib/discovery/queries.test.ts
git commit -m "feat(discovery): expandQueries — wider deduped query set for volume"
```

---

## Task 5: Edge fn — classification handling, mining loop, expanded queries

**Why:** Wire it all into the funnel: expand queries, classify, mine containers into new candidates, triage them, and feed concrete offers to the (unchanged) deep loop.

**Files:**
- Modify: `supabase/functions/discover-offers/index.ts`

- [ ] **Step 1: Add the import + constants + a Deno mirror of expandQueries**

In `supabase/functions/discover-offers/index.ts`, add to the imports (after the `runDiscoveryTriage` import):

```ts
import { runDiscoveryMine } from '../_shared/orchestrators/discoveryMine.ts'
```

Add near the other constants (after `DEEP_ANALYSIS_CAP`):

```ts
const CONTAINER_MINE_CAP = 10 // max container pages to mine per run
const MINED_OFFERS_CAP = 30 // max offers to take from one container

// Deno mirror of src/lib/discovery/queries.ts expandQueries (unit-tested there).
const QUERY_MODIFIERS = [
  'high commission',
  'recurring commission',
  'affiliate program review',
  'partner program payout',
]
function expandQueries(base: string[], vertical: string): string[] {
  const v = vertical.trim()
  const generated = [
    `best ${v} affiliate programs`,
    `top ${v} affiliate programs`,
    ...QUERY_MODIFIERS.map((m) => `${v} ${m}`),
  ]
  const out: string[] = []
  const seen = new Set<string>()
  for (const q of [...base, ...generated]) {
    const key = q.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(q)
  }
  return out
}
```

- [ ] **Step 2: Use expanded queries in the discover loop**

In the discover loop, replace the template line:

```ts
      const templates =
        ((s.config as { query_templates?: string[] }).query_templates ?? []).slice(
          0,
          params.queries
        )
```

with (expand first, then take `params.queries` of the wider set):

```ts
      const baseTemplates =
        (s.config as { query_templates?: string[] }).query_templates ?? []
      const templates = expandQueries(
        baseTemplates,
        verticalSlug ?? args.verticalId
      ).slice(0, params.queries)
```

- [ ] **Step 3: Replace the triage-handling block with classification + mining**

Replace the block from `const results = (triage.output as {` through the end of the survivor `for` loop (the current lines that build `survivors`) with:

```ts
    type TriageResult = {
      index: number
      classification: 'offer' | 'container' | 'reject'
      score: number
      reason: string
    }
    const results = (triage.output as { results: TriageResult[] }).results
    const byIndex = new Map(results.map((r) => [r.index, r]))

    const survivors: Array<{ id: string; name: string; url: string | null; score: number }> = []
    const containers: Array<{ url: string }> = []

    const applyTriage = async (
      cand: { id: string; name: string; url: string | null },
      r: TriageResult | undefined,
      allowContainer: boolean
    ): Promise<void> => {
      const score = r?.score ?? 0
      const cls = r?.classification ?? 'reject'
      if (cls === 'offer' && score >= TRIAGE_KEEP_MIN_SCORE) {
        await admin
          .from('discovery_candidates')
          .update({ stage: 'triaged', triage_score: score, triage_reason: r?.reason ?? null })
          .eq('id', cand.id)
        survivors.push({ id: cand.id, name: cand.name, url: cand.url, score })
      } else if (cls === 'container' && allowContainer && cand.url) {
        await admin
          .from('discovery_candidates')
          .update({
            stage: 'rejected',
            triage_score: score,
            triage_reason: r?.reason ?? 'Container — mined for offers.',
            rejection_stage: 'triaged',
            rejection_reason: 'Container (network/directory/listicle) — mined for the offers inside it.',
          })
          .eq('id', cand.id)
        containers.push({ url: cand.url })
      } else {
        await admin
          .from('discovery_candidates')
          .update({
            stage: 'rejected',
            triage_score: score,
            triage_reason: r?.reason ?? 'Below triage threshold.',
            rejection_stage: 'triaged',
            rejection_reason: r?.reason ?? 'Not a concrete offer.',
          })
          .eq('id', cand.id)
      }
    }

    for (let i = 0; i < candidates.length; i++) {
      await applyTriage(candidates[i], byIndex.get(i), true)
    }

    // MINE containers → extract the individual offers inside them, insert as new
    // candidates, and triage those (one pass; mined containers are not mined
    // again — bounded). dedup reuses the `known` domain set from discovery.
    let minedTotal = 0
    type MinedRaw = { name: string; url: string; domain: string; parent: string }
    const minedRaw: MinedRaw[] = []
    for (const ct of containers.slice(0, CONTAINER_MINE_CAP)) {
      let pageText = ''
      try {
        const html = await fetchWithTimeout(ct.url, FETCH_TIMEOUT_MS)
        pageText = truncate(stripHtml(html.slice(0, MAX_HTML_BYTES)), MAX_RAW_TEXT_LEN)
      } catch {
        continue
      }
      const mineRunId = await recordRunStart({
        orchestratorName: 'DiscoveryMineOrchestrator',
        agentVersion: Deno.env.get('ANTHROPIC_API_KEY') ? 'real-v1' : 'mock-v1',
        model: Deno.env.get('ANTHROPIC_API_KEY') ? 'claude-haiku-4-5-20251001' : 'mock',
        inputPayload: { container_url: ct.url },
        userId: args.userId,
      })
      try {
        const mined = await runDiscoveryMine({ url: ct.url, pageText }, verticalSlug)
        totalCost += mined.usage?.cost_usd ?? 0
        await recordRunSuccess(mineRunId, {
          outputPayload: mined.output,
          estimatedCost: mined.usage?.cost_usd ?? 0,
          tokensInput: mined.usage?.input_tokens,
          tokensOutput: mined.usage?.output_tokens,
        })
        const offers = (mined.output as { offers: Array<{ name: string; url: string | null }> }).offers
        for (const o of offers.slice(0, MINED_OFFERS_CAP)) {
          const domain = domainOf(o.url)
          if (!domain || known.has(domain)) continue
          known.add(domain)
          minedRaw.push({ name: o.name, url: o.url as string, domain, parent: ct.url })
        }
      } catch (err) {
        await recordRunError(mineRunId, err instanceof Error ? err.message : String(err))
      }
    }

    if (minedRaw.length > 0) {
      const { data: minedRows } = await admin
        .from('discovery_candidates')
        .insert(
          minedRaw.map((m) => ({
            run_id: args.runId,
            vertical_id: args.verticalId,
            name: m.name,
            url: m.url,
            domain: m.domain,
            raw_snippet: `[mined from ${m.parent}]`,
            stage: 'discovered',
          }))
        )
        .select('id, name, url, raw_snippet')
      const minedCandidates = (minedRows ?? []) as Array<{
        id: string
        name: string
        url: string | null
        raw_snippet: string | null
      }>
      minedTotal = minedCandidates.length

      if (minedCandidates.length > 0) {
        const t2RunId = await recordRunStart({
          orchestratorName: 'DiscoveryTriageOrchestrator',
          agentVersion: Deno.env.get('ANTHROPIC_API_KEY') ? 'real-v1' : 'mock-v1',
          model: Deno.env.get('ANTHROPIC_API_KEY') ? 'claude-haiku-4-5-20251001' : 'mock',
          inputPayload: { run_id: args.runId, mined_count: minedCandidates.length },
          userId: args.userId,
        })
        try {
          const t2 = await runDiscoveryTriage(
            minedCandidates.map((c) => ({ name: c.name, url: c.url, snippet: c.raw_snippet ?? '' })),
            verticalSlug
          )
          totalCost += t2.usage?.cost_usd ?? 0
          await recordRunSuccess(t2RunId, {
            outputPayload: t2.output,
            estimatedCost: t2.usage?.cost_usd ?? 0,
            tokensInput: t2.usage?.input_tokens,
            tokensOutput: t2.usage?.output_tokens,
          })
          const r2 = (t2.output as { results: TriageResult[] }).results
          const r2byIndex = new Map(r2.map((r) => [r.index, r]))
          for (let i = 0; i < minedCandidates.length; i++) {
            // allowContainer=false: a mined item that's itself a container is
            // just rejected (no recursive mining in Phase A).
            await applyTriage(minedCandidates[i], r2byIndex.get(i), false)
          }
        } catch (err) {
          await recordRunError(t2RunId, err instanceof Error ? err.message : String(err))
        }
      }
    }

    // Best triage scores first, so the deep cap takes the strongest survivors.
    survivors.sort((a, b) => b.score - a.score)
```

- [ ] **Step 4: Update the discovered count**

In the final `completed` status update, change:

```ts
        counts: {
          discovered: candidates.length,
          triaged: survivors.length,
          analyzed: analyzedCount,
          approved: 0,
        },
```

to:

```ts
        counts: {
          discovered: candidates.length + minedTotal,
          triaged: survivors.length,
          analyzed: analyzedCount,
          approved: 0,
        },
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/discover-offers/index.ts
git commit -m "feat(discovery): classify + mine containers into concrete offers; expand queries"
```

---

## Task 6: Verification + deploy + docs

- [ ] **Step 1: Full suite + build**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Then: `rm -rf .next && pnpm build`
Expected: all green (new tests for triage classification, mine contract, expandQueries).

- [ ] **Step 2: Merge to main + deploy via CI**

```bash
git checkout main && git merge --ff-only <feature-branch> && git push origin main
```
Then trigger the two workflows (the agent does this via GitHub MCP, or owner from the Actions tab):
- **Deploy Edge Functions** with `function = discover-offers` (bundles the new mining orchestrator)
- **Sync Prompts** (registers `discovery_mine` + updates `discovery_triage`)

No migration. No new secrets.

- [ ] **Step 3: Update CLAUDE.md**

Add to the Discovery note: triage now classifies offer/container/reject; container pages (networks/directories/listicles) are mined by `DiscoveryMineOrchestrator` (Haiku) into individual concrete-offer candidates that are triaged a second pass; `expandQueries` widens the search set; `prompts/discovery_mine/v1.md` added. No DB change. Commit + push.

- [ ] **Step 4: Smoke test (after deploy + sync)**

Run a fresh scan in `/admin/discovery`. Expect: discovered count much higher than before (mined offers added); containers (affiliate.watch, "best N" listicles) appear in "Dropped earlier" with reason "Container — mined…"; and individual mined offers appear as concrete candidates, the strong ones reaching deep analysis. No network/listicle is ever a top candidate.

---

## Final Verification
- [ ] `pnpm test` green (triage classification, mine contract, expandQueries tests).
- [ ] `pnpm typecheck && pnpm lint` clean.
- [ ] `rm -rf .next && pnpm build` builds.
- [ ] Node + Deno discovery contracts identical (Task 1).
- [ ] Owner/CI steps: deploy `discover-offers` + Sync Prompts (no migration, no secrets).

## Out of scope (Phase B / later)
Enrichment signals (best-payout, scale-proxy, demand-trend, momentum) + v2 rubric
factors; public-marketplace adapter (ClickBank/Digistore) — needs a source-kind
convention + source-creation path; recursive mining; network APIs / spy tools /
Meta Ad Library.
