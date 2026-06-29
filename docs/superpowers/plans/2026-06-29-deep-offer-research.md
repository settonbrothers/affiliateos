# Deep Offer Research (#10) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Deep research" action on an offer that produces a research-augmented dossier (7 sections + real competitor ad creatives) and refreshes the verdict from the new evidence.

**Architecture:** A background edge function `research-offer` (same guardrails as `analyze-offer`) runs a pipeline: fetch page → Tavily research → spy-tool ad-intel adapter → Sonnet dossier synthesis → re-run underwriting with in-memory research facts. The dossier is stored in `ai_runs` (no migration), rendered in a new "Research" tab, and translated by the existing AI-output translation layer. The ad-intel adapter ships real-or-mock (real wiring deferred until the owner subscribes to a spy tool).

**Tech Stack:** Supabase Deno edge functions, Anthropic (Sonnet via `callAnthropicWithTool`), Zod (dual Node/Deno contracts), Next.js 15 App Router, Vitest.

---

## File Structure

- `src/types/agents/offerResearch.ts` (Node Zod contract) + `supabase/functions/_shared/types/offerResearch.ts` (Deno mirror) — dossier + ad-example schemas. KEEP IN SYNC.
- `src/lib/research/queries.ts` (+ `.test.ts`) — pure research-query builder, unit-tested; Deno-mirrored inline in the edge fn.
- `supabase/functions/_shared/adapters/adIntel.ts` — `runAdIntel(brand, max)` real-or-mock spy-tool adapter.
- `supabase/functions/_shared/orchestrators/offerResearch.ts` — `runOfferResearch(...)` Sonnet synthesis, real-or-mock.
- `prompts/offer_research/v1.md` — synthesis prompt.
- `supabase/functions/_shared/mockAi.ts` (modify) — add `mockOfferResearch()`.
- `supabase/functions/_shared/credits.ts` (modify) — add `'research-offer'` price.
- `supabase/functions/research-offer/index.ts` — the edge function (pipeline).
- `src/lib/actions/offers.ts` (modify) — add `startDeepResearch`.
- `src/components/offers/DeepResearchButton.tsx` — trigger button (mirrors `AnalyzeButton`).
- `src/components/offers/ResearchDossierView.tsx` — dossier + ad gallery renderer.
- `src/app/(app)/offers/[id]/page.tsx` (modify) — add "research" tab + wiring + `TranslationFiller`.
- `messages/en.json` + `messages/he.json` (modify) — new `offers` keys.
- `scripts/test-research-offer-e2e.mjs` — mock-mode manual e2e.

---

## Task 1: Dual Zod contract for the dossier

**Files:**
- Create: `src/types/agents/offerResearch.ts`
- Create: `supabase/functions/_shared/types/offerResearch.ts`
- Test: `src/types/agents/offerResearch.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/types/agents/offerResearch.test.ts
import { describe, expect, it } from 'vitest'

import {
  OfferResearchResponseSchema,
  RESEARCH_SECTION_KEYS,
} from './offerResearch'

const VALID = {
  payload: {
    economics: { summary: 'Recurring 30% commission.', findings: [] },
    competitive_landscape: { summary: 'Crowded.', findings: [] },
    demand_trend: { summary: 'Rising.', findings: [] },
    momentum: { summary: 'Series A raised.', findings: [] },
    reputation: { summary: 'Pays on time.', findings: [] },
    paid_traffic_policy: { summary: 'Brand bidding banned.', findings: [] },
    recommended_test_approach: { summary: 'Start $500 on native.', findings: [] },
    ad_examples: [
      {
        channel: 'facebook',
        headline: 'Build apps with AI',
        body: 'No code needed',
        creative_url: 'https://cdn.example.com/a.jpg',
        days_running: 42,
        source_url: 'https://facebook.com/ads/library/?id=1',
      },
    ],
  },
}

describe('OfferResearchResponseSchema', () => {
  it('parses a complete dossier', () => {
    expect(OfferResearchResponseSchema.parse(VALID)).toEqual(VALID)
  })

  it('accepts a finding with a null source_url', () => {
    const v = structuredClone(VALID)
    v.payload.economics.findings.push({
      claim: 'EPC ~ $1.20',
      evidence: 'Forum thread reports $1.10-$1.30 EPC.',
      source_url: null,
    })
    expect(() => OfferResearchResponseSchema.parse(v)).not.toThrow()
  })

  it('rejects a payload missing a required section', () => {
    const v = structuredClone(VALID) as Record<string, unknown>
    delete (v.payload as Record<string, unknown>).momentum
    expect(() => OfferResearchResponseSchema.parse(v)).toThrow()
  })

  it('exposes the 7 section keys', () => {
    expect(RESEARCH_SECTION_KEYS).toHaveLength(7)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/types/agents/offerResearch.test.ts`
Expected: FAIL — cannot find module `./offerResearch`.

- [ ] **Step 3: Write the Node contract**

