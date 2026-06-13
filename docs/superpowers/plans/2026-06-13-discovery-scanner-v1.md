# Discovery Scanner v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the admin a "Start scan" button that broadly discovers affiliate offers from configured sources, runs them through a transparent two-stage AI funnel (cheap triage of many → deep analysis of the survivors), and presents a ranked shortlist where every candidate — kept or rejected — carries the reason and the stage it dropped out at; the admin approves candidates, which promotes them into real offers users can see.

**Architecture:** A new `discover-offers` edge function runs the funnel in the background (the same `EdgeRuntime.waitUntil` + kill-switch + daily-cap + `ai_runs` cost-tracking pattern the other five orchestrators use). Three new tables record the run, the admin-managed source registry, and every candidate with its full funnel provenance. Sources and the web-search step are **adapters** behind one interface so affiliate-network connectors (Impact/CJ, needing API keys) and auto-scheduling are additive later without reshaping anything. Approval reuses the existing golden→offer promote pattern. Everything is admin-only until approval creates a normal `offer`, so users only ever see vetted results.

**Tech Stack:** Next.js 15 App Router (server components + actions), Supabase (RLS, Deno edge function, service-role admin client), Zod dual contracts (Node `src/types/agents/*` + Deno `_shared/types/*`, KEEP IN SYNC), Vitest. Web search via an env-guarded adapter (Tavily by default) that falls back to a mock fixture when no key is set — so the whole funnel is dev-runnable and testable cost-free.

---

## Decisions made (flagged for owner confirmation — none block implementation)

