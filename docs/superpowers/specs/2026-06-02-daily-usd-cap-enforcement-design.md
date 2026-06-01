# Design: Daily USD Cap Enforcement

**Date:** 2026-06-02
**Branch:** `feat/m2m3-daily-usd-cap`
**Closes DoD gaps:** M2 item 6 (credit cap blocks analyze), M3 item 10 (user over daily USD cap → clean error)

## Problem

`workspace_credit_caps` (migration 0015) defines per-workspace spend ceilings, but **no code enforces them**. A single workspace can burn the AI budget without limit. Both edge functions that make real (paid) Anthropic calls — `analyze-offer` (Sonnet, expensive) and `ingest-source` (Haiku, cheap) — run unguarded.

## Scope (explicitly bounded)

**In scope:** Enforce the **daily USD cap** before each paid orchestrator call, on both `analyze-offer` and `ingest-source`.

**Out of scope (deferred):**
- **Credits enforcement** (`daily_credits_cap` / `monthly_credits_cap`) → **M5**, where the real credit system lives (`credit_ledger`, per-action pricing, reserve/refund). Building a credits stub now would be throwaway work — explicitly avoided.
- **Monthly USD cap** → not required by M2/M3 DoD. Daily is the DoD requirement.
- **Admin UI for setting caps** → admins set caps via SQL (consistent with how admin-promotion and golden-set seeding are done in this project).

## Approach (chosen: A — derive from `ai_runs`)

`ai_runs.estimated_cost` is already written on success by **both** edge functions (and for `analyze-offer` it already includes the LLM-judge cost). That makes `ai_runs` the single source of truth for spend — no manual usage rollup is needed.

The pre-flight check sums today's successful `estimated_cost` for the workspace and compares it to the configured cap.

**Rejected alternatives:**
- **B — rollup table (`workspace_daily_usage`) with an atomic increment SQL function:** matches 0015's original intent but adds a migration, dual-writes, and can drift from `ai_runs`.
- **C — read-modify-write rollup:** no migration but race-prone (lost increments).

`workspace_daily_usage` (from 0015) is intentionally left **unused** for now — we do not write a throwaway rollup that M5 billing may supersede. Revisit in M5.

## Components

### 1. New module: `supabase/functions/_shared/costCap.ts`

```
DEFAULT_DAILY_USD_CAP = 10            // applied when a workspace has no caps row (safe default)

class DailyCapExceededError extends Error
  // fields: workspaceId, spentUsd, capUsd
  // message: clean, user-facing ("Daily AI budget reached for this workspace ...")

isOverDailyCap(spentUsd: number, capUsd: number): boolean
  // pure predicate, no I/O: returns spentUsd >= capUsd

async assertUnderDailyCap(workspaceId: string): Promise<void>
  // 1. read daily_usd_cap from workspace_credit_caps (maybeSingle); fallback DEFAULT_DAILY_USD_CAP
  // 2. sum estimated_cost from ai_runs WHERE workspace_id = ? AND status = 'success'
  //    AND completed_at >= start-of-today (UTC)
  // 3. if isOverDailyCap(sum, cap) -> throw DailyCapExceededError
```

Mirrors the existing `killSwitch.ts` shape (custom error class + `assert*` function read through `getAdminClient()`).

**Boundary behavior:** `cap = 0` blocks immediately (`0 >= 0` is true) — satisfies M2's "admin sets cap=0 → analyze blocked" with no special-casing.

### 2. `analyze-offer/index.ts`

Insert after the existing `assertNotPaused('UnderwritingOrchestrator')` block and before `recordRunStart`:

```ts
try {
  await assertUnderDailyCap(offer.workspace_id)
} catch (err) {
  if (err instanceof DailyCapExceededError) return jsonResponse({ error: err.message }, 429)
  throw err
}
```

`offer.workspace_id` is already fetched. If it is null, skip the check (no workspace to cap).

### 3. `ingest-source/index.ts`

Identical guard in the **synchronous** handler, after `assertNotPaused('SourceExtractionOrchestrator')` and before inserting the `source_fetch_jobs` row, so the admin gets an immediate `429`. `offer.workspace_id` is already fetched there.

## Data flow

```
request
  → requireUser / requireAdmin
  → fetch offer (has workspace_id)
  → assertNotPaused(orchestrator)         [existing kill switch — 503 on pause]
  → assertUnderDailyCap(workspace_id)      [NEW — 429 on cap exceeded]
  → recordRunStart / queue job
  → (async) run orchestrator → recordRunSuccess(estimated_cost)
                                   ↑ this is what the next request's SUM reads
```

## Error handling

- `DailyCapExceededError` → HTTP `429` with a clean JSON `{ error }` message naming the workspace's spend vs cap. Non-retryable for the rest of the day.
- Any other error from `assertUnderDailyCap` (e.g. a DB read failure) is **not** caught as a cap hit; it propagates to the existing top-level `catch` → `500`. Because the guard runs before `recordRunStart`, a `500` here means the orchestrator never runs and **no spend occurs** — the request fails safe, just surfaced as a generic `500` rather than a misleading cap message. This mirrors how `assertNotPaused` lets non-`OrchestratorPausedError` errors fall through.

## Testing

- Edge functions run on Deno and are **not** covered by the vitest (Node) suite — consistent with existing `killSwitch.ts` / `recordAiRun.ts`, which have no unit tests. The `decisions/003-deno-side-zod-duplication.md` decision already accepts the Deno/Node boundary.
- `isOverDailyCap` is a trivial pure predicate (`spent >= cap`); its correctness is self-evident and exercised implicitly by typecheck.
- **Verification plan:**
  1. `pnpm typecheck` + `pnpm build` green.
  2. Manual integration check against the linked Supabase project: set `daily_usd_cap = 0` for a test workspace via SQL → call `analyze-offer` → expect `429` with the clean message; call `ingest-source` → expect `429`. Reset cap → expect normal `200` flow.

## Files touched

- `supabase/functions/_shared/costCap.ts` (new)
- `supabase/functions/analyze-offer/index.ts` (add guard + import)
- `supabase/functions/ingest-source/index.ts` (add guard + import)
- No migrations. No `src/` changes. No new packages.

## Deployment note

Both edge functions must be redeployed after this change (`supabase functions deploy analyze-offer` / `ingest-source`). Per CLAUDE.md, manual deploy is acceptable until a CI deploy job exists — note it in the PR.