```typescript
// src/types/agents/offerResearch.ts
// Node copy. KEEP IN SYNC with supabase/functions/_shared/types/offerResearch.ts.
import { z } from 'zod'

// One evidenced claim inside a dossier section.
export const ResearchFindingSchema = z.object({
  claim: z.string(),
  evidence: z.string(),
  source_url: z.string().nullable(),
})

// A dossier section: a short prose summary + the evidenced findings behind it.
export const ResearchSectionSchema = z.object({
  summary: z.string(),
  findings: z.array(ResearchFindingSchema),
})

// A real competitor ad surfaced by the ad-intel adapter.
export const AdExampleSchema = z.object({
  channel: z.string(),
  headline: z.string().nullable(),
  body: z.string().nullable(),
  creative_url: z.string().nullable(),
  days_running: z.number().nullable(),
  source_url: z.string().nullable(),
})

export const RESEARCH_SECTION_KEYS = [
  'economics',
  'competitive_landscape',
  'demand_trend',
  'momentum',
  'reputation',
  'paid_traffic_policy',
  'recommended_test_approach',
] as const

export const OfferResearchPayloadSchema = z.object({
  economics: ResearchSectionSchema,
  competitive_landscape: ResearchSectionSchema,
  demand_trend: ResearchSectionSchema,
  momentum: ResearchSectionSchema,
  reputation: ResearchSectionSchema,
  paid_traffic_policy: ResearchSectionSchema,
  recommended_test_approach: ResearchSectionSchema,
  ad_examples: z.array(AdExampleSchema),
})

export const OfferResearchResponseSchema = z.object({
  payload: OfferResearchPayloadSchema,
})

export type ResearchFinding = z.infer<typeof ResearchFindingSchema>
export type ResearchSection = z.infer<typeof ResearchSectionSchema>
export type AdExample = z.infer<typeof AdExampleSchema>
export type OfferResearchResponse = z.infer<typeof OfferResearchResponseSchema>
```

- [ ] **Step 4: Write the Deno mirror**

```typescript
// supabase/functions/_shared/types/offerResearch.ts
// Deno copy. KEEP IN SYNC with src/types/agents/offerResearch.ts.
import { z } from 'npm:zod@^3.24.0'

export const ResearchFindingSchema = z.object({
  claim: z.string(),
  evidence: z.string(),
  source_url: z.string().nullable(),
})

export const ResearchSectionSchema = z.object({
  summary: z.string(),
  findings: z.array(ResearchFindingSchema),
})

export const AdExampleSchema = z.object({
  channel: z.string(),
  headline: z.string().nullable(),
  body: z.string().nullable(),
  creative_url: z.string().nullable(),
  days_running: z.number().nullable(),
  source_url: z.string().nullable(),
})

export const OfferResearchPayloadSchema = z.object({
  economics: ResearchSectionSchema,
  competitive_landscape: ResearchSectionSchema,
  demand_trend: ResearchSectionSchema,
  momentum: ResearchSectionSchema,
  reputation: ResearchSectionSchema,
  paid_traffic_policy: ResearchSectionSchema,
  recommended_test_approach: ResearchSectionSchema,
  ad_examples: z.array(AdExampleSchema),
})

export const OfferResearchResponseSchema = z.object({
  payload: OfferResearchPayloadSchema,
})

export type OfferResearchResponse = z.infer<typeof OfferResearchResponseSchema>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/types/agents/offerResearch.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/types/agents/offerResearch.ts src/types/agents/offerResearch.test.ts supabase/functions/_shared/types/offerResearch.ts
git commit -m "feat(research): dual Zod contract for offer research dossier"
```

---

## Task 2: Research-query builder (pure, unit-tested)

**Files:**
- Create: `src/lib/research/queries.ts`
- Test: `src/lib/research/queries.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/research/queries.test.ts
import { describe, expect, it } from 'vitest'

import { researchQueries } from './queries'

describe('researchQueries', () => {
  it('produces one query per research angle, embedding the name', () => {
    const qs = researchQueries('Base44')
    expect(qs.length).toBeGreaterThanOrEqual(8)
    expect(qs.every((q) => q.includes('Base44'))).toBe(true)
  })

  it('covers economics, competitors, demand, momentum, reputation, paid policy', () => {
    const joined = researchQueries('Base44').join(' | ').toLowerCase()
    expect(joined).toContain('commission')
    expect(joined).toContain('competitor')
    expect(joined).toContain('trend')
    expect(joined).toContain('funding')
    expect(joined).toContain('review')
    expect(joined).toContain('brand bidding')
  })

  it('is deterministic and deduped', () => {
    const qs = researchQueries('Base44')
    expect(new Set(qs).size).toBe(qs.length)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/research/queries.test.ts`
