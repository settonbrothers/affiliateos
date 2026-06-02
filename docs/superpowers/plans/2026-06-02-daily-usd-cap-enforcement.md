# Daily USD Cap Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce a per-workspace **daily USD spend cap** before each paid Anthropic call in `analyze-offer` and `ingest-source`, closing M2 DoD item 6 and M3 DoD item 10.

**Architecture:** A new Deno `_shared/costCap.ts` module exposes `assertUnderDailyCap(workspaceId)`, which reads the cap from `workspace_credit_caps` (default $10 if absent) and sums today's successful `ai_runs.estimated_cost` for that workspace. If spend ≥ cap it throws `DailyCapExceededError`, which each edge function maps to HTTP `429`. `ai_runs` is the single source of truth — no rollup table, no migration. Credits enforcement is out of scope (deferred to M5).

**Tech Stack:** Supabase Edge Functions (Deno), `@supabase/supabase-js` admin client, `jsr:@std/assert` for Deno tests.

**Design doc:** `docs/superpowers/specs/2026-06-02-daily-usd-cap-enforcement-design.md`

---

## Environment facts that shape verification

- `tsconfig.json` **excludes `supabase/`** → `pnpm typecheck` does NOT typecheck edge functions. Running it only proves the Next app still compiles (no `src/` changes here, so it is a sanity check, not real coverage of this work).
- CI (`.github/workflows/ci.yml`) runs typecheck/lint/test/build but **not** `deno test`. `deno` is **not installed** on this machine. So the Deno test below is written as an executable spec consistent with the existing `truncate.test.ts` / `langfuseClient.test.ts`, but will only run if `deno` is installed or added to CI.
- **Real verification of enforcement is the manual integration check in Task 4.** Do not claim the feature works on the strength of `pnpm build` alone.

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `supabase/functions/_shared/costCap.ts` | Cap config read + today's-spend sum + decision + error type | Create |
| `supabase/functions/_shared/costCap.test.ts` | Deno unit test for the pure `isOverDailyCap` predicate | Create |
| `supabase/functions/analyze-offer/index.ts` | Add cap guard after kill-switch, before `recordRunStart` | Modify (after line 43) |
| `supabase/functions/ingest-source/index.ts` | Add cap guard after kill-switch, before queueing the job | Modify (after line 47) |

No migrations. No `src/` changes. No new packages.

---

## Task 1: `costCap.ts` module + Deno test for the pure predicate

**Files:**
- Create: `supabase/functions/_shared/costCap.ts`
- Test: `supabase/functions/_shared/costCap.test.ts`

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/_shared/costCap.test.ts`:

```ts
import { assertEquals } from 'jsr:@std/assert'

import { isOverDailyCap } from './costCap.ts'

Deno.test('isOverDailyCap: under cap is allowed', () => {
  assertEquals(isOverDailyCap(3, 10), false)
  assertEquals(isOverDailyCap(0, 10), false)
})

Deno.test('isOverDailyCap: exactly at cap is blocked', () => {
  assertEquals(isOverDailyCap(10, 10), true)
})

Deno.test('isOverDailyCap: over cap is blocked', () => {
  assertEquals(isOverDailyCap(12.5, 10), true)
})