1. **Web-search provider = Tavily** (`DISCOVERY_SEARCH_API_KEY`). Purpose-built for agents, returns cleaned page content, ~$0.005/search. The adapter (`webSearch.ts`) isolates it; swapping to Brave/Serper is a one-file change. **Mock fallback** when the key is absent, so v1 ships and is testable without an account.
2. **v1 source kinds = `web_search` only.** The `discovery_sources` table and the adapter interface are built to also hold `directory` and `network` kinds, but only `web_search` is wired in v1. Network connectors (Impact/CJ/PartnerStack, requiring your API keys) are **Phase 2**, explicitly out of scope here.
3. **Trigger = manual button only** (you asked for this). The run config carries a `breadth` knob (how many search queries × results per query). Auto-scheduling (a Vercel cron hitting the same edge fn) is **Phase 3**, out of scope here.
4. **Funnel thresholds:** triage keeps candidates scoring ≥ 55/100; deep analysis caps at the top 20 survivors per run. Both live in named constants so they're trivial to tune after the first real runs.
5. **Cost guard:** the run is admin-only and obeys the existing daily-USD cap; there is no credit charge (discovery is your cost, not a user's). Each AI call still records an `ai_runs` row, so the run's total cost is visible.

---

## Phasing (this plan = v1 only)

- **v1 (this plan):** web-search discovery → transparent funnel → admin approve → publish. Demoable end to end.
- **Phase 2 (separate plan):** affiliate-network adapters behind the same source interface (API-key gated).
- **Phase 3 (separate plan):** scheduled auto-scans + drift/novelty alerts.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `supabase/migrations/0030_discovery.sql` | `discovery_sources`, `discovery_runs`, `discovery_candidates` + enums + RLS (admin-only) + seed one web_search source per vertical | Create |
| `src/lib/discovery/dedup.ts` | Pure: normalize URL→domain, dedup candidates against existing offers/candidates | Create |
| `src/lib/discovery/dedup.test.ts` | Unit tests | Create |
| `src/lib/discovery/funnel.ts` | Pure: funnel counts from candidate rows, rank survivors, stage labels/colors | Create |
| `src/lib/discovery/funnel.test.ts` | Unit tests | Create |
| `src/lib/validations/discovery.ts` | Zod: `StartScanSchema`, `DiscoverySourceSchema`, stage/decision enums | Create |
| `src/lib/validations/discovery.test.ts` | Unit tests | Create |
| `src/types/agents/discovery.ts` | Node Zod contracts: triage + deep response (sync twin of Deno) | Create |
| `supabase/functions/_shared/types/discovery.ts` | Deno Zod contracts: triage + deep response (sync twin of Node) | Create |
| `supabase/functions/_shared/adapters/webSearch.ts` | Web-search adapter (Tavily real-or-mock), returns raw candidates | Create |
| `supabase/functions/_shared/orchestrators/discoveryTriage.ts` | Haiku batch triage, real-or-mock | Create |
| `supabase/functions/_shared/orchestrators/discoveryDeep.ts` | Sonnet deep analysis of one candidate page, real-or-mock | Create |
| `supabase/functions/_shared/mockAi.ts` | Add `mockDiscoveryTriage` + `mockDiscoveryDeep` fixtures | Modify |
| `supabase/functions/discover-offers/index.ts` | Edge fn: trigger + background funnel orchestration | Create |
| `prompts/DiscoveryTriageOrchestrator/v1.md` | Triage system prompt | Create |
| `prompts/DiscoveryDeepOrchestrator/v1.md` | Deep-analysis system prompt | Create |
| `src/lib/actions/discovery.ts` | Server actions: `startScan`, `approveCandidate`, `rejectCandidate`, source CRUD | Create |
| `src/lib/queries/discovery.ts` | Queries: list runs, get run + candidates, list sources | Create |
| `src/app/admin/discovery/page.tsx` | Runs list + Start-scan control | Create |
| `src/app/admin/discovery/[runId]/page.tsx` | Transparent funnel + candidate review | Create |
| `src/app/admin/discovery/sources/page.tsx` | Source registry management | Create |
| `src/components/discovery/StartScanForm.tsx` | Client: pick vertical + breadth, trigger scan | Create |
| `src/components/discovery/FunnelBar.tsx` | Client/server: the Discovered→Triaged→Analyzed→Approved bar | Create |
| `src/components/discovery/CandidateRow.tsx` | Client: one candidate + approve/reject buttons | Create |
| `src/app/admin/layout.tsx` | Add "Discovery" nav link | Modify |
| `.env.example` | Document `DISCOVERY_SEARCH_API_KEY` / `DISCOVERY_SEARCH_PROVIDER` | Modify |
| `CLAUDE.md` | Snapshot: migration 0030, discover-offers fn, /admin/discovery | Modify |

**Commands:** test = `pnpm test`; single file = `pnpm exec vitest run <path>`; `pnpm typecheck`; `pnpm lint`. Vitest covers `src/**` only; `supabase/functions/**` is Deno (excluded from tsconfig) — verified by deploy + a manual e2e script.

**Migration note (admin-coordinated per CLAUDE.md):** adds `0030_discovery.sql`. New tables ship RLS in the same migration. Regenerate `database.ts` on `main` after merge (`pnpm dlx supabase@latest gen types typescript --linked`) — the Node code in this plan that touches the new tables uses explicit row types so it compiles before regen; after regen, the `as` casts can be dropped.

---

## Task 1: Migration 0030 — discovery tables + RLS + seed

**Why:** The funnel needs durable state: an admin-managed source registry, one row per scan, and one row per candidate carrying its full provenance (score, reason, stage it dropped at, the offer it became). All admin-only.

**Files:**
- Create: `supabase/migrations/0030_discovery.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0030_discovery.sql`:

```sql
-- 0030_discovery.sql
-- Discovery Scanner v1: broad source-driven discovery → transparent two-stage
-- funnel → admin approval → promote to a real offer. All tables admin-only;
-- users never see candidates, only the offers an admin approves.

create type discovery_source_kind as enum ('web_search', 'directory', 'network');
create type discovery_run_status as enum (
  'queued', 'discovering', 'triaging', 'analyzing', 'completed', 'failed'
);
-- Candidate lifecycle through the funnel. 'rejected' is terminal-at-a-stage
-- (see rejection_stage); 'approved' means an admin accepted it; 'promoted'
-- means it became a real offer.
create type discovery_candidate_stage as enum (
  'discovered', 'triaged', 'analyzed', 'rejected', 'approved', 'promoted'
);

-- Admin-managed registry of where to scan. config holds kind-specific settings
-- (web_search: { query_templates: text[] }). network/directory kinds are
-- reserved for later phases.
create table discovery_sources (
  id uuid primary key default gen_random_uuid(),
  kind discovery_source_kind not null default 'web_search',
  name text not null,
  vertical_id uuid references verticals(id),
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index discovery_sources_enabled_idx on discovery_sources(enabled);

-- One row per "Start scan" click.
create table discovery_runs (
  id uuid primary key default gen_random_uuid(),
  triggered_by uuid references profiles(id),
  vertical_id uuid references verticals(id),
  status discovery_run_status not null default 'queued',
  config jsonb not null default '{}'::jsonb,   -- { breadth, queries_per_source, results_per_query }
  counts jsonb not null default '{}'::jsonb,    -- { discovered, triaged, analyzed, approved }
  total_cost_usd numeric(10,4) not null default 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index discovery_runs_status_idx on discovery_runs(status);
create index discovery_runs_created_idx on discovery_runs(created_at desc);

-- One row per discovered candidate. Keeps the full funnel trail: triage score +
-- reason, deep analysis + score, and — if it dropped — the stage and reason.
create table discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references discovery_runs(id) on delete cascade,
  source_id uuid references discovery_sources(id),
  vertical_id uuid references verticals(id),
  name text not null,
  url text,
  domain text,                       -- normalized, for dedup
  raw_snippet text,
  stage discovery_candidate_stage not null default 'discovered',
  triage_score int,                  -- 0-100
  triage_reason text,
  deep_analysis jsonb,               -- full deep-analysis payload
  deep_score int,                    -- 0-100 overall quality
  rejection_stage discovery_candidate_stage,  -- which stage it dropped at
  rejection_reason text,
  promoted_offer_id uuid references offers(id),
  created_at timestamptz not null default now()
);
create index discovery_candidates_run_idx on discovery_candidates(run_id);
create index discovery_candidates_stage_idx on discovery_candidates(stage);
create index discovery_candidates_domain_idx on discovery_candidates(domain);

alter table discovery_sources enable row level security;
alter table discovery_runs enable row level security;
alter table discovery_candidates enable row level security;

create policy "admin manage discovery_sources" on discovery_sources for all
  using (is_current_user_admin());
create policy "admin manage discovery_runs" on discovery_runs for all
  using (is_current_user_admin());
create policy "admin manage discovery_candidates" on discovery_candidates for all
  using (is_current_user_admin());

-- Seed one web_search source per vertical so the first scan works out of the box.
insert into discovery_sources (kind, name, vertical_id, config)
select
  'web_search',
  'Web search — ' || v.name,
  v.id,
  jsonb_build_object('query_templates', jsonb_build_array(
    'best ' || v.name || ' affiliate programs ' || extract(year from now())::text,
    'high commission ' || v.name || ' affiliate program',
    v.name || ' partner program payout terms'
  ))
from verticals v;
```

- [ ] **Step 2: Apply to the linked project**

Run: `pnpm dlx supabase@latest db push`
Expected: `0030_discovery.sql` applied. If the CLI has no credentials in this environment, mark it an owner step in the handoff and continue (Node code below compiles via explicit row types; it just returns empty until applied).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0030_discovery.sql
git commit -m "feat(discovery): tables for sources, runs, candidates (admin-only RLS)"
```

---

## Task 2: Pure dedup helpers (TDD)

**Why:** Discovery will surface the same domain many times (and domains already in `offers`). Dedup by normalized domain is pure, edge-case-heavy logic worth testing in isolation — and it runs in both the edge fn (Deno) and is unit-tested in Node, so it must be dependency-free.

**Files:**
- Create: `src/lib/discovery/dedup.ts`
- Test: `src/lib/discovery/dedup.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/discovery/dedup.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { domainOf, dedupeByDomain } from './dedup'

describe('domainOf', () => {
  it('lowercases and strips www + path', () => {
    expect(domainOf('https://WWW.Example.com/affiliates?x=1')).toBe(
      'example.com'
    )
  })

  it('handles bare domains without scheme', () => {
    expect(domainOf('Example.com/x')).toBe('example.com')
  })

  it('returns null for unusable input', () => {
    expect(domainOf('')).toBeNull()
    expect(domainOf('not a url at all ')).toBeNull()
  })
})

describe('dedupeByDomain', () => {
  it('drops candidates whose domain is already known', () => {
    const out = dedupeByDomain(
      [
        { name: 'A', url: 'https://a.com' },
        { name: 'B', url: 'https://b.com' },
      ],
      new Set(['a.com'])
    )
    expect(out.map((c) => c.name)).toEqual(['B'])
  })

  it('drops intra-batch duplicates, keeping the first', () => {
    const out = dedupeByDomain(
      [
        { name: 'first', url: 'https://dup.com/x' },
        { name: 'second', url: 'https://www.dup.com/y' },
      ],
      new Set()
    )
    expect(out.map((c) => c.name)).toEqual(['first'])
  })

  it('drops candidates with no resolvable domain', () => {
    const out = dedupeByDomain([{ name: 'bad', url: 'garbage' }], new Set())
    expect(out).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/lib/discovery/dedup.test.ts`
Expected: FAIL — `Failed to resolve import "./dedup"`.

- [ ] **Step 3: Write the helpers**

Create `src/lib/discovery/dedup.ts`:

```ts
export type RawCandidate = { name: string; url: string | null }

// Normalize a URL to a comparable registered domain: lowercased, no scheme,
// no www, no path. Returns null when there's nothing usable.
export function domainOf(url: string | null): string | null {
  if (!url || !url.trim()) return null
  const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url.trim()}`
  let host: string
  try {
    host = new URL(withScheme).hostname
  } catch {
    return null
  }
  const cleaned = host.toLowerCase().replace(/^www\./, '')
  // Reject inputs that didn't actually parse to a dotted host.
  return cleaned.includes('.') ? cleaned : null
}

// Keep candidates whose domain is new (not in `known`) and not already seen
// earlier in this batch. Candidates with no resolvable domain are dropped.
export function dedupeByDomain<T extends RawCandidate>(
  candidates: T[],
  known: Set<string>
): Array<T & { domain: string }> {
  const seen = new Set(known)
  const out: Array<T & { domain: string }> = []
  for (const c of candidates) {
    const domain = domainOf(c.url)
    if (!domain || seen.has(domain)) continue
    seen.add(domain)
    out.push({ ...c, domain })
  }
  return out
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/lib/discovery/dedup.test.ts`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/discovery/dedup.ts src/lib/discovery/dedup.test.ts
git commit -m "feat(discovery): pure domain dedup helpers"
```

---

## Task 3: Pure funnel helpers (TDD)

**Why:** The transparency view computes funnel counts and ranks survivors. Pure, testable, and reused by both the run page and (later) the run-summary counts written by the edge fn.

**Files:**
- Create: `src/lib/discovery/funnel.ts`
- Test: `src/lib/discovery/funnel.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/discovery/funnel.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import {
  STAGE_LABELS,
  funnelCounts,
  rankAnalyzed,
  type CandidateLike,
} from './funnel'

const c = (over: Partial<CandidateLike>): CandidateLike => ({
  id: Math.random().toString(),
  stage: 'discovered',
  deep_score: null,
  triage_score: null,
  ...over,
})

describe('funnelCounts', () => {
  it('counts discovered as everything, then each later stage cumulatively', () => {
    const counts = funnelCounts([
      c({ stage: 'rejected', rejection_stage: 'triaged' }),
      c({ stage: 'rejected', rejection_stage: 'analyzed' }),
      c({ stage: 'analyzed' }),
      c({ stage: 'approved' }),
      c({ stage: 'promoted' }),
    ])
    // discovered = all 5; triaged = survived triage = analyzed+approved+promoted
    // + the one rejected AT analyzed (it passed triage) = 4; analyzed = reached
    // deep = same 4; approved = approved+promoted = 2.
    expect(counts).toEqual({ discovered: 5, triaged: 4, analyzed: 4, approved: 2 })
  })
})

describe('rankAnalyzed', () => {
  it('returns reached-deep candidates sorted by deep_score desc', () => {
    const ranked = rankAnalyzed([
      c({ id: 'low', stage: 'analyzed', deep_score: 40 }),
      c({ id: 'high', stage: 'approved', deep_score: 90 }),
      c({ id: 'dropped', stage: 'rejected', rejection_stage: 'triaged' }),
    ])
    expect(ranked.map((r) => r.id)).toEqual(['high', 'low'])
  })
})

describe('STAGE_LABELS', () => {
  it('has a human label for every stage', () => {
    expect(STAGE_LABELS.discovered).toBeTruthy()
    expect(STAGE_LABELS.promoted).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/lib/discovery/funnel.test.ts`
Expected: FAIL — `Failed to resolve import "./funnel"`.

- [ ] **Step 3: Write the helpers**

Create `src/lib/discovery/funnel.ts`:

```ts
export type CandidateStage =
  | 'discovered'
  | 'triaged'
  | 'analyzed'
  | 'rejected'
  | 'approved'
  | 'promoted'

export type CandidateLike = {
  id: string
  stage: CandidateStage
  triage_score: number | null
  deep_score: number | null
  rejection_stage?: CandidateStage | null
}

export const STAGE_LABELS: Record<CandidateStage, string> = {
  discovered: 'Discovered',
  triaged: 'Passed triage',
  analyzed: 'Deep-analyzed',
  rejected: 'Rejected',
  approved: 'Approved',
  promoted: 'Published',
}

export const STAGE_BADGE_CLASS: Record<CandidateStage, string> = {
  discovered: 'border-zinc-300 bg-zinc-100 text-zinc-700',
  triaged: 'border-blue-300 bg-blue-100 text-blue-800',
  analyzed: 'border-violet-300 bg-violet-100 text-violet-800',
  rejected: 'border-red-300 bg-red-100 text-red-800',
  approved: 'border-green-300 bg-green-100 text-green-800',
  promoted: 'border-emerald-400 bg-emerald-100 text-emerald-900',
}

export type FunnelCounts = {
  discovered: number
  triaged: number
  analyzed: number
  approved: number
}

// A candidate "reached deep analysis" if it's at analyzed/approved/promoted, or
// it was rejected AT the analyzed stage. It "passed triage" if it reached deep
// OR was rejected at the analyzed stage (same set in v1, but kept explicit).
function reachedDeep(x: CandidateLike): boolean {
  return (
    x.stage === 'analyzed' ||
    x.stage === 'approved' ||
    x.stage === 'promoted' ||
    (x.stage === 'rejected' && x.rejection_stage === 'analyzed')
  )
}

export function funnelCounts(candidates: CandidateLike[]): FunnelCounts {
  let triaged = 0
  let analyzed = 0
  let approved = 0
  for (const x of candidates) {
    if (reachedDeep(x)) {
      triaged++
      analyzed++
    }
    if (x.stage === 'approved' || x.stage === 'promoted') approved++
  }
  return { discovered: candidates.length, triaged, analyzed, approved }
}

// Candidates that reached deep analysis, best first.
export function rankAnalyzed<T extends CandidateLike>(candidates: T[]): T[] {
  return candidates
    .filter(reachedDeep)
    .sort((a, b) => (b.deep_score ?? 0) - (a.deep_score ?? 0))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/lib/discovery/funnel.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/discovery/funnel.ts src/lib/discovery/funnel.test.ts
git commit -m "feat(discovery): pure funnel counts + ranking helpers"
```

---

## Task 4: Validation schemas (TDD)

**Why:** The start-scan form and the source CRUD action need validated input; centralizing the stage/decision enums keeps the UI and actions in sync.

**Files:**
- Create: `src/lib/validations/discovery.ts`
- Test: `src/lib/validations/discovery.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/validations/discovery.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { DiscoverySourceSchema, StartScanSchema } from './discovery'

describe('StartScanSchema', () => {
  it('accepts a vertical + valid breadth', () => {
    const r = StartScanSchema.safeParse({
      vertical_id: '11111111-1111-1111-1111-111111111111',
      breadth: 'standard',
    })
    expect(r.success).toBe(true)
  })

  it('defaults breadth to standard when omitted', () => {
    const r = StartScanSchema.safeParse({
      vertical_id: '11111111-1111-1111-1111-111111111111',
    })
    expect(r.success && r.data.breadth).toBe('standard')
  })

  it('rejects a non-uuid vertical', () => {
    expect(StartScanSchema.safeParse({ vertical_id: 'nope' }).success).toBe(
      false
    )
  })
})

describe('DiscoverySourceSchema', () => {
  it('accepts a web_search source with query templates', () => {
    const r = DiscoverySourceSchema.safeParse({
      name: 'Web search — AI/SaaS',
      kind: 'web_search',
      query_templates: ['best ai saas affiliate programs'],
      enabled: true,
    })
    expect(r.success).toBe(true)
  })

  it('rejects an empty name', () => {
    expect(
      DiscoverySourceSchema.safeParse({ name: '', kind: 'web_search' }).success
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/lib/validations/discovery.test.ts`
Expected: FAIL — `Failed to resolve import "./discovery"`.

- [ ] **Step 3: Write the schemas**

Create `src/lib/validations/discovery.ts`:

```ts
import { z } from 'zod'

// Breadth maps to how aggressively the scan fans out (queries × results).
// Resolved to concrete numbers in the edge fn (BREADTH_PARAMS).
export const SCAN_BREADTHS = ['quick', 'standard', 'deep'] as const

export const StartScanSchema = z.object({
  vertical_id: z.string().uuid('Select a vertical.'),
  breadth: z.enum(SCAN_BREADTHS).default('standard'),
})
export type StartScanInput = z.infer<typeof StartScanSchema>

export const DISCOVERY_SOURCE_KINDS = [
  'web_search',
  'directory',
  'network',
] as const

export const DiscoverySourceSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  kind: z.enum(DISCOVERY_SOURCE_KINDS).default('web_search'),
  vertical_id: z.string().uuid().optional().or(z.literal('')),
  query_templates: z.array(z.string().min(1)).optional(),
  enabled: z.boolean().default(true),
})
export type DiscoverySourceInput = z.infer<typeof DiscoverySourceSchema>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/lib/validations/discovery.test.ts`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations/discovery.ts src/lib/validations/discovery.test.ts
git commit -m "feat(discovery): start-scan + source validation schemas"
```

---

## Task 5: Dual Zod contracts for triage + deep analysis

**Why:** The orchestrators validate LLM tool output with Zod (per the project's forced-tool-use pattern). Contracts live twice — Node (`src/types/agents`) for any app-side typing and Deno (`_shared/types`) for the orchestrators — and MUST stay identical.

**Files:**
- Create: `src/types/agents/discovery.ts`
- Create: `supabase/functions/_shared/types/discovery.ts`

- [ ] **Step 1: Write the Deno contract**

Create `supabase/functions/_shared/types/discovery.ts`:

```ts
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts'

// Triage scores a BATCH of candidates cheaply: is this a real, promotable
// affiliate offer, and how promising? One result per input, matched by index.
export const TriageItemSchema = z.object({
  index: z.number().int().min(0),
  is_affiliate_offer: z.boolean(),
  score: z.number().int().min(0).max(100),
  reason: z.string().min(1),
})
export const TriageResponseSchema = z.object({
  results: z.array(TriageItemSchema),
})
export type TriageResponse = z.infer<typeof TriageResponseSchema>

// Deep analysis of one candidate's page: a quality read with the key facts that
// justify the score, so the admin sees WHY it ranked where it did.
export const DeepAnalysisSchema = z.object({
  overall_score: z.number().int().min(0).max(100),
  summary: z.string().min(1),
  key_strengths: z.array(z.string()),
  key_risks: z.array(z.string()),
  estimated_commission: z.string().nullable(),
  recommended: z.boolean(),
})
export type DeepAnalysis = z.infer<typeof DeepAnalysisSchema>
```

- [ ] **Step 2: Write the Node twin**

Create `src/types/agents/discovery.ts` (identical shape, Node import of zod):

```ts
import { z } from 'zod'

export const TriageItemSchema = z.object({
  index: z.number().int().min(0),
  is_affiliate_offer: z.boolean(),
  score: z.number().int().min(0).max(100),
  reason: z.string().min(1),
})
export const TriageResponseSchema = z.object({
  results: z.array(TriageItemSchema),
})
export type TriageResponse = z.infer<typeof TriageResponseSchema>

export const DeepAnalysisSchema = z.object({
  overall_score: z.number().int().min(0).max(100),
  summary: z.string().min(1),
  key_strengths: z.array(z.string()),
  key_risks: z.array(z.string()),
  estimated_commission: z.string().nullable(),
  recommended: z.boolean(),
})
export type DeepAnalysis = z.infer<typeof DeepAnalysisSchema>
```

- [ ] **Step 3: Typecheck (Node side compiles)**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/agents/discovery.ts supabase/functions/_shared/types/discovery.ts
git commit -m "feat(discovery): dual Zod contracts for triage + deep analysis"
```

---

## Task 6: Web-search adapter (real-or-mock)

**Why:** Discovery starts by turning source query templates into candidate offers. Isolating the provider behind one function means swapping Tavily→Brave, or adding network adapters later, touches nothing else. Mock fallback keeps the funnel runnable without a key.

**Files:**
- Create: `supabase/functions/_shared/adapters/webSearch.ts`

- [ ] **Step 1: Write the adapter**

Create `supabase/functions/_shared/adapters/webSearch.ts`:

```ts
// Web-search adapter. Real Tavily call when DISCOVERY_SEARCH_API_KEY is set;
// otherwise a deterministic mock so the funnel is dev-runnable cost-free.
// Returns lightweight candidates; the funnel dedupes + triages them downstream.

export type SearchCandidate = {
  name: string
  url: string
  snippet: string
}

const MOCK_CANDIDATES: SearchCandidate[] = [
  {
    name: 'Base44',
    url: 'https://base44.com/affiliates',
    snippet: 'AI app builder affiliate program — recurring commission.',
  },
  {
    name: 'Higgsfield',
    url: 'https://higgsfield.ai/partners',
    snippet: 'Generative video platform partner program.',
  },
  {
    name: 'Example Saturated Tool',
    url: 'https://example-old-tool.com',
    snippet: 'Long-standing tool, thin affiliate terms.',
  },
]

export async function runWebSearch(
  query: string,
  maxResults: number
): Promise<SearchCandidate[]> {
  const apiKey = Deno.env.get('DISCOVERY_SEARCH_API_KEY')
  if (!apiKey) {
    return MOCK_CANDIDATES.slice(0, maxResults)
  }

  // Tavily search API. Returns results[].{title,url,content}.
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      search_depth: 'basic',
    }),
  })
  if (!res.ok) throw new Error(`web search failed: HTTP ${res.status}`)
  const data = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>
  }
  return (data.results ?? [])
    .filter((r) => r.url)
    .map((r) => ({
      name: r.title?.trim() || r.url!,
      url: r.url!,
      snippet: r.content?.slice(0, 500) ?? '',
    }))
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/_shared/adapters/webSearch.ts
git commit -m "feat(discovery): web-search adapter (Tavily real-or-mock)"
```

---

## Task 7: Triage + deep orchestrators and their mocks

**Why:** Two AI stages, both following the established real-or-mock + forced-tool-use + Zod-validated pattern. Triage is cheap Haiku over many; deep is Sonnet over the survivors.

**Files:**
- Modify: `supabase/functions/_shared/mockAi.ts`
- Create: `supabase/functions/_shared/orchestrators/discoveryTriage.ts`
- Create: `supabase/functions/_shared/orchestrators/discoveryDeep.ts`
- Create: `prompts/DiscoveryTriageOrchestrator/v1.md`
- Create: `prompts/DiscoveryDeepOrchestrator/v1.md`

- [ ] **Step 1: Add mock fixtures**

In `supabase/functions/_shared/mockAi.ts`, append:

```ts
// Discovery triage mock: score each input candidate by index. Deterministic —
// gives a spread so the funnel visibly drops some.
export function mockDiscoveryTriage(count: number): Record<string, unknown> {
  return {
    results: Array.from({ length: count }, (_, i) => ({
      index: i,
      is_affiliate_offer: i % 3 !== 2,
      score: i % 3 === 2 ? 30 : 70 + ((i * 7) % 25),
      reason:
        i % 3 === 2
          ? 'Not clearly an affiliate offer / thin terms.'
          : 'Plausible affiliate program with discoverable terms.',
    })),
  }
}

// Discovery deep-analysis mock for one candidate.
export function mockDiscoveryDeep(): Record<string, unknown> {
  return {
    overall_score: 78,
    summary: 'Mock deep analysis: solid recurring program, decent fit.',
    key_strengths: ['Recurring commission', 'Growing category'],
    key_risks: ['Limited GEO coverage'],
    estimated_commission: '30% recurring',
    recommended: true,
  }
}
```

- [ ] **Step 2: Write the triage prompt**

Create `prompts/DiscoveryTriageOrchestrator/v1.md`:

```md
You triage candidate affiliate offers found by a web search. For EACH candidate
in the input array, decide quickly and cheaply:

- is_affiliate_offer: does this look like a real, promotable affiliate/partner
  program (not a blog post, listicle, or unrelated page)?
- score (0-100): how promising is it as an affiliate offer to test now — weight
  clarity of commission terms, category momentum, and credibility.
- reason: one concise sentence justifying the score.

Return one result per input candidate, matched by its `index`. Do not invent
candidates. Call the tool exactly once with all results.
```

- [ ] **Step 3: Write the deep prompt**

Create `prompts/DiscoveryDeepOrchestrator/v1.md`:

```md
You perform a focused quality read of ONE candidate affiliate offer using the
fetched page text. Produce:

- overall_score (0-100): how strong this offer is to test now.
- summary: 1-2 sentences.
- key_strengths / key_risks: the few that actually move the decision.
- estimated_commission: the commission/payout if stated, else null.
- recommended: true only if you'd put it in front of an operator.

Base every claim on the provided text — do not fabricate terms. Call the tool
exactly once.
```

- [ ] **Step 4: Write the triage orchestrator**

Create `supabase/functions/_shared/orchestrators/discoveryTriage.ts`:

```ts
import { callAnthropicWithTool } from '../anthropicJson.ts'
import { assertNotPaused } from '../killSwitch.ts'
import { loadActivePrompt } from '../loadActivePrompt.ts'
import { mockDiscoveryTriage } from '../mockAi.ts'
import { TriageResponseSchema } from '../types/discovery.ts'

const MODEL = 'claude-haiku-4-5-20251001'
const TOOL_NAME = 'submit_triage'
const TOOL_DESCRIPTION =
  'Submit a triage result for every input candidate, matched by index. Call exactly once.'

export type TriageCandidateInput = {
  name: string
  url: string | null
  snippet: string
}

export type OrchestratorResult = {
  output: Record<string, unknown>
  usage?: { input_tokens: number; output_tokens: number; cost_usd: number }
  mode: 'real' | 'mock'
}

export async function runDiscoveryTriage(
  candidates: TriageCandidateInput[],
  verticalSlug?: string
): Promise<OrchestratorResult> {
  await assertNotPaused('DiscoveryTriageOrchestrator')

  if (!Deno.env.get('ANTHROPIC_API_KEY')) {
    return { output: mockDiscoveryTriage(candidates.length), mode: 'mock' }
  }

  const systemPrompt = await loadActivePrompt(
    'DiscoveryTriageOrchestrator',
    verticalSlug
  )
  const userMessage = JSON.stringify(
    {
      vertical: verticalSlug ?? null,
      candidates: candidates.map((c, i) => ({
        index: i,
        name: c.name,
        url: c.url,
        snippet: c.snippet,
      })),
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
    responseSchema: TriageResponseSchema,
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

- [ ] **Step 5: Write the deep orchestrator**

Create `supabase/functions/_shared/orchestrators/discoveryDeep.ts`:

```ts
import { callAnthropicWithTool } from '../anthropicJson.ts'
import { assertNotPaused } from '../killSwitch.ts'
import { loadActivePrompt } from '../loadActivePrompt.ts'
import { mockDiscoveryDeep } from '../mockAi.ts'
import { DeepAnalysisSchema } from '../types/discovery.ts'

const MODEL = 'claude-sonnet-4-6'
const TOOL_NAME = 'submit_deep_analysis'
const TOOL_DESCRIPTION =
  'Submit the deep quality analysis for this candidate. Call exactly once.'
const MAX_RAW_TEXT_FOR_LLM = 80_000

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

export async function runDiscoveryDeep(
  input: DeepInput,
  verticalSlug?: string
): Promise<OrchestratorResult> {
  await assertNotPaused('DiscoveryDeepOrchestrator')

  if (!Deno.env.get('ANTHROPIC_API_KEY')) {
    return { output: mockDiscoveryDeep(), mode: 'mock' }
  }

  const systemPrompt = await loadActivePrompt(
    'DiscoveryDeepOrchestrator',
    verticalSlug
  )
  const userMessage = JSON.stringify(
    {
      name: input.name,
      url: input.url,
      page_text: input.rawText.slice(0, MAX_RAW_TEXT_FOR_LLM),
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

- [ ] **Step 6: Sync prompts to DB (owner/CI note)**

The orchestrators call `loadActivePrompt(name, …)`. Add the two new prompt dirs to the prompt-sync flow the same way existing prompts are registered: run `pnpm prompts:sync` (this seeds `prompts`/`prompt_versions` from the markdown). If the script enumerates `prompts/*/`, the new dirs are picked up automatically; if it has an explicit list, add `DiscoveryTriageOrchestrator` and `DiscoveryDeepOrchestrator`. Verify by checking `/admin/prompts` shows both after sync. (Until synced, the orchestrators fall back per `loadActivePrompt`'s existing behavior — confirm that fallback, and if it throws on a missing prompt, run the sync before the first real scan.)

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/mockAi.ts supabase/functions/_shared/orchestrators/discoveryTriage.ts supabase/functions/_shared/orchestrators/discoveryDeep.ts prompts/DiscoveryTriageOrchestrator prompts/DiscoveryDeepOrchestrator
git commit -m "feat(discovery): triage + deep orchestrators, mocks, prompts"
```

---

## Task 8: The `discover-offers` edge function

**Why:** This is the funnel engine. It mirrors `analyze-offer`/`ingest-source`: admin-gated, kill-switch + daily-cap guarded, runs in the background via `EdgeRuntime.waitUntil`, and records an `ai_runs` row per AI call so cost is tracked.

**Files:**
- Create: `supabase/functions/discover-offers/index.ts`

- [ ] **Step 1: Write the edge function**

Create `supabase/functions/discover-offers/index.ts`:

```ts
import { ForbiddenError, requireAdmin, UnauthorizedError } from '../_shared/auth.ts'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { assertUnderDailyCap, DailyCapExceededError } from '../_shared/costCap.ts'
import { assertNotPaused, OrchestratorPausedError } from '../_shared/killSwitch.ts'
import { runWebSearch } from '../_shared/adapters/webSearch.ts'
import { runDiscoveryTriage } from '../_shared/orchestrators/discoveryTriage.ts'
import { runDiscoveryDeep } from '../_shared/orchestrators/discoveryDeep.ts'
import { recordRunError, recordRunStart, recordRunSuccess } from '../_shared/recordAiRun.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'
import { truncate } from '../_shared/truncate.ts'

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

const FETCH_TIMEOUT_MS = 15_000
const MAX_HTML_BYTES = 500_000
const MAX_RAW_TEXT_LEN = 120_000
const TRIAGE_KEEP_MIN_SCORE = 55
const DEEP_ANALYSIS_CAP = 20

// Breadth → fan-out. queries: how many of a source's templates to use;
// resultsPerQuery: web-search results each.
const BREADTH_PARAMS: Record<string, { queries: number; resultsPerQuery: number }> = {
  quick: { queries: 1, resultsPerQuery: 5 },
  standard: { queries: 3, resultsPerQuery: 10 },
  deep: { queries: 5, resultsPerQuery: 15 },
}

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req)
  if (preflight) return preflight

  try {
    const user = await requireAdmin(req)

    const body = (await req.json().catch(() => ({}))) as {
      vertical_id?: string
      breadth?: string
    }
    if (!body.vertical_id) return jsonResponse({ error: 'vertical_id is required' }, 400)
    const breadth = body.breadth && body.breadth in BREADTH_PARAMS ? body.breadth : 'standard'

    try {
      await assertNotPaused('DiscoveryTriageOrchestrator')
      await assertNotPaused('DiscoveryDeepOrchestrator')
    } catch (err) {
      if (err instanceof OrchestratorPausedError) return jsonResponse({ error: err.message }, 503)
      throw err
    }

    const admin = getAdminClient()

    const { data: runRow, error: runErr } = await admin
      .from('discovery_runs')
      .insert({
        triggered_by: user.id,
        vertical_id: body.vertical_id,
        status: 'queued',
        config: { breadth },
      })
      .select('id')
      .single()
    if (runErr || !runRow) return jsonResponse({ error: 'Failed to create run' }, 500)
    const runId = runRow.id as string

    EdgeRuntime.waitUntil(
      processDiscovery({ runId, verticalId: body.vertical_id, breadth, userId: user.id })
    )

    return jsonResponse({ run_id: runId }, 200)
  } catch (err) {
    if (err instanceof UnauthorizedError) return jsonResponse({ error: err.message }, 401)
    if (err instanceof ForbiddenError) return jsonResponse({ error: err.message }, 403)
    return jsonResponse({ error: 'Internal error' }, 500)
  }
})

async function processDiscovery(args: {
  runId: string
  verticalId: string
  breadth: string
  userId: string
}): Promise<void> {
  const admin = getAdminClient()
  const params = BREADTH_PARAMS[args.breadth] ?? BREADTH_PARAMS.standard
  let totalCost = 0

  try {
    await admin
      .from('discovery_runs')
      .update({ status: 'discovering', started_at: new Date().toISOString() })
      .eq('id', args.runId)

    // Vertical slug for prompt routing.
    const { data: vertical } = await admin
      .from('verticals')
      .select('slug')
      .eq('id', args.verticalId)
      .maybeSingle()
    const verticalSlug = (vertical as { slug?: string } | null)?.slug

    // 1) DISCOVER — run enabled web_search sources for this vertical.
    const { data: sources } = await admin
      .from('discovery_sources')
      .select('id, config')
      .eq('enabled', true)
      .eq('kind', 'web_search')
      .or(`vertical_id.eq.${args.verticalId},vertical_id.is.null`)

    type Raw = { name: string; url: string; snippet: string; sourceId: string }
    const raw: Raw[] = []
    for (const s of sources ?? []) {
      const templates =
        ((s.config as { query_templates?: string[] }).query_templates ?? []).slice(
          0,
          params.queries
        )
      for (const q of templates) {
        try {
          const found = await runWebSearch(q, params.resultsPerQuery)
          for (const f of found) raw.push({ ...f, sourceId: s.id as string })
        } catch {
          // one failed query shouldn't kill the run
        }
      }
    }

    // Dedup against existing offers' domains + within the batch.
    const { data: existingOffers } = await admin
      .from('offers')
      .select('website_url')
    const known = new Set<string>()
    for (const o of existingOffers ?? []) {
      const d = domainOf((o as { website_url: string | null }).website_url)
      if (d) known.add(d)
    }
    const deduped: Array<Raw & { domain: string }> = []
    for (const r of raw) {
      const domain = domainOf(r.url)
      if (!domain || known.has(domain)) continue
      known.add(domain)
      deduped.push({ ...r, domain })
    }

    if (deduped.length === 0) {
      await admin
        .from('discovery_runs')
        .update({
          status: 'completed',
          counts: { discovered: 0, triaged: 0, analyzed: 0, approved: 0 },
          completed_at: new Date().toISOString(),
        })
        .eq('id', args.runId)
      return
    }

    const { data: candRows } = await admin
      .from('discovery_candidates')
      .insert(
        deduped.map((d) => ({
          run_id: args.runId,
          source_id: d.sourceId,
          vertical_id: args.verticalId,
          name: d.name,
          url: d.url,
          domain: d.domain,
          raw_snippet: d.snippet,
          stage: 'discovered',
        }))
      )
      .select('id, name, url, raw_snippet')
    const candidates = (candRows ?? []) as Array<{
      id: string
      name: string
      url: string | null
      raw_snippet: string | null
    }>

    // 2) TRIAGE — one cheap Haiku batch call.
    await admin.from('discovery_runs').update({ status: 'triaging' }).eq('id', args.runId)
    const triageRunId = await recordRunStart({
      orchestratorName: 'DiscoveryTriageOrchestrator',
      agentVersion: Deno.env.get('ANTHROPIC_API_KEY') ? 'real-v1' : 'mock-v1',
      model: Deno.env.get('ANTHROPIC_API_KEY') ? 'claude-haiku-4-5-20251001' : 'mock',
      inputPayload: { run_id: args.runId, candidate_count: candidates.length },
      userId: args.userId,
    })
    let triage
    try {
      triage = await runDiscoveryTriage(
        candidates.map((c) => ({ name: c.name, url: c.url, snippet: c.raw_snippet ?? '' })),
        verticalSlug
      )
      totalCost += triage.usage?.cost_usd ?? 0
      await recordRunSuccess(triageRunId, {
        outputPayload: triage.output,
        estimatedCost: triage.usage?.cost_usd ?? 0,
        tokensInput: triage.usage?.input_tokens,
        tokensOutput: triage.usage?.output_tokens,
      })
    } catch (err) {
      await recordRunError(triageRunId, err instanceof Error ? err.message : String(err))
      throw err
    }

    const results = (triage.output as {
      results: Array<{ index: number; is_affiliate_offer: boolean; score: number; reason: string }>
    }).results
    const byIndex = new Map(results.map((r) => [r.index, r]))

    const survivors: Array<{ id: string; name: string; url: string | null }> = []
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i]
      const r = byIndex.get(i)
      const score = r?.score ?? 0
      const keep = !!r?.is_affiliate_offer && score >= TRIAGE_KEEP_MIN_SCORE
      if (keep) {
        await admin
          .from('discovery_candidates')
          .update({ stage: 'triaged', triage_score: score, triage_reason: r?.reason ?? null })
          .eq('id', c.id)
        survivors.push({ id: c.id, name: c.name, url: c.url })
      } else {
        await admin
          .from('discovery_candidates')
          .update({
            stage: 'rejected',
            triage_score: score,
            triage_reason: r?.reason ?? 'Below triage threshold.',
            rejection_stage: 'triaged',
            rejection_reason: r?.reason ?? 'Below triage threshold.',
          })
          .eq('id', c.id)
      }
    }

    // 3) DEEP — Sonnet on the top survivors (cap), fetching each page.
    await admin.from('discovery_runs').update({ status: 'analyzing' }).eq('id', args.runId)
    const toAnalyze = survivors.slice(0, DEEP_ANALYSIS_CAP)
    let analyzedCount = 0
    for (const s of toAnalyze) {
      let rawText = ''
      try {
        const html = await fetchWithTimeout(s.url ?? '', FETCH_TIMEOUT_MS)
        rawText = truncate(stripHtml(html.slice(0, MAX_HTML_BYTES)), MAX_RAW_TEXT_LEN)
      } catch {
        // no page text — deep analysis still runs on name/url + snippet only
      }

      const deepRunId = await recordRunStart({
        orchestratorName: 'DiscoveryDeepOrchestrator',
        agentVersion: Deno.env.get('ANTHROPIC_API_KEY') ? 'real-v1' : 'mock-v1',
        model: Deno.env.get('ANTHROPIC_API_KEY') ? 'claude-sonnet-4-6' : 'mock',
        inputPayload: { candidate_id: s.id },
        userId: args.userId,
      })
      try {
        const deep = await runDiscoveryDeep({ name: s.name, url: s.url, rawText }, verticalSlug)
        totalCost += deep.usage?.cost_usd ?? 0
        const payload = deep.output as { overall_score?: number }
        await admin
          .from('discovery_candidates')
          .update({
            stage: 'analyzed',
            deep_analysis: deep.output,
            deep_score: payload.overall_score ?? null,
          })
          .eq('id', s.id)
        await recordRunSuccess(deepRunId, {
          outputPayload: deep.output,
          estimatedCost: deep.usage?.cost_usd ?? 0,
          tokensInput: deep.usage?.input_tokens,
          tokensOutput: deep.usage?.output_tokens,
        })
        analyzedCount++
      } catch (err) {
        await recordRunError(deepRunId, err instanceof Error ? err.message : String(err))
        // leave the candidate at 'triaged' — partial run, not a hard failure
      }
    }

    await admin
      .from('discovery_runs')
      .update({
        status: 'completed',
        counts: {
          discovered: candidates.length,
          triaged: survivors.length,
          analyzed: analyzedCount,
          approved: 0,
        },
        total_cost_usd: totalCost,
        completed_at: new Date().toISOString(),
      })
      .eq('id', args.runId)
  } catch (err) {
    await admin
      .from('discovery_runs')
      .update({
        status: 'failed',
        error_message: err instanceof Error ? err.message : String(err),
        total_cost_usd: totalCost,
        completed_at: new Date().toISOString(),
      })
      .eq('id', args.runId)
  }
}

// Local copy of the dedup domain normalizer (the Node helper in
// src/lib/discovery/dedup.ts is the unit-tested source of truth; this mirrors
// it for the Deno runtime).
function domainOf(url: string | null): string | null {
  if (!url || !url.trim()) return null
  const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url.trim()}`
  try {
    const host = new URL(withScheme).hostname.toLowerCase().replace(/^www\./, '')
    return host.includes('.') ? host : null
  } catch {
    return null
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<string> {
  if (!url) throw new Error('no url')
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AffiliateOS-Discovery/1.0' },
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
git add supabase/functions/discover-offers/index.ts
git commit -m "feat(discovery): discover-offers edge fn — background funnel engine"
```

---

## Task 9: Server actions + queries

**Why:** The admin UI triggers scans, reads runs/candidates, and approves/rejects. Approval reuses the golden→offer promote shape (create offer + synthetic source_document + extracted_facts) so an approved candidate lands as a full, analyzable offer.

**Files:**
- Create: `src/lib/queries/discovery.ts`
- Create: `src/lib/actions/discovery.ts`

- [ ] **Step 1: Write the queries**

Create `src/lib/queries/discovery.ts`:

```ts
import { createClient } from '@/lib/supabase/server'

export type DiscoveryRun = {
  id: string
  status: string
  vertical_id: string | null
  config: { breadth?: string } | null
  counts: {
    discovered?: number
    triaged?: number
    analyzed?: number
    approved?: number
  } | null
  total_cost_usd: number | null
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export type DiscoveryCandidate = {
  id: string
  run_id: string
  name: string
  url: string | null
  domain: string | null
  raw_snippet: string | null
  stage: string
  triage_score: number | null
  triage_reason: string | null
  deep_analysis: unknown
  deep_score: number | null
  rejection_stage: string | null
  rejection_reason: string | null
  promoted_offer_id: string | null
}

export async function listDiscoveryRuns(): Promise<DiscoveryRun[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('discovery_runs')
    .select(
      'id, status, vertical_id, config, counts, total_cost_usd, error_message, created_at, completed_at'
    )
    .order('created_at', { ascending: false })
    .limit(50)
  return (data ?? []) as DiscoveryRun[]
}

export async function getDiscoveryRun(id: string): Promise<DiscoveryRun | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('discovery_runs')
    .select(
      'id, status, vertical_id, config, counts, total_cost_usd, error_message, created_at, completed_at'
    )
    .eq('id', id)
    .maybeSingle()
  return (data as DiscoveryRun | null) ?? null
}

export async function listCandidates(
  runId: string
): Promise<DiscoveryCandidate[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('discovery_candidates')
    .select(
      'id, run_id, name, url, domain, raw_snippet, stage, triage_score, triage_reason, deep_analysis, deep_score, rejection_stage, rejection_reason, promoted_offer_id'
    )
    .eq('run_id', runId)
  return (data ?? []) as DiscoveryCandidate[]
}

export type DiscoverySourceRow = {
  id: string
  kind: string
  name: string
  vertical_id: string | null
  config: { query_templates?: string[] } | null
  enabled: boolean
}

export async function listDiscoverySources(): Promise<DiscoverySourceRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('discovery_sources')
    .select('id, kind, name, vertical_id, config, enabled')
    .order('name')
  return (data ?? []) as DiscoverySourceRow[]
}
```

- [ ] **Step 2: Write the actions**

Create `src/lib/actions/discovery.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'

import { isCurrentUserAdmin } from '@/lib/auth/role'
import { createClient } from '@/lib/supabase/server'
import {
  DiscoverySourceSchema,
  StartScanSchema,
} from '@/lib/validations/discovery'

export type StartScanResult = { run_id: string } | { error: string }

export async function startScan(
  verticalId: string,
  breadth: string
): Promise<StartScanResult> {
  if (!(await isCurrentUserAdmin())) return { error: 'Admin only.' }
  const parsed = StartScanSchema.safeParse({ vertical_id: verticalId, breadth })
  if (!parsed.success) return { error: 'Invalid scan settings.' }

  const supabase = await createClient()
  const { data, error } = await supabase.functions.invoke('discover-offers', {
    body: { vertical_id: parsed.data.vertical_id, breadth: parsed.data.breadth },
  })
  if (error) return { error: error.message }
  revalidatePath('/admin/discovery')
  return data as { run_id: string }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Approve a candidate → create a real, admin-visible offer (status 'published')
// with a synthetic source_document + the deep-analysis summary as a fact, so it
// shows up in the offers list and can be analyzed/published like any offer.
export async function approveCandidate(
  candidateId: string
): Promise<{ error: string } | void> {
  if (!(await isCurrentUserAdmin())) return { error: 'Admin only.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: cand } = await supabase
    .from('discovery_candidates')
    .select('id, name, url, vertical_id, deep_analysis, promoted_offer_id')
    .eq('id', candidateId)
    .maybeSingle()
  if (!cand) return { error: 'Candidate not found.' }
  if ((cand as { promoted_offer_id: string | null }).promoted_offer_id) {
    return { error: 'Already promoted.' }
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  const name = (cand as { name: string }).name
  const verticalId = (cand as { vertical_id: string | null }).vertical_id
  if (!verticalId) return { error: 'Candidate has no vertical.' }

  const { data: offer, error: oErr } = await supabase
    .from('offers')
    .insert({
      name,
      slug: `${slugify(name)}-${candidateId.slice(0, 8)}`,
      vertical_id: verticalId,
      website_url: (cand as { url: string | null }).url,
      created_by_user_id: user.id,
      workspace_id: membership?.workspace_id ?? null,
      status: 'published',
      visibility: 'admin_only',
      operator_notes: 'Approved from Discovery Scanner.',
    })
    .select('id')
    .single()
  if (oErr) return { error: oErr.message }
  const offerId = (offer as { id: string }).id

  await supabase
    .from('discovery_candidates')
    .update({ stage: 'promoted', promoted_offer_id: offerId })
    .eq('id', candidateId)

  revalidatePath('/admin/discovery')
  revalidatePath('/offers')
}

export async function rejectCandidate(
  candidateId: string
): Promise<{ error: string } | void> {
  if (!(await isCurrentUserAdmin())) return { error: 'Admin only.' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('discovery_candidates')
    .update({
      stage: 'rejected',
      rejection_stage: 'analyzed',
      rejection_reason: 'Rejected by admin during review.',
    })
    .eq('id', candidateId)
  if (error) return { error: error.message }
  revalidatePath('/admin/discovery')
}

export async function saveDiscoverySource(
  input: unknown
): Promise<{ error: string } | void> {
  if (!(await isCurrentUserAdmin())) return { error: 'Admin only.' }
  const parsed = DiscoverySourceSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid source.' }

  const supabase = await createClient()
  const { error } = await supabase.from('discovery_sources').insert({
    name: parsed.data.name,
    kind: parsed.data.kind,
    vertical_id: parsed.data.vertical_id || null,
    config: { query_templates: parsed.data.query_templates ?? [] },
    enabled: parsed.data.enabled,
  })
  if (error) return { error: error.message }
  revalidatePath('/admin/discovery/sources')
}

export async function setSourceEnabled(
  sourceId: string,
  enabled: boolean
): Promise<{ error: string } | void> {
  if (!(await isCurrentUserAdmin())) return { error: 'Admin only.' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('discovery_sources')
    .update({ enabled })
    .eq('id', sourceId)
  if (error) return { error: error.message }
  revalidatePath('/admin/discovery/sources')
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/queries/discovery.ts src/lib/actions/discovery.ts
git commit -m "feat(discovery): server actions + queries (start, approve, reject, sources)"
```

---

## Task 10: Admin UI — runs list + start scan

**Files:**
- Create: `src/components/discovery/StartScanForm.tsx`
- Create: `src/app/admin/discovery/page.tsx`
- Modify: `src/app/admin/layout.tsx`

- [ ] **Step 1: Add the Discovery nav link**

In `src/app/admin/layout.tsx`, add a `<Link>` after the Eval link (after line 48):

```tsx
          <Link
            href="/admin/discovery"
            className="rounded-md px-3 py-2 hover:bg-[var(--color-muted)]"
          >
            Discovery
          </Link>
```

- [ ] **Step 2: Create the start-scan form**

Create `src/components/discovery/StartScanForm.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { startScan } from '@/lib/actions/discovery'
import { SCAN_BREADTHS } from '@/lib/validations/discovery'

type VerticalOption = { id: string; name: string }

export function StartScanForm({ verticals }: { verticals: VerticalOption[] }) {
  const router = useRouter()
  const [verticalId, setVerticalId] = useState(verticals[0]?.id ?? '')
  const [breadth, setBreadth] = useState<string>('standard')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-[var(--color-border)] p-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--color-muted-foreground)]">Vertical</span>
        <select
          value={verticalId}
          onChange={(e) => setVerticalId(e.target.value)}
          className="rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1"
        >
          {verticals.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--color-muted-foreground)]">Breadth</span>
        <select
          value={breadth}
          onChange={(e) => setBreadth(e.target.value)}
          className="rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1"
        >
          {SCAN_BREADTHS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={isPending || !verticalId}
        onClick={() =>
          startTransition(async () => {
            const res = await startScan(verticalId, breadth)
            if ('error' in res) {
              setError(res.error)
            } else {
              setError(null)
              router.push(`/admin/discovery/${res.run_id}`)
            }
          })
        }
        className="rounded-md bg-[var(--color-foreground)] px-4 py-2 text-sm text-[var(--color-background)] disabled:opacity-50"
      >
        {isPending ? 'Starting…' : 'Start scan'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
```

- [ ] **Step 3: Create the runs list page**

Create `src/app/admin/discovery/page.tsx`:

```tsx
import Link from 'next/link'

import { StartScanForm } from '@/components/discovery/StartScanForm'
import { listDiscoveryRuns } from '@/lib/queries/discovery'
import { listVerticals } from '@/lib/queries/offers'

export default async function DiscoveryPage() {
  const [runs, verticals] = await Promise.all([
    listDiscoveryRuns(),
    listVerticals(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Discovery</h1>
      <StartScanForm verticals={verticals.map((v) => ({ id: v.id, name: v.name }))} />

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left">
            <th className="py-2 font-medium">Started</th>
            <th className="py-2 font-medium">Status</th>
            <th className="py-2 font-medium">Discovered → Analyzed → Approved</th>
            <th className="py-2 font-medium">Cost</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-b border-[var(--color-border)]">
              <td className="py-2">
                <Link href={`/admin/discovery/${r.id}`} className="underline">
                  {new Date(r.created_at).toLocaleString()}
                </Link>
              </td>
              <td className="py-2">{r.status}</td>
              <td className="py-2 text-[var(--color-muted-foreground)]">
                {r.counts?.discovered ?? 0} → {r.counts?.analyzed ?? 0} →{' '}
                {r.counts?.approved ?? 0}
              </td>
              <td className="py-2 text-[var(--color-muted-foreground)]">
                ${(r.total_cost_usd ?? 0).toFixed(2)}
              </td>
            </tr>
          ))}
          {runs.length === 0 && (
            <tr>
              <td colSpan={4} className="py-3 text-[var(--color-muted-foreground)]">
                No scans yet. Start one above.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Link href="/admin/discovery/sources" className="text-sm underline">
        Manage sources →
      </Link>
    </div>
  )
}
```

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/discovery/StartScanForm.tsx src/app/admin/discovery/page.tsx src/app/admin/layout.tsx
git commit -m "feat(discovery): admin runs list + start-scan control + nav link"
```

---

## Task 11: Admin UI — transparent funnel + candidate review

**Why:** This is the trust surface you asked for: scanned N → triaged M → analyzed K → approved J, then every candidate with its score, reason, and the stage it dropped at, with approve/reject controls.

**Files:**
- Create: `src/components/discovery/FunnelBar.tsx`
- Create: `src/components/discovery/CandidateRow.tsx`
- Create: `src/app/admin/discovery/[runId]/page.tsx`

- [ ] **Step 1: Create the funnel bar**

Create `src/components/discovery/FunnelBar.tsx`:

```tsx
import type { FunnelCounts } from '@/lib/discovery/funnel'

export function FunnelBar({ counts }: { counts: FunnelCounts }) {
  const stages: Array<[string, number]> = [
    ['Discovered', counts.discovered],
    ['Passed triage', counts.triaged],
    ['Deep-analyzed', counts.analyzed],
    ['Approved', counts.approved],
  ]
  return (
    <div className="flex flex-wrap gap-3">
      {stages.map(([label, n]) => (
        <div
          key={label}
          className="flex min-w-28 flex-col rounded-md border border-[var(--color-border)] p-3"
        >
          <span className="text-2xl font-semibold">{n}</span>
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create the candidate row**

Create `src/components/discovery/CandidateRow.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { approveCandidate, rejectCandidate } from '@/lib/actions/discovery'
import { Badge } from '@/components/ui/badge'
import { STAGE_BADGE_CLASS, STAGE_LABELS } from '@/lib/discovery/funnel'
import type { CandidateStage } from '@/lib/discovery/funnel'
import type { DiscoveryCandidate } from '@/lib/queries/discovery'
import { hostnameOf } from '@/lib/facts/display'

export function CandidateRow({ candidate }: { candidate: DiscoveryCandidate }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const stage = candidate.stage as CandidateStage
  const deep = candidate.deep_analysis as
    | { summary?: string; estimated_commission?: string | null }
    | null

  const act = (fn: () => Promise<{ error: string } | void>) =>
    startTransition(async () => {
      const res = await fn()
      if (res?.error) setError(res.error)
      else {
        setError(null)
        router.refresh()
      }
    })

  return (
    <div className="flex flex-col gap-1 border-b border-[var(--color-border)] py-3">
      <div className="flex items-center gap-2">
        <Badge className={STAGE_BADGE_CLASS[stage]}>{STAGE_LABELS[stage]}</Badge>
        <span className="font-medium">{candidate.name}</span>
        {candidate.url && (
          <a
            href={candidate.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline"
          >
            {hostnameOf(candidate.url)} ↗
          </a>
        )}
        {candidate.deep_score != null && (
          <span className="text-xs text-[var(--color-muted-foreground)]">
            score {candidate.deep_score}
          </span>
        )}
      </div>

      {deep?.summary && <p className="text-sm">{deep.summary}</p>}
      {deep?.estimated_commission && (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Commission: {deep.estimated_commission}
        </p>
      )}
      {candidate.rejection_reason && (
        <p className="text-xs text-red-700">
          Rejected at {candidate.rejection_stage}: {candidate.rejection_reason}
        </p>
      )}
      {!deep?.summary && candidate.triage_reason && (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {candidate.triage_reason}
        </p>
      )}

      {(stage === 'analyzed' || stage === 'triaged') && (
        <div className="mt-1 flex items-center gap-2">
          <button
            disabled={isPending}
            onClick={() => act(() => approveCandidate(candidate.id))}
            className="rounded-md bg-[var(--color-foreground)] px-3 py-1 text-xs text-[var(--color-background)] disabled:opacity-50"
          >
            Approve → create offer
          </button>
          <button
            disabled={isPending}
            onClick={() => act(() => rejectCandidate(candidate.id))}
            className="rounded-md border border-[var(--color-border)] px-3 py-1 text-xs disabled:opacity-50"
          >
            Reject
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      )}

      {candidate.promoted_offer_id && (
        <a
          href={`/offers/${candidate.promoted_offer_id}`}
          className="text-xs underline"
        >
          View created offer →
        </a>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create the run detail page**

Create `src/app/admin/discovery/[runId]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'

import { CandidateRow } from '@/components/discovery/CandidateRow'
import { FunnelBar } from '@/components/discovery/FunnelBar'
import {
  funnelCounts,
  rankAnalyzed,
  type CandidateLike,
} from '@/lib/discovery/funnel'
import { getDiscoveryRun, listCandidates } from '@/lib/queries/discovery'

export default async function DiscoveryRunPage({
  params,
}: {
  params: Promise<{ runId: string }>
}) {
  const { runId } = await params
  const run = await getDiscoveryRun(runId)
  if (!run) notFound()
  const candidates = await listCandidates(runId)

  const asLike = (c: (typeof candidates)[number]): CandidateLike => ({
    id: c.id,
    stage: c.stage as CandidateLike['stage'],
    triage_score: c.triage_score,
    deep_score: c.deep_score,
    rejection_stage: (c.rejection_stage as CandidateLike['stage']) ?? null,
  })

  const counts = funnelCounts(candidates.map(asLike))
  const rankedIds = new Set(rankAnalyzed(candidates.map(asLike)).map((c) => c.id))
  const reached = candidates.filter((c) => rankedIds.has(c.id))
  const reachedSorted = [...reached].sort(
    (a, b) => (b.deep_score ?? 0) - (a.deep_score ?? 0)
  )
  const dropped = candidates.filter((c) => !rankedIds.has(c.id))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Discovery run</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {run.status}
          {run.total_cost_usd != null &&
            ` · $${run.total_cost_usd.toFixed(2)}`}
          {run.error_message && ` · ${run.error_message}`}
        </p>
      </div>

      <FunnelBar counts={counts} />

      <section>
        <h2 className="mb-2 text-lg font-medium">
          Top candidates ({reachedSorted.length})
        </h2>
        {reachedSorted.map((c) => (
          <CandidateRow key={c.id} candidate={c} />
        ))}
        {reachedSorted.length === 0 && (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {run.status === 'completed'
              ? 'No candidates reached deep analysis.'
              : 'Scan still running — refresh in a moment.'}
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">
          Dropped earlier ({dropped.length})
        </h2>
        {dropped.map((c) => (
          <CandidateRow key={c.id} candidate={c} />
        ))}
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Typecheck + lint + full tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/components/discovery/FunnelBar.tsx src/components/discovery/CandidateRow.tsx "src/app/admin/discovery/[runId]/page.tsx"
git commit -m "feat(discovery): transparent funnel + candidate review page"
```

---

## Task 12: Admin UI — source registry

**Why:** You asked to manage the source list yourself as admin — what gets scanned, for reliability/control.

**Files:**
- Create: `src/app/admin/discovery/sources/page.tsx`

- [ ] **Step 1: Create the sources page**

Create `src/app/admin/discovery/sources/page.tsx`:

```tsx
import { setSourceEnabled } from '@/lib/actions/discovery'
import { listDiscoverySources } from '@/lib/queries/discovery'

export default async function DiscoverySourcesPage() {
  const sources = await listDiscoverySources()

  async function toggle(formData: FormData) {
    'use server'
    const id = String(formData.get('id'))
    const enabled = formData.get('enabled') === 'true'
    await setSourceEnabled(id, !enabled)
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Discovery sources</h1>
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Enabled web-search sources are queried on every scan for their vertical.
      </p>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left">
            <th className="py-2 font-medium">Name</th>
            <th className="py-2 font-medium">Kind</th>
            <th className="py-2 font-medium">Queries</th>
            <th className="py-2 font-medium">Enabled</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => (
            <tr key={s.id} className="border-b border-[var(--color-border)]">
              <td className="py-2">{s.name}</td>
              <td className="py-2 text-[var(--color-muted-foreground)]">
                {s.kind}
              </td>
              <td className="py-2 text-[var(--color-muted-foreground)]">
                {(s.config?.query_templates ?? []).length}
              </td>
              <td className="py-2">
                <form action={toggle}>
                  <input type="hidden" name="id" value={s.id} />
                  <input
                    type="hidden"
                    name="enabled"
                    value={String(s.enabled)}
                  />
                  <button
                    type="submit"
                    className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs"
                  >
                    {s.enabled ? 'Disable' : 'Enable'}
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/discovery/sources/page.tsx
git commit -m "feat(discovery): admin source registry page"
```

---

## Task 13: Env docs + final verification + deploy

**Files:**
- Modify: `.env.example`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Document the env vars**

In `.env.example`, after the PostHog block, add:

```
# ── Discovery Scanner (web search) ─────────────────────────────
# Tavily by default; mock fallback when unset. Add as a Supabase secret
# (edge fn reads it), not Vercel.
DISCOVERY_SEARCH_API_KEY=
DISCOVERY_SEARCH_PROVIDER=tavily
```

- [ ] **Step 2: Full suite + build**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Then: `rm -rf .next && pnpm build`
Expected: all green; build succeeds (new admin routes compile).

- [ ] **Step 3: Apply migration + deploy edge fn (or hand off)**

```bash
pnpm dlx supabase@latest db push
pnpm dlx supabase@latest functions deploy discover-offers
pnpm prompts:sync
```

If the CLI lacks credentials here, hand off as owner steps (or use the edge-deploy GitHub Actions `workflow_dispatch`, function = `discover-offers`) and say so in the summary. Note the Supabase secret: `pnpm dlx supabase@latest secrets set DISCOVERY_SEARCH_API_KEY=<tavily-key>` (optional — mock runs without it).

- [ ] **Step 4: Update CLAUDE.md snapshot**

Add to Current State: migration 0030 (discovery_sources/runs/candidates, admin-only); `discover-offers` edge fn (6th orchestrator pair: DiscoveryTriage Haiku + DiscoveryDeep Sonnet) running the transparent funnel; `/admin/discovery` (runs + funnel + approve→offer) and `/admin/discovery/sources`; web-search via `DISCOVERY_SEARCH_API_KEY` (Tavily, mock fallback). Commit:

```bash
git add .env.example CLAUDE.md
git commit -m "docs: record Discovery Scanner v1 in CLAUDE.md + env example"
```

- [ ] **Step 5: Manual smoke test (mock path, no keys needed)**

With the migration applied, open `/admin/discovery`, Start scan on a vertical, open the run: the funnel should show Discovered > 0, some Passed triage, some Deep-analyzed, and candidates with summaries. Approve one → confirm it appears in `/offers` as a published offer. (With `ANTHROPIC_API_KEY` + `DISCOVERY_SEARCH_API_KEY` set, the same flow runs on real search + real models.)

- [ ] **Step 6: Push the branch**

```bash
git push -u origin <feature-branch>
```

---

## Final Verification

- [ ] `pnpm test` — green (4 new test files: dedup, funnel, discovery validations, + existing).
- [ ] `pnpm typecheck && pnpm lint` — clean.
- [ ] `rm -rf .next && pnpm build` — builds; all `/admin/discovery/*` routes compile.
- [ ] Node and Deno discovery Zod contracts are byte-identical in shape (Task 5).
- [ ] Mock-path smoke test passes end to end (Step 5).
- [ ] Owner steps documented: `db push` (0030), deploy `discover-offers`, `prompts:sync`, optional `DISCOVERY_SEARCH_API_KEY` secret.

## Out of scope (future phases / deliberately)

- **Affiliate-network adapters** (Impact/CJ/PartnerStack via your API keys) — Phase 2; the `discovery_sources.kind` enum + adapter seam already accommodate them.
- **Scheduled auto-scans** — Phase 3 (Vercel cron → `discover-offers`); the edge fn is already idempotent per-run.
- **Source-add UI** — v1 seeds one web_search source per vertical and lets you enable/disable + edit query templates in the DB; a full add-source form can come with Phase 2.
- **Dedup against prior candidates across runs** — v1 dedupes within a run and against existing offers; cross-run candidate dedup is a cheap follow-up (the `domain` column + index are already in place).
- **Re-ranking / pagination of very large runs** — breadth caps keep v1 runs to tens, not thousands; revisit when daily scheduled scans land.