Expected: FAIL — cannot find module `./queries`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/research/queries.ts
// Fixed gap-fill research queries for a deep offer dossier — one per research
// angle (economics/networks, competitors, demand, momentum, reputation, paid
// policy, ad angles). Deterministic. Deno-mirrored inline in research-offer.
export function researchQueries(name: string): string[] {
  const n = name.trim()
  const raw = [
    `${n} affiliate program commission payout terms`,
    `${n} affiliate program which network highest commission`,
    `${n} competitors alternatives comparison`,
    `${n} search trend growth popularity`,
    `${n} funding round raised acquisition news`,
    `${n} affiliate program review does it pay shaving`,
    `${n} affiliate paid traffic brand bidding policy`,
    `${n} ad copy angle landing page swipe`,
  ]
  const out: string[] = []
  const seen = new Set<string>()
  for (const q of raw) {
    const key = q.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(q)
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/research/queries.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/research/queries.ts src/lib/research/queries.test.ts
git commit -m "feat(research): deterministic research-query builder"
```

---

## Task 3: Ad-intel adapter (Deno, real-or-mock)

**Files:**
- Create: `supabase/functions/_shared/adapters/adIntel.ts`

- [ ] **Step 1: Write the adapter**

```typescript
// supabase/functions/_shared/adapters/adIntel.ts
// Ad-intelligence adapter. Real spy-tool call when AD_INTEL_API_KEY is set;
// otherwise a deterministic mock so the research pipeline is dev-runnable
// cost-free. The real branch targets a spy tool (AdSpy/BigSpy/Anstrex); each
// has a different API shape, so the concrete request/response mapping is wired
// when the owner subscribes + sets the key (mirrors the Tavily webSearch
// adapter). Returns real competitor ads: copy + creative URL + days running.

export type AdCreative = {
  channel: string
  headline: string | null
  body: string | null
  creative_url: string | null
  days_running: number | null
  source_url: string | null
}

const MOCK_CREATIVES: AdCreative[] = [
  {
    channel: 'facebook',
    headline: 'Build a SaaS app in a weekend',
    body: 'No code. AI does the heavy lifting. Try it free.',
    creative_url: 'https://example.com/mock-creative-1.jpg',
    days_running: 63,
    source_url: 'https://www.facebook.com/ads/library/?id=mock1',
  },
  {
    channel: 'native',
    headline: 'This AI tool is replacing dev teams',
    body: 'Founders are shipping faster than ever.',
    creative_url: 'https://example.com/mock-creative-2.jpg',
    days_running: 21,
    source_url: 'https://example.com/native/mock2',
  },
]

export async function runAdIntel(
  brand: string,
  maxResults: number
): Promise<AdCreative[]> {
  const apiKey = Deno.env.get('AD_INTEL_API_KEY')
  if (!apiKey) {
    return MOCK_CREATIVES.slice(0, maxResults)
  }

  // Real spy-tool call. Endpoint + auth + field mapping are provider-specific
  // and finalized when the owner picks a tool. We read the endpoint from
  // AD_INTEL_API_URL so the provider can change without a code edit; on any
  // failure we degrade open (the dossier just shows no creatives).
  const url = Deno.env.get('AD_INTEL_API_URL')
  if (!url) return []
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query: brand, limit: maxResults }),
    })
    if (!res.ok) return []
    const data = (await res.json()) as {
      ads?: Array<{
        channel?: string
        headline?: string
        body?: string
        creative_url?: string
        days_running?: number
        source_url?: string
      }>
    }
    return (data.ads ?? []).slice(0, maxResults).map((a) => ({
      channel: a.channel ?? 'unknown',
      headline: a.headline ?? null,
      body: a.body ?? null,
      creative_url: a.creative_url ?? null,
      days_running: typeof a.days_running === 'number' ? a.days_running : null,
      source_url: a.source_url ?? null,
    }))
  } catch {
    return []
  }
}
```

- [ ] **Step 2: Typecheck (Deno files are checked at deploy; sanity-check the Node build is unaffected)**

Run: `pnpm typecheck`
Expected: PASS (no Node imports touched).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/adapters/adIntel.ts
git commit -m "feat(research): ad-intel spy-tool adapter (real-or-mock)"
```

---

## Task 4: Mock fixture for the orchestrator

**Files:**
- Modify: `supabase/functions/_shared/mockAi.ts`

- [ ] **Step 1: Add the mock export**

Add this function to `supabase/functions/_shared/mockAi.ts` (next to the other `mock*` exports, e.g. after `mockTranslate`):

```typescript
export function mockOfferResearch(): Record<string, unknown> {
  const section = (summary: string) => ({
    summary,
    findings: [
      {
        claim: `${summary} (mock claim)`,
        evidence: 'Mock evidence sentence from a research snippet.',
        source_url: 'https://example.com/source',
      },
    ],
  })
  return {
    payload: {
      economics: section('Recurring 30% commission; pays most via in-house program.'),
      competitive_landscape: section('Several direct competitors; moderately saturated.'),
      demand_trend: section('Search interest rising over the last 12 months.'),
      momentum: section('Raised a Series A recently.'),
      reputation: section('Generally pays on time; few shaving complaints.'),
      paid_traffic_policy: section('Brand bidding prohibited; native allowed.'),
      recommended_test_approach: section('Start $500 on native, verify EPC before scaling.'),
      ad_examples: [
        {
          channel: 'facebook',
          headline: 'Build apps with AI',
          body: 'No code needed — launch this weekend.',
          creative_url: 'https://example.com/mock-creative-1.jpg',
          days_running: 63,
          source_url: 'https://www.facebook.com/ads/library/?id=mock1',
        },
      ],
    },
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/mockAi.ts
git commit -m "feat(research): mock fixture for offer research"
```

---

## Task 5: Offer-research orchestrator (Deno)

**Files:**
- Create: `supabase/functions/_shared/orchestrators/offerResearch.ts`

- [ ] **Step 1: Write the orchestrator**