Deno.test('isOverDailyCap: cap of 0 blocks even at zero spend (M2 cap=0 case)', () => {
  assertEquals(isOverDailyCap(0, 0), true)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run (only if `deno` is installed): `deno test supabase/functions/_shared/costCap.test.ts`
Expected: FAIL — `Module not found "./costCap.ts"`.
If `deno` is not installed, skip running and treat the test file as the executable spec; proceed to Step 3.

- [ ] **Step 3: Write the module**

Create `supabase/functions/_shared/costCap.ts`:

```ts
import { getAdminClient } from './supabaseAdmin.ts'

// Default daily ceiling applied when a workspace has no workspace_credit_caps
// row. Mirrors the table default in migration 0015. Safe-by-default: an
// unconfigured workspace is still budget-protected.
export const DEFAULT_DAILY_USD_CAP = 10

// Thrown when a workspace has already spent at or above its daily USD cap.
// Edge functions translate this to a 429. Non-retryable until the next UTC day.
export class DailyCapExceededError extends Error {
  constructor(
    public readonly workspaceId: string,
    public readonly spentUsd: number,
    public readonly capUsd: number
  ) {
    super(
      `Daily AI budget reached for this workspace ($${spentUsd.toFixed(2)} spent / $${capUsd.toFixed(2)} cap). ` +
        `Try again tomorrow or contact an admin to raise the cap.`
    )
    this.name = 'DailyCapExceededError'
  }
}

// Pure decision: spend at or above the cap is blocked. A cap of 0 blocks
// immediately (0 >= 0), which is the M2 "admin sets cap=0" behavior.
export function isOverDailyCap(spentUsd: number, capUsd: number): boolean {
  return spentUsd >= capUsd
}

// Start of the current UTC day as an ISO timestamp, for the "today" window.
function startOfUtcDayIso(): string {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ).toISOString()
}

// Fail-fast guard. Reads the workspace's daily_usd_cap (default if absent),
// sums today's successful ai_runs.estimated_cost for the workspace, and throws
// DailyCapExceededError if the workspace is already at/over the cap.
export async function assertUnderDailyCap(workspaceId: string): Promise<void> {
  const admin = getAdminClient()

  const { data: capRow } = await admin
    .from('workspace_credit_caps')
    .select('daily_usd_cap')
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  // numeric columns can arrive as string; coerce defensively.
  const cap = Number(capRow?.daily_usd_cap ?? DEFAULT_DAILY_USD_CAP)

  const { data: runRows } = await admin
    .from('ai_runs')
    .select('estimated_cost')
    .eq('workspace_id', workspaceId)
    .eq('status', 'success')
    .gte('completed_at', startOfUtcDayIso())
  const spent = (runRows ?? []).reduce(
    (sum, r) => sum + Number((r as { estimated_cost: number | null }).estimated_cost ?? 0),
    0
  )

  if (isOverDailyCap(spent, cap)) {
    throw new DailyCapExceededError(workspaceId, spent, cap)
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run (only if `deno` is installed): `deno test supabase/functions/_shared/costCap.test.ts`
Expected: PASS — 4 tests ok.
If `deno` is not installed: re-read the test and the `isOverDailyCap` body and confirm by inspection that `spent >= cap` satisfies all four cases. (It does: 3<10→false, 0<10→false, 10≥10→true, 12.5≥10→true, 0≥0→true.)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/costCap.ts supabase/functions/_shared/costCap.test.ts
git commit -m "feat(m2/m3): add daily USD cap guard module (costCap.ts)"
```

---

## Task 2: Wire the guard into `analyze-offer`

**Files:**
- Modify: `supabase/functions/analyze-offer/index.ts`

- [ ] **Step 1: Add the import**

At the top of `supabase/functions/analyze-offer/index.ts`, add this import next to the existing `killSwitch` import (line 3):

```ts
import { assertUnderDailyCap, DailyCapExceededError } from '../_shared/costCap.ts'
```

- [ ] **Step 2: Insert the cap guard**

Immediately AFTER the existing kill-switch block (the `try { await assertNotPaused('UnderwritingOrchestrator') } catch ...` ending at line 43) and BEFORE the `const { data: factsRows }` query, insert:

```ts
    // Daily USD budget guard — fail fast before opening an ai_runs row.
    if (offer.workspace_id) {
      try {
        await assertUnderDailyCap(offer.workspace_id)
      } catch (err) {
        if (err instanceof DailyCapExceededError) return jsonResponse({ error: err.message }, 429)
        throw err
      }
    }
```

- [ ] **Step 3: Sanity-check the Next app still builds**

Run: `pnpm typecheck && pnpm build`
Expected: both PASS. (Note: this does NOT typecheck the edge file — `supabase/` is excluded — but confirms nothing in `src/` regressed.)

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/analyze-offer/index.ts
git commit -m "feat(m3): enforce daily USD cap in analyze-offer (429 when exceeded)"
```

---

## Task 3: Wire the guard into `ingest-source`

**Files:**
- Modify: `supabase/functions/ingest-source/index.ts`

- [ ] **Step 1: Add the import**

At the top of `supabase/functions/ingest-source/index.ts`, add next to the existing `killSwitch` import (line 3):

```ts
import { assertUnderDailyCap, DailyCapExceededError } from '../_shared/costCap.ts'
```

- [ ] **Step 2: Insert the cap guard**

Immediately AFTER the existing kill-switch block (the `try { await assertNotPaused('SourceExtractionOrchestrator') } catch ...` ending at line 47) and BEFORE the `const { data: jobRow, error: jobErr } = await admin.from('source_fetch_jobs')` insert (line 49), insert:

```ts
    // Daily USD budget guard — fail fast before queuing the ingestion job.
    if (offer.workspace_id) {
      try {
        await assertUnderDailyCap(offer.workspace_id)
      } catch (err) {
        if (err instanceof DailyCapExceededError) return jsonResponse({ error: err.message }, 429)
        throw err
      }
    }
```

- [ ] **Step 3: Sanity-check the Next app still builds**

Run: `pnpm typecheck && pnpm build`
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/ingest-source/index.ts
git commit -m "feat(m2): enforce daily USD cap in ingest-source (429 when exceeded)"
```

---

## Task 4: Manual integration verification (the real proof)

This is the gating verification — the unit test only covers the pure predicate. Requires the linked Supabase project (`affiliateos-prod`) and a deploy. Per CLAUDE.md, manual `functions deploy` is acceptable; note it in the PR.

- [ ] **Step 1: Deploy both functions**

```bash
pnpm dlx supabase@latest functions deploy analyze-offer
pnpm dlx supabase@latest functions deploy ingest-source
```
Expected: both deploy successfully.

- [ ] **Step 2: Pick a test workspace and set its cap to 0**

In the Supabase SQL editor (or `psql`), find a workspace id you own and force a block:

```sql
insert into workspace_credit_caps (workspace_id, daily_usd_cap)
values ('<YOUR_WORKSPACE_ID>', 0)
on conflict (workspace_id) do update set daily_usd_cap = 0, updated_at = now();
```

- [ ] **Step 2b: Confirm the block path**

Trigger an analyze for an offer in that workspace from the UI (`/offers/[id]` → Analyze) or via curl to the function with your auth token.
Expected: HTTP `429` and the JSON message `Daily AI budget reached for this workspace ($0.00 spent / $0.00 cap)...`. Repeat for an ingest from `/admin/offers/[id]/sources`.

- [ ] **Step 3: Confirm the allow path**

Raise the cap and confirm normal operation:

```sql
update workspace_credit_caps set daily_usd_cap = 10, updated_at = now()
where workspace_id = '<YOUR_WORKSPACE_ID>';
```
Trigger analyze again.
Expected: HTTP `200` with a `run_id`, run proceeds normally (Realtime updates the UI as before).

- [ ] **Step 4: (Optional) Confirm the accumulation path**

After one or more successful real runs (requires `ANTHROPIC_API_KEY` set on the function), set the cap just below today's accumulated spend:

```sql
-- inspect today's spend first:
select coalesce(sum(estimated_cost),0) from ai_runs
where workspace_id = '<YOUR_WORKSPACE_ID>' and status = 'success'
  and completed_at >= date_trunc('day', now() at time zone 'utc');
-- then set daily_usd_cap to a value at or below that sum and re-trigger analyze
```
Expected: HTTP `429`.

- [ ] **Step 5: Reset and record the result**

Reset the test workspace cap to a sane value (e.g. `10`), and record the observed behavior (429 on block, 200 on allow) in the PR description.

---

## Self-Review (completed by plan author)

- **Spec coverage:** module (`costCap.ts`) ✓ Task 1; `analyze-offer` guard ✓ Task 2; `ingest-source` guard ✓ Task 3; default $10 / cap=0 ✓ Task 1 code + Task 4 check; 429 clean error ✓ Tasks 2–3; derive-from-`ai_runs`, no migration, no rollup ✓ Task 1; `workspace_daily_usage` untouched ✓ (never referenced); credits deferred ✓ (not in any task). No spec requirement is unaddressed.
- **Placeholder scan:** no TBD/TODO; all code blocks are complete.
- **Type consistency:** `isOverDailyCap(spentUsd, capUsd)`, `assertUnderDailyCap(workspaceId)`, `DailyCapExceededError(workspaceId, spentUsd, capUsd)`, `DEFAULT_DAILY_USD_CAP` are named identically everywhere they appear (test, module, both edge functions).

## PR notes (for whoever opens the PR)

- Closes M2 DoD item 6 and M3 DoD item 10.
- Manual `functions deploy` performed for `analyze-offer` and `ingest-source` (no CI deploy job yet).
- Edge functions are not covered by CI (`deno test` not wired; `tsconfig` excludes `supabase/`). Enforcement verified manually per Task 4 — consider a follow-up to add `deno test` + `deno check` to CI.
