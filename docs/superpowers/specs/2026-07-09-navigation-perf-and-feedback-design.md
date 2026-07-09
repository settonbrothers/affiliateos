# Navigation Performance & Feedback — Design

**Date:** 2026-07-09
**Author:** Izak + Claude
**Status:** Approved (design phase)

## Problem

Two user-reported issues, one shared root cause:

1. **Slow screen transitions.** Navigating between app screens feels very slow.
2. **No "working" feedback.** During the wait after a click, nothing on screen changes, so it feels like the command was never received.

## Root Cause

This is a Next.js App Router app. Investigation found:

- **No `loading.tsx` anywhere in `src/app`.** Without it, a navigation blocks on the server until the destination page's Server Component fully resolves (including its data fetching). Nothing paints in the meantime — this is the direct cause of issue #2 for navigation, and it makes issue #1 feel worse than it is.
- **Sequential server round-trips in the shared app layout.** `src/app/(app)/layout.tsx` awaits `getUser` → `isOnboarded` → `getCurrentBalance` → `isCurrentUserAdmin` → `getTranslations` in series. Independent calls run back-to-back instead of in parallel.
- **Sequential fetches in pages.** e.g. `offers/page.tsx` awaits `listOffers()` then `listVerticals()` in series.
- **Middleware runs `getUser` on every request** (unavoidable for auth refresh, but additive to the above).
- **Nav links have no pending/loading state** (`AppNav.tsx`).

## Approach

Use Next.js's built-in mechanisms — no external progress-bar library, no moving RSC pages to client components. Three parts:

### 1. Instant feedback — `loading.tsx` skeletons
Add route-level loading UI that renders instantly (via the framework's Suspense boundary) while the server streams the page:

- `src/app/(app)/loading.tsx` — group-level fallback covering all app screens.
- Per-route skeletons for the heavy screens where a generic fallback would look wrong:
  - `offers/loading.tsx` (list/table skeleton)
  - `offers/[id]/loading.tsx` (offer detail skeleton)
  - `campaigns/loading.tsx`
  - `campaigns/[id]/loading.tsx`
  - `admin/loading.tsx` (group-level for the admin section)

Skeletons match the existing AFFEX visual language (thin-line placeholders, no emojis, matching layout structure) so the transition reads as continuous, not a flash of unrelated content.

### 2. Real latency reduction — parallelize + cache
- **Layout:** keep the `getUser` gate first (needed for the redirect), then run `isOnboarded`, `getCurrentBalance`, `isCurrentUserAdmin`, `getTranslations` concurrently with `Promise.all`. `isOnboarded` gates a redirect, so evaluate its result before rendering, but still fetch it alongside the others.
- **Pages:** wrap independent fetches (e.g. `listOffers` + `listVerticals`) in `Promise.all`.
- **Caching:** apply `React.cache`/short-lived caching to slow-changing, per-request-stable reads (`isCurrentUserAdmin`, `listVerticals`) so repeated calls within a render don't re-hit the DB. No behavior change, only dedup.

### 3. Global progress affordance — `useLinkStatus`
A thin top progress bar that appears the moment a navigation starts, as a chrome-level backup to the per-route skeleton (covers the brief window before the skeleton mounts and any navigation that reuses a cached segment). Built with Next.js's built-in `useLinkStatus` hook — no dependency added.

## Out of Scope
- AI "thinking" feedback inside actions (analyze / diagnose / test-kit): already handled by `ScanPanel`. This work targets **screen navigation** only.
- Any change to auth/middleware behavior beyond leaving it intact.
- Data-model or migration changes: none.

## Success Criteria
- Clicking any nav item produces visible feedback (skeleton and/or progress bar) within ~100ms.
- App layout's independent server calls run concurrently (verified in code; measurable latency drop on the layout segment).
- No regression in typecheck / lint / existing tests.

## Testing
- `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- Manual: run the app, click through offers → offer detail → campaigns → admin, confirm immediate skeleton + progress bar and no blank waits.