```typescript
// supabase/functions/_shared/orchestrators/offerResearch.ts
import { callAnthropicWithTool } from '../anthropicJson.ts'
import { assertNotPaused } from '../killSwitch.ts'
import { loadActivePrompt } from '../loadActivePrompt.ts'
import { mockOfferResearch } from '../mockAi.ts'
import { OfferResearchResponseSchema } from '../types/offerResearch.ts'

const MODEL = 'claude-sonnet-4-6'
const TOOL_NAME = 'submit_offer_research'
const TOOL_DESCRIPTION =
  'Submit the deep research dossier for this offer. Call exactly once.'

export type ResearchBundle = {
  query: string
  results: Array<{ title: string; url: string; snippet: string }>
}

export type AdCreativeInput = {
  channel: string
  headline: string | null
  body: string | null
  creative_url: string | null
  days_running: number | null
  source_url: string | null
}

export type OfferResearchInput = {
  offerName: string
  url: string | null
  rawText: string
  research: ResearchBundle[]
  ads: AdCreativeInput[]
  verticalSlug?: string
}

export type OrchestratorResult = {
  output: Record<string, unknown>
  usage?: { input_tokens: number; output_tokens: number; cost_usd: number }
  mode: 'real' | 'mock'
}

export async function runOfferResearch(
  input: OfferResearchInput
): Promise<OrchestratorResult> {
  await assertNotPaused('OfferResearchOrchestrator')

  if (!Deno.env.get('ANTHROPIC_API_KEY')) {
    return { output: mockOfferResearch(), mode: 'mock' }
  }

  const systemPrompt = await loadActivePrompt('OfferResearchOrchestrator')
  const userMessage = JSON.stringify(
    {
      offer_name: input.offerName,
      url: input.url,
      vertical: input.verticalSlug ?? null,
      page_text: input.rawText.slice(0, 60_000),
      web_research: input.research,
      competitor_ads: input.ads,
      instructions:
        'Produce the dossier strictly from the provided page text, web_research, ' +
        'and competitor_ads. Every finding must carry evidence and a source_url ' +
        '(use null only when no source applies). Do not invent ads — only return ' +
        'ad_examples present in competitor_ads. Keep brand/product names as-is.',
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
    responseSchema: OfferResearchResponseSchema,
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

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/orchestrators/offerResearch.ts
git commit -m "feat(research): offer research synthesis orchestrator"
```

---

## Task 6: Synthesis prompt

**Files:**
- Create: `prompts/offer_research/v1.md`

- [ ] **Step 1: Write the prompt**

```markdown
You are a senior affiliate-marketing analyst producing a deep research dossier
on a single offer for an advanced media buyer who is about to spend real budget.

You are given JSON with: offer_name, url, vertical, page_text (the offer's own
site), web_research (search results per query), and competitor_ads (real ads
pulled from an ad library / spy tool).

Produce a dossier with EXACTLY these sections, each as { summary, findings[] }
where each finding is { claim, evidence, source_url }:

1. economics — commission structure, estimated EPC, and which network/route pays
   the most for this product.
2. competitive_landscape — direct competitors, positioning, market saturation.
3. demand_trend — rising/falling demand, seasonality, lifecycle stage.
4. momentum — funding, acquisitions, growth signals.
5. reputation — does it pay, shaving, affiliate complaints, compliance risk.
6. paid_traffic_policy — brand bidding, channel rules, restrictions.
7. recommended_test_approach — starting budget, recommended channel, what to
   verify before scaling.

Also return ad_examples[]: the competitor ads from competitor_ads, each as
{ channel, headline, body, creative_url, days_running, source_url }.

Rules:
- Ground EVERY claim in the provided page_text / web_research / competitor_ads.
  Put the supporting quote or fact in `evidence` and the URL in `source_url`
  (null only when genuinely no source applies). Never fabricate sources.
- Do NOT invent ads. ad_examples must come only from competitor_ads; if it is
  empty, return an empty ad_examples array.
- If the evidence for a section is thin, say so in `summary` rather than guessing.
- Keep brand names, product names, numbers, currencies, and units as-is.
- Call the tool exactly once with the full dossier.
```

- [ ] **Step 2: Commit**

```bash
git add prompts/offer_research/v1.md
git commit -m "feat(research): offer research synthesis prompt v1"
```

---

## Task 7: Credit price for research-offer

**Files:**
- Modify: `supabase/functions/_shared/credits.ts:38-43`

- [ ] **Step 1: Add the fallback price**

Change the `DEFAULT_PRICES` map to include `research-offer` (deep research is the most expensive action — multiple Tavily + spy-tool + 2 Sonnet calls):

```typescript
const DEFAULT_PRICES: Record<string, number> = {
  'analyze-offer': 5,
  'generate-test-kit': 10,
  'diagnose-results': 5,
  'check-compliance': 2,
  'research-offer': 25,
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/credits.ts
git commit -m "feat(research): price deep research at 25 credits (fallback)"
```

---

## Task 8: The research-offer edge function

**Files:**
- Create: `supabase/functions/research-offer/index.ts`

- [ ] **Step 1: Write the edge function**

```typescript
// supabase/functions/research-offer/index.ts
import { runWebSearch } from '../_shared/adapters/webSearch.ts'
import { runAdIntel } from '../_shared/adapters/adIntel.ts'
import { ForbiddenError, requireUser, UnauthorizedError } from '../_shared/auth.ts'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { assertUnderDailyCap, DailyCapExceededError } from '../_shared/costCap.ts'
import {
  InsufficientCreditsError,
  linkCreditToRun,
  refundCredits,
  reserveCredits,
  type CreditHold,
} from '../_shared/credits.ts'
import { sendToDlq } from '../_shared/dlq.ts'
import { assertNotPaused, OrchestratorPausedError } from '../_shared/killSwitch.ts'
import { runOfferResearch } from '../_shared/orchestrators/offerResearch.ts'
import { runUnderwriting } from '../_shared/orchestrators/underwriting.ts'
import {
  recordRunError,
  recordRunStart,
  recordRunSuccess,
} from '../_shared/recordAiRun.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'
import { truncate } from '../_shared/truncate.ts'
import { OfferResearchResponseSchema } from '../_shared/types/offerResearch.ts'

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

const FETCH_TIMEOUT_MS = 15_000
const MAX_HTML_BYTES = 500_000
const MAX_RAW_TEXT_LEN = 200_000
const RESEARCH_RESULTS_PER_QUERY = 3
const MAX_ADS = 8

// Deno mirror of src/lib/research/queries.ts (unit-tested there). KEEP IN SYNC.
function researchQueries(name: string): string[] {
  const n = name.trim()
  const raw = [
    `${n} affiliate program commission payout terms`,
    `${n} affiliate program which network highest commission`,
    `${n} competitors alternatives comparison`,
    `${n} search trend growth popularity`,
    `${n} funding round raised acquisition news`,
    `${n} affiliate program review does it pay shaving`,
    `${n} affiliate paid traffic brand bidding policy`,
    `${n} ad copy angle landing page swipe`,
  ]
  const out: string[] = []
  const seen = new Set<string>()
  for (const q of raw) {
    const key = q.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(q)
  }
  return out
}

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req)
  if (preflight) return preflight

  try {
    const user = await requireUser(req)

    const body = (await req.json().catch(() => ({}))) as { offer_id?: string }
    const offerId = body.offer_id
    if (!offerId) return jsonResponse({ error: 'offer_id is required' }, 400)

    const admin = getAdminClient()
    const { data: offer, error: offerErr } = await admin
      .from('offers')
      .select('id, workspace_id, vertical_id, name, website_url, operator_notes, verticals(slug)')
      .eq('id', offerId)
      .single()
    if (offerErr || !offer) return jsonResponse({ error: 'Offer not found' }, 404)

    try {
      await assertNotPaused('OfferResearchOrchestrator')
    } catch (err) {
      if (err instanceof OrchestratorPausedError) return jsonResponse({ error: err.message }, 503)
      throw err
    }

    if (offer.workspace_id) {
      try {
        await assertUnderDailyCap(offer.workspace_id)
      } catch (err) {
        if (err instanceof DailyCapExceededError) return jsonResponse({ error: err.message }, 429)
        throw err
      }
    }

    let creditHold: CreditHold | null = null
    if (offer.workspace_id) {
      try {
        creditHold = await reserveCredits(offer.workspace_id, 'research-offer')
      } catch (err) {
        if (err instanceof InsufficientCreditsError) return jsonResponse({ error: err.message }, 402)
        throw err
      }
    }

    const verticalSlug =
      (offer as unknown as { verticals?: { slug: string } | null }).verticals?.slug ??
      undefined

    const willCallReal = !!Deno.env.get('ANTHROPIC_API_KEY')
    const model = willCallReal ? 'claude-sonnet-4-6' : 'mock'

    const runId = await recordRunStart({
      orchestratorName: 'OfferResearchOrchestrator',
      agentVersion: willCallReal ? 'real-v1' : 'mock-v1',
      model,
      inputPayload: { offer_id: offerId, vertical: verticalSlug ?? null },
      userId: user.id,
      workspaceId: offer.workspace_id ?? undefined,
      offerId,
    })
    await linkCreditToRun(creditHold, runId)

    EdgeRuntime.waitUntil(
      (async () => {
        try {
          // 1. Page text — prefer a freshly fetched page, fall back to the
          // offer's latest stored source_document.
          let rawText = ''
          if (offer.website_url) {
            try {
              const html = await fetchWithTimeout(offer.website_url, FETCH_TIMEOUT_MS)
              const trimmed = html.length > MAX_HTML_BYTES ? html.slice(0, MAX_HTML_BYTES) : html
              rawText = truncate(stripHtml(trimmed), MAX_RAW_TEXT_LEN)
            } catch {
              // ignore — fall back below
            }
          }
          if (!rawText) {
            const { data: doc } = await admin
              .from('source_documents')
              .select('raw_text')
              .eq('offer_id', offerId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
            rawText = (doc as { raw_text?: string } | null)?.raw_text ?? ''
          }

          // 2. Web research (best-effort; failures leave thinner sections).
          const research: Array<{
            query: string
            results: Array<{ title: string; url: string; snippet: string }>
          }> = []
          if (Deno.env.get('DISCOVERY_SEARCH_API_KEY')) {
            for (const q of researchQueries(offer.name)) {
              try {
                const found = await runWebSearch(q, RESEARCH_RESULTS_PER_QUERY)
                research.push({
                  query: q,
                  results: found.map((r) => ({ title: r.name, url: r.url, snippet: r.snippet })),
                })
              } catch {
                // skip this query
              }
            }
          }

          // 3. Competitor ads (best-effort).
          let ads
          try {
            ads = await runAdIntel(offer.name, MAX_ADS)
          } catch {
            ads = []
          }

          // 4. Dossier synthesis.
          const result = await runOfferResearch({
            offerName: offer.name,
            url: offer.website_url ?? null,
            rawText,
            research,
            ads,
            verticalSlug,
          })

          await recordRunSuccess(runId, {
            outputPayload: result.output,
            validatedOutput: result.output,
            envelope: result.output,
            tokensInput: result.usage?.input_tokens,
            tokensOutput: result.usage?.output_tokens,
            estimatedCost: result.usage?.cost_usd ?? 0,
          })

          // 5. Verdict refresh — feed the offer's real verified facts PLUS the
          // dossier findings (in-memory only; never persisted as verified facts)
          // into the existing underwriting orchestrator.
          try {
            const { data: factsRows } = await admin
              .from('extracted_facts')
              .select('fact_type, fact_value, source_quote, confidence_score')
              .eq('offer_id', offerId)
              .eq('status', 'verified')
            const verified = factsRows ?? []

            const parsed = OfferResearchResponseSchema.safeParse(result.output)
            const researchFacts = parsed.success
              ? Object.values(parsed.data.payload)
                  .filter((s): s is { summary: string; findings: Array<{ claim: string; evidence: string }> } =>
                    !!s && typeof s === 'object' && 'findings' in s)
                  .flatMap((s) => s.findings)
                  .map((f) => ({
                    fact_type: 'other' as const,
                    fact_value: f.claim,
                    source_quote: f.evidence,
                    confidence_score: 70,
                  }))
              : []

            const uw = await runUnderwriting({
              offerId,
              offerName: offer.name,
              verticalSlug,
              facts: [...verified, ...researchFacts],
              userContext: null,
              operatorNotes: offer.operator_notes,
            })

            const uwRunId = await recordRunStart({
              orchestratorName: 'UnderwritingOrchestrator',
              agentVersion: willCallReal ? 'real-v1' : 'mock-v1',
              model,
              inputPayload: { offer_id: offerId, via: 'research-offer' },
              userId: user.id,
              workspaceId: offer.workspace_id ?? undefined,
              offerId,
            })
            await recordRunSuccess(uwRunId, {
              outputPayload: uw.output,
              validatedOutput: uw.output,
              envelope: uw.output,
              tokensInput: uw.usage?.input_tokens,
              tokensOutput: uw.usage?.output_tokens,
              estimatedCost: uw.usage?.cost_usd ?? 0,
            })

            await admin
              .from('offers')
              .update({ status: 'ai_analyzed', updated_at: new Date().toISOString() })
              .eq('id', offerId)
              .in('status', ['draft', 'needs_source_ingestion', 'ready_for_analysis'])
          } catch {
            // Verdict refresh is best-effort — the dossier already succeeded.
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          await recordRunError(runId, message)
          if (offer.workspace_id) {
            await refundCredits(offer.workspace_id, creditHold, 'research-offer', runId)
          }
          await sendToDlq({
            messageType: 'ai_run',
            payload: { kind: 'research-offer', offer_id: offerId, ai_run_id: runId },
            error: message,
          })
        }
      })()
    )

    return jsonResponse({ run_id: runId }, 200)
  } catch (err) {
    if (err instanceof UnauthorizedError) return jsonResponse({ error: err.message }, 401)
    if (err instanceof ForbiddenError) return jsonResponse({ error: err.message }, 403)
    return jsonResponse({ error: 'Internal error' }, 500)
  }
})

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AffiliateOS-Research/1.0' },
    })
    if (!res.ok) throw new Error(`fetch ${url} failed: HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(t)
  }
}

function stripHtml(s: string): string {
  return s
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/research-offer/index.ts
git commit -m "feat(research): research-offer edge function pipeline"
```

---

## Task 9: Server action

**Files:**
- Modify: `src/lib/actions/offers.ts` (add alongside `triggerAnalyze`)

- [ ] **Step 1: Add the action**

Append this to `src/lib/actions/offers.ts`:

```typescript
export async function startDeepResearch(
  offerId: string
): Promise<{ run_id: string } | { error: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase.functions.invoke('research-offer', {
    body: { offer_id: offerId },
  })
  if (error) return { error: error.message }
  return data as { run_id: string }
}
```

(If `createClient` isn't already imported in this file, it is — `triggerAnalyze` uses it. Reuse the same import.)

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/offers.ts
git commit -m "feat(research): startDeepResearch server action"
```

---

## Task 10: DeepResearchButton component

**Files:**
- Create: `src/components/offers/DeepResearchButton.tsx`

- [ ] **Step 1: Write the component (mirrors AnalyzeButton's Realtime pattern)**

```tsx
'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { startDeepResearch } from '@/lib/actions/offers'
import { createClient } from '@/lib/supabase/client'
import type { AiRunStatus } from '@/types/db'

const TERMINAL: AiRunStatus[] = ['success', 'failed', 'partial']

export function DeepResearchButton({
  offerId,
  initialStatus,
}: {
  offerId: string
  initialStatus: AiRunStatus | null
}) {
  const router = useRouter()
  const t = useTranslations('offers')
  const [status, setStatus] = useState<AiRunStatus | 'idle'>(
    initialStatus ?? 'idle'
  )
  const [runId, setRunId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isRunning = status === 'pending' || status === 'running'

  useEffect(() => {
    if (!runId || !isRunning) return
    const supabase = createClient()
    const channel = supabase
      .channel(`ai_run:${runId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ai_runs',
          filter: `id=eq.${runId}`,
        },
        (payload) => {
          const next = (payload.new as { status: AiRunStatus }).status
          if (TERMINAL.includes(next)) {
            setStatus(next)
            router.refresh()
          }
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [runId, isRunning, router])

  async function onResearch() {
    setError(null)
    setStatus('running')
    const result = await startDeepResearch(offerId)
    if ('error' in result) {
      setError(result.error)
      setStatus('idle')
      return
    }
    setRunId(result.run_id)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={onResearch} disabled={isRunning} variant="outline">
        {isRunning ? t('researching') : t('deepResearch')}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/offers/DeepResearchButton.tsx
git commit -m "feat(research): DeepResearchButton"
```

---

## Task 11: ResearchDossierView component

**Files:**
- Create: `src/components/offers/ResearchDossierView.tsx`

- [ ] **Step 1: Write the view**

```tsx
import { RESEARCH_SECTION_KEYS, type OfferResearchResponse } from '@/types/agents/offerResearch'

const SECTION_LABEL_KEYS: Record<(typeof RESEARCH_SECTION_KEYS)[number], string> = {
  economics: 'secEconomics',
  competitive_landscape: 'secCompetitive',
  demand_trend: 'secDemand',
  momentum: 'secMomentum',
  reputation: 'secReputation',
  paid_traffic_policy: 'secPaidPolicy',
  recommended_test_approach: 'secTestApproach',
}

export function ResearchDossierView({
  payload,
  labels,
  adExamplesLabel,
  runningLabel,
}: {
  payload: unknown
  labels: Record<string, string>
  adExamplesLabel: string
  runningLabel: string
}) {
  const env = payload as OfferResearchResponse | null
  const p = env?.payload
  if (!p) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        {labels.empty}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {RESEARCH_SECTION_KEYS.map((key) => {
        const section = p[key]
        if (!section) return null
        return (
          <section key={key} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
              {labels[SECTION_LABEL_KEYS[key]]}
            </h3>
            <p className="text-sm">{section.summary}</p>
            {section.findings.length > 0 && (
              <ul className="flex flex-col gap-2">
                {section.findings.map((f, i) => (
                  <li key={i} className="border-s-2 border-[var(--color-border)] ps-3 text-sm">
                    <span className="font-medium">{f.claim}</span>
                    <span className="block text-[var(--color-muted-foreground)]">
                      {f.evidence}
                    </span>
                    {f.source_url && (
                      <a
                        href={f.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs underline"
                      >
                        {labels.source} ↗
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}

      {p.ad_examples.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {adExamplesLabel}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {p.ad_examples.map((ad, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] p-3">
                {ad.creative_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ad.creative_url}
                    alt={ad.headline ?? 'ad creative'}
                    className="h-40 w-full rounded object-cover"
                  />
                )}
                {ad.headline && <p className="text-sm font-medium">{ad.headline}</p>}
                {ad.body && <p className="text-sm text-[var(--color-muted-foreground)]">{ad.body}</p>}
                <div className="flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
                  <span className="rounded bg-[var(--color-muted)] px-1.5 py-0.5">{ad.channel}</span>
                  {ad.days_running != null && <span>{runningLabel}: {ad.days_running}</span>}
                  {ad.source_url && (
                    <a href={ad.source_url} target="_blank" rel="noopener noreferrer" className="underline">
                      ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/offers/ResearchDossierView.tsx
git commit -m "feat(research): ResearchDossierView (sections + ad gallery)"
```

---

## Task 12: i18n keys

**Files:**
- Modify: `messages/en.json` (the `offers` namespace)
- Modify: `messages/he.json` (the `offers` namespace)

- [ ] **Step 1: Add keys to `messages/en.json` under `"offers"`**

```json
"deepResearch": "Deep research",
"researching": "Researching…",
"tabResearch": "Research",
"researchEmpty": "No research yet. Run deep research to build the dossier.",
"researchSource": "Source",
"secEconomics": "Economics & payout route",
"secCompetitive": "Competitive landscape",
"secDemand": "Demand & trend",
"secMomentum": "Momentum",
"secReputation": "Reputation & complaints",
"secPaidPolicy": "Paid-traffic policy",
"secTestApproach": "Recommended test approach",
"adExamples": "Competitor ads",
"adRunningDays": "Running (days)"
```

- [ ] **Step 2: Add the SAME keys to `messages/he.json` under `"offers"`**

```json
"deepResearch": "מחקר עומק",
"researching": "חוקר…",
"tabResearch": "מחקר",
"researchEmpty": "עדיין אין מחקר. הרץ מחקר עומק כדי לבנות את הדוסייה.",
"researchSource": "מקור",
"secEconomics": "כלכלה ומסלול תשלום",
"secCompetitive": "נוף תחרותי",
"secDemand": "ביקוש ומגמה",
"secMomentum": "מומנטום",
"secReputation": "מוניטין ותלונות",
"secPaidPolicy": "מדיניות תנועה בתשלום",
"secTestApproach": "המלצת גישת בדיקה",
"adExamples": "מודעות מתחרים",
"adRunningDays": "רץ (ימים)"
```

- [ ] **Step 3: Verify JSON parses + parity (both files load, same keys)**

Run: `node -e "const e=require('./messages/en.json').offers, h=require('./messages/he.json').offers; const a=Object.keys(e), b=Object.keys(h); const miss=a.filter(k=>!b.includes(k)).concat(b.filter(k=>!a.includes(k))); if(miss.length){console.error('PARITY MISMATCH', miss); process.exit(1)} console.log('ok', a.length)"`
Expected: `ok <n>` with no mismatch.

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/he.json
git commit -m "feat(research): i18n keys for the research tab"
```

---

## Task 13: Wire the Research tab into the offer page

**Files:**
- Modify: `src/app/(app)/offers/[id]/page.tsx`

- [ ] **Step 1: Add imports**

Add to the import block:

```typescript
import { DeepResearchButton } from '@/components/offers/DeepResearchButton'
import { ResearchDossierView } from '@/components/offers/ResearchDossierView'
```

- [ ] **Step 2: Extend TAB_KEYS**

Change the `TAB_KEYS` array to include `'research'`:

```typescript
const TAB_KEYS = [
  'overview',
  'scorecard',
  'verdict',
  'test-kit',
  'compliance',
  'research',
] as const
```

- [ ] **Step 3: Allow the tab in activeTab + add its label**

Update the `activeTab` ternary to accept `'research'`, and add to `TAB_LABELS`:

```typescript
  const activeTab =
    tab === 'scorecard' ||
    tab === 'verdict' ||
    tab === 'test-kit' ||
    tab === 'compliance' ||
    tab === 'research'
      ? tab
      : 'overview'
```

```typescript
    compliance: t('tabCompliance'),
    research: t('tabResearch'),
```

- [ ] **Step 4: Fetch the latest research run + its translated payload (after the testKit block)**

```typescript
  const researchRun =
    activeTab === 'research'
      ? await getLatestRunByOrchestrator(id, 'OfferResearchOrchestrator')
      : null
  const researchPayload = researchRun
    ? await getTranslatedPayload('ai_runs', researchRun.id, locale, researchRun.output_payload)
    : null
```

- [ ] **Step 5: Render the tab (add after the compliance tab block)**

```tsx
      {activeTab === 'research' && (
        <div className="flex flex-col gap-6">
          <DeepResearchButton
            offerId={offer.id}
            initialStatus={researchRun?.status ?? null}
          />
          {researchRun ? (
            <>
              <ResearchDossierView
                payload={researchPayload}
                labels={{
                  empty: t('researchEmpty'),
                  source: t('researchSource'),
                  secEconomics: t('secEconomics'),
                  secCompetitive: t('secCompetitive'),
                  secDemand: t('secDemand'),
                  secMomentum: t('secMomentum'),
                  secReputation: t('secReputation'),
                  secPaidPolicy: t('secPaidPolicy'),
                  secTestApproach: t('secTestApproach'),
                }}
                adExamplesLabel={t('adExamples')}
                runningLabel={t('adRunningDays')}
              />
              {researchRun.output_payload != null &&
                shouldTranslate(locale, researchRun.output_payload) && (
                  <TranslationFiller
                    sourceTable="ai_runs"
                    sourceId={researchRun.id}
                    locale={locale}
                  />
                )}
            </>
          ) : (
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {t('researchEmpty')}
            </p>
          )}
        </div>
      )}
```

- [ ] **Step 6: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: typecheck PASS, lint no new errors, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/offers/[id]/page.tsx"
git commit -m "feat(research): wire Research tab into the offer page"
```

---

## Task 14: Mock-mode manual e2e script

**Files:**
- Create: `scripts/test-research-offer-e2e.mjs`

- [ ] **Step 1: Write the script (mirrors the other `scripts/test-*-e2e.mjs`)**

Model it on an existing script — open `scripts/test-testkit-e2e.mjs` for the exact client/auth/cleanup helpers in this repo, and adapt: create a throwaway user + offer, `POST` to the `research-offer` function with the user's JWT, poll the latest `OfferResearchOrchestrator` ai_run until terminal, assert `output_payload.payload.economics.summary` is present and that an `UnderwritingOrchestrator` run also landed, then delete the throwaway rows. Run with mock AI (no `ANTHROPIC_API_KEY`).

```bash
# Reference the existing pattern, then run:
node scripts/test-research-offer-e2e.mjs
```
Expected: prints the dossier section count + "verdict refreshed", exits 0, cleans up.

- [ ] **Step 2: Commit**

```bash
git add scripts/test-research-offer-e2e.mjs
git commit -m "test(research): mock-mode e2e for research-offer"
```

---

## Task 15: Owner deploy steps (post-merge)

These are owner/CI actions, not code (note them in the PR / hand off):

- [ ] Deploy the edge function: `supabase functions deploy research-offer` (or trigger the `deploy-edge.yml` workflow with `function: research-offer`).
- [ ] Sync the prompt: trigger `sync-prompts.yml` (registers `OfferResearchOrchestrator` / `offer_research/v1`).
- [ ] (Optional) Set `AD_INTEL_API_KEY` + `AD_INTEL_API_URL` as Supabase secrets once a spy tool is chosen — until then the adapter returns mock creatives in dev and an empty ad list in prod.
- [ ] (Optional) Add a `usage_pricing_rules` row for `research-offer` if you want the price in the DB rather than the code fallback (25).

---

## Self-Review

- **Spec coverage:** edge fn pipeline (T8) ✓; 7-section + ad dossier contract (T1) ✓; web research (T2/T8) ✓; ad-intel adapter real-or-mock (T3) ✓; synthesis orchestrator + prompt (T5/T6) ✓; verdict refresh in-memory, no fact pollution (T8) ✓; no migration — dossier in ai_runs (T8/T13) ✓; Hebrew translation via existing layer (T13 TranslationFiller, ai_runs) ✓; Research tab + button (T10/T11/T13) ✓; credits (T7) ✓; tests (T1/T2/T14) ✓; access = requireUser like analyze (T8) ✓.
- **Placeholder scan:** the e2e script (T14) references an existing script for boilerplate rather than reproducing ~150 lines of repo-specific auth/cleanup — intentional, with the exact assertions spelled out.
- **Type consistency:** `OfferResearchResponseSchema` / `OfferResearchPayloadSchema` / `RESEARCH_SECTION_KEYS` used identically across T1, T5, T8, T11, T13; `runAdIntel(brand, max)` and `runOfferResearch(input)` signatures match their call sites in T8; `startDeepResearch` (T9) matches its use in T10.
