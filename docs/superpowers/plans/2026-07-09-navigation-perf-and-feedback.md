# Navigation Performance & Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make in-app screen transitions feel instant by adding `loading.tsx` skeletons, a per-link pending indicator, and by parallelizing/deduplicating the server round-trips that block navigation.

**Architecture:** Pure Next.js App Router mechanisms — route-level `loading.tsx` Suspense fallbacks for immediate paint, `useLinkStatus` for immediate click feedback, `Promise.all` + `React.cache` to cut real latency in the shared app layout and heavy pages. No new dependencies, no data-model changes, no change to auth/middleware behavior.

**Tech Stack:** Next.js 15.5 (App Router), React 19, TypeScript (strict, `noUncheckedIndexedAccess`), Supabase SSR, next-intl.

---

## Testing note

This repo does not unit-test `.tsx` pages/layouts or route files (no test harness for them). The changed surfaces here are route-level UI (`loading.tsx`, nav components) and a small server-side refactor. Verification is therefore: `pnpm typecheck` + `pnpm lint` + `pnpm build` (all must pass) plus a manual click-through. Each task ends with a commit. Where a task changes pure logic, its verification command is spelled out.

Before starting, clean the stale Next build cache (Windows gotcha from CLAUDE.md):
```bash
Remove-Item -Recurse -Force .next
```

---

## File Structure

**Create:**
- `src/components/ui/Skeleton.tsx` — one reusable shimmer block (server component, no client JS).
- `src/components/nav/LinkPending.tsx` — client `useLinkStatus` indicator, rendered inside a `<Link>`.
- `src/lib/auth/session.ts` — `React.cache`-wrapped current-user fetch to dedupe `auth.getUser()` within a render.
- `src/app/(app)/loading.tsx` — generic app-group skeleton.
- `src/app/(app)/offers/loading.tsx` — offers list skeleton.
- `src/app/(app)/offers/[id]/loading.tsx` — offer detail skeleton.
- `src/app/(app)/campaigns/loading.tsx` — campaigns list skeleton.
- `src/app/(app)/campaigns/[id]/loading.tsx` — campaign detail skeleton.
- `src/app/admin/loading.tsx` — admin section skeleton.

**Modify:**
- `src/app/globals.css` — add `affexShimmer` keyframe + `.affex-skel` class.
- `src/app/(app)/layout.tsx` — parallelize independent awaits; use cached session user.
- `src/app/(app)/offers/page.tsx` — parallelize fetches.
- `src/lib/auth/role.ts` — use cached session user; `React.cache` the role read.
- `src/lib/queries/onboarding.ts` — use cached session user.
- `src/lib/queries/credits.ts` — use cached session user in `getCurrentWorkspaceId`.
- `src/lib/queries/offers.ts` — `React.cache` `listVerticals`.
- `src/components/nav/AppNav.tsx` — render `LinkPending` inside each nav link.
- `src/components/nav/MobileNav.tsx` — render `LinkPending` inside each menu link.

---

## Task 1: Shimmer style + Skeleton component

**Files:**
- Modify: `src/app/globals.css` (append after line ~144)
- Create: `src/components/ui/Skeleton.tsx`

- [ ] **Step 1: Add the shimmer keyframe + class to `globals.css`**

Append at the end of the animations block (after the `@media (prefers-reduced-motion: reduce)` block around line 144):

```css
/* Route-transition skeleton shimmer (see docs/superpowers/specs/2026-07-09-navigation-perf-and-feedback-design.md). */
@keyframes affexShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.affex-skel {
  display: block;
  background: linear-gradient(90deg, rgba(255,255,255,0.035) 25%, rgba(255,255,255,0.085) 37%, rgba(255,255,255,0.035) 63%);
  background-size: 200% 100%;
  animation: affexShimmer 1.4s ease-in-out infinite;
  border-radius: 3px;
}
@media (prefers-reduced-motion: reduce) { .affex-skel { animation: none; } }
```

- [ ] **Step 2: Create the Skeleton component**

Create `src/components/ui/Skeleton.tsx`:

```tsx
import type { CSSProperties } from 'react'

// A single shimmering placeholder block used by route-level loading.tsx files.
// Server component (no client JS); relies on the .affex-skel class in globals.css.
export function Skeleton({
  width = '100%',
  height = 16,
  radius = 3,
  style,
}: {
  width?: number | string
  height?: number | string
  radius?: number | string
  style?: CSSProperties
}) {
  return (
    <span
      aria-hidden
      className="affex-skel"
      style={{ width, height, borderRadius: radius, ...style }}
    />
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (no errors).

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/components/ui/Skeleton.tsx
git commit -m "feat(nav): shimmer Skeleton primitive for route transitions"
```

---

## Task 2: App-group loading skeleton

**Files:**
- Create: `src/app/(app)/loading.tsx`

This is the fallback for every screen under `(app)` that has no more-specific `loading.tsx`. It mirrors the page container in `src/app/(app)/layout.tsx` (the `<main>` already provides padding + max-width, so this only fills the content area).

- [ ] **Step 1: Create `src/app/(app)/loading.tsx`**

```tsx
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div style={{ marginBottom: 'clamp(24px,3vw,38px)' }}>
        <Skeleton width={150} height={11} style={{ marginBottom: 14 }} />
        <Skeleton width="min(440px, 70%)" height={46} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={64} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/loading.tsx"
git commit -m "feat(nav): app-group loading skeleton"
```

---

## Task 3: Offers list + detail loading skeletons

**Files:**
- Create: `src/app/(app)/offers/loading.tsx`
- Create: `src/app/(app)/offers/[id]/loading.tsx`

- [ ] **Step 1: Create `src/app/(app)/offers/loading.tsx`**

Mirrors the offers page header (eyebrow + big title + stats row + add button) and the table rows.

```tsx
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap', marginBottom: 'clamp(24px,3vw,38px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Skeleton width={180} height={11} />
          <Skeleton width="min(380px, 60vw)" height={52} />
          <Skeleton width={220} height={12} />
        </div>
        <Skeleton width={150} height={44} radius={0} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} height={72} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/app/(app)/offers/[id]/loading.tsx`**

Mirrors an offer detail page: back link, title, a tab bar, and a content block.

```tsx
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <Skeleton width={90} height={12} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skeleton width="min(460px, 70vw)" height={40} />
        <Skeleton width={260} height={13} />
      </div>
      <div style={{ display: 'flex', gap: 18, borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} width={78} height={14} />
        ))}
      </div>
      <div style={{ display: 'grid', gap: 16 }}>
        <Skeleton height={120} radius={6} />
        <Skeleton height={200} radius={6} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/offers/loading.tsx" "src/app/(app)/offers/[id]/loading.tsx"
git commit -m "feat(nav): offers list + detail loading skeletons"
```

---

## Task 4: Campaigns list + detail loading skeletons

**Files:**
- Create: `src/app/(app)/campaigns/loading.tsx`
- Create: `src/app/(app)/campaigns/[id]/loading.tsx`

- [ ] **Step 1: Create `src/app/(app)/campaigns/loading.tsx`**

Mirrors the campaigns page: title + subtitle + a simple table.

```tsx
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Skeleton width={220} height={26} />
        <Skeleton width={320} height={13} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={40} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/app/(app)/campaigns/[id]/loading.tsx`**

```tsx
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Skeleton width={90} height={12} />
      <Skeleton width="min(420px, 70vw)" height={34} />
      <div style={{ display: 'grid', gap: 16 }}>
        <Skeleton height={140} radius={6} />
        <Skeleton height={180} radius={6} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/campaigns/loading.tsx" "src/app/(app)/campaigns/[id]/loading.tsx"
git commit -m "feat(nav): campaigns list + detail loading skeletons"
```

---

## Task 5: Admin loading skeleton

**Files:**
- Create: `src/app/admin/loading.tsx`

The admin section has its own layout (`src/app/admin/layout.tsx`) with a top bar + sub-tabs; this fallback fills the `<main>` content area only.

- [ ] **Step 1: Create `src/app/admin/loading.tsx`**

```tsx
import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Skeleton width={200} height={22} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} height={38} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/loading.tsx
git commit -m "feat(nav): admin section loading skeleton"
```

---

## Task 6: Cached session user (dedupe auth.getUser)

**Files:**
- Create: `src/lib/auth/session.ts`
- Modify: `src/lib/auth/role.ts`
- Modify: `src/lib/queries/onboarding.ts`
- Modify: `src/lib/queries/credits.ts:4-18`

`auth.getUser()` is a network round-trip that validates the token. The `(app)` layout triggers it 4x per render (directly, plus inside `isOnboarded`, `getCurrentBalance`, `isCurrentUserAdmin`). `React.cache` dedupes these to a single call per request.

- [ ] **Step 1: Create the cached helper**

Create `src/lib/auth/session.ts`:

```tsx
import type { User } from '@supabase/supabase-js'
import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'

// Current authenticated user, memoized per-request via React.cache so repeated
// callers (layout + role/onboarding/credits helpers) share one auth.getUser()
// round-trip instead of each making their own.
export const getSessionUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})
```

- [ ] **Step 2: Use it in `role.ts` and cache the role read**

Rewrite `src/lib/auth/role.ts`:

```tsx
import { cache } from 'react'

import { getSessionUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

// Returns the current user's system_role, or null if unauthenticated.
// Reads profiles directly (RLS lets a user read their own row); mirrors the
// check previously inlined in the /admin layout. Memoized per-request.
export const getCurrentUserRole = cache(async (): Promise<
  'admin' | 'user' | null
> => {
  const user = await getSessionUser()
  if (!user) return null

  const supabase = await createClient()
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('role.ts: failed to fetch profile', profileError)
    return null
  }

  return (profile?.system_role as 'admin' | 'user' | undefined) ?? null
})

export async function isCurrentUserAdmin(): Promise<boolean> {
  return (await getCurrentUserRole()) === 'admin'
}
```

- [ ] **Step 3: Use it in `onboarding.ts`**

Rewrite `src/lib/queries/onboarding.ts`:

```tsx
import { getSessionUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

// True once the user has completed (or skipped) onboarding. Used by the (app)
// layout to gate the app. New signups have no row -> false -> /onboarding.
export async function isOnboarded(): Promise<boolean> {
  const user = await getSessionUser()
  if (!user) return false
  const supabase = await createClient()
  const { data } = await supabase
    .from('operator_profiles')
    .select('onboarded_at')
    .eq('user_id', user.id)
    .maybeSingle()
  return !!data?.onboarded_at
}
```

- [ ] **Step 4: Use it in `credits.ts` `getCurrentWorkspaceId`**

In `src/lib/queries/credits.ts`, replace the top of the file (lines 1-18) so `getCurrentWorkspaceId` uses the cached user. Keep the rest of the file unchanged:

```tsx
import { getSessionUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

// The current user's workspace id (1 user : 1 workspace in MVP).
export async function getCurrentWorkspaceId(): Promise<string | null> {
  const user = await getSessionUser()
  if (!user) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  if (error) console.error('[queries/credits] DB error:', error)
  return data?.workspace_id ?? null
}
```

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS (no unused-import warnings — the old inline `createClient` getUser blocks are gone but `createClient` is still used in each file).

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/session.ts src/lib/auth/role.ts src/lib/queries/onboarding.ts src/lib/queries/credits.ts
git commit -m "perf(nav): dedupe auth.getUser via cached session helper"
```

---

## Task 7: Parallelize the app layout + offers page

**Files:**
- Modify: `src/app/(app)/layout.tsx:19-29`
- Modify: `src/app/(app)/offers/page.tsx:7-11`
- Modify: `src/lib/queries/offers.ts:5-13`

- [ ] **Step 1: Cache `listVerticals`**

In `src/lib/queries/offers.ts`, wrap `listVerticals` in `React.cache`. Change the top import line and the function:

Change line 1 from:
```tsx
import { createClient } from '@/lib/supabase/server'
```
to:
```tsx
import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'
```

Change the `listVerticals` declaration (lines 5-13) from `export async function listVerticals(): Promise<Vertical[]> {` to a cached const:

```tsx
export const listVerticals = cache(async (): Promise<Vertical[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('verticals')
    .select('*')
    .order('display_order')
  if (error) console.error('[queries/offers] DB error:', error)
  return (data ?? []) as Vertical[]
})
```

- [ ] **Step 2: Parallelize the `(app)` layout**

In `src/app/(app)/layout.tsx`, replace the sequential data block (lines 19-29, from `const supabase = await createClient()` through `const t = await getTranslations('nav')`) with:

```tsx
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const [onboarded, balance, isAdmin, t] = await Promise.all([
    isOnboarded(),
    getCurrentBalance(),
    isCurrentUserAdmin(),
    getTranslations('nav'),
  ])
  if (!onboarded) redirect('/onboarding')
```

Then fix the imports at the top of the file: remove the now-unused `createClient` import, and add `getSessionUser`. The import block becomes:

```tsx
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AffexMark } from '@/components/brand/AffexMark'
import { LanguageToggle } from '@/components/LanguageToggle'
import { AppNav } from '@/components/nav/AppNav'
import { MobileNav } from '@/components/nav/MobileNav'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { getSessionUser } from '@/lib/auth/session'
import { getCurrentBalance } from '@/lib/queries/credits'
import { isOnboarded } from '@/lib/queries/onboarding'
```

(Note: `getCurrentBalance` must exist in `src/lib/queries/credits.ts` — it is already imported and used today, so no change there beyond Task 6.)

- [ ] **Step 3: Parallelize the offers page**

In `src/app/(app)/offers/page.tsx`, replace lines 7-11 (from `export default async function OffersPage() {` through `const t = await getTranslations('offers')`) with:

```tsx
export default async function OffersPage() {
  const [offers, verticals, t] = await Promise.all([
    listOffers(),
    listVerticals(),
    getTranslations('offers'),
  ])
  const verticalNames = Object.fromEntries(verticals.map((v) => [v.id, v.name]))
```

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. If lint flags an unused `createClient` in `layout.tsx`, confirm the import was removed in Step 2.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/layout.tsx" "src/app/(app)/offers/page.tsx" src/lib/queries/offers.ts
git commit -m "perf(nav): parallelize app layout + offers page data fetching"
```

---

## Task 8: Per-link pending indicator

**Files:**
- Create: `src/components/nav/LinkPending.tsx`
- Modify: `src/components/nav/AppNav.tsx`
- Modify: `src/components/nav/MobileNav.tsx`

`useLinkStatus` (Next 15.3+) reports the pending state of the nearest ancestor `<Link>`. Rendered inside each nav link, it lights up the instant a navigation starts — immediate click feedback that complements the route skeleton.

- [ ] **Step 1: Create `src/components/nav/LinkPending.tsx`**

```tsx
'use client'

import { useLinkStatus } from 'next/link'

// A small pulsing dot that appears while the parent <Link>'s navigation is
// pending. Must be rendered as a descendant of a next/link <Link>.
export function LinkPending() {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return (
    <span
      aria-hidden
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: 'var(--primary)',
        marginInlineStart: 7,
        animation: 'affexPulseDot 0.7s ease-in-out infinite',
      }}
    />
  )
}
```

- [ ] **Step 2: Render it inside the desktop nav link**

In `src/components/nav/AppNav.tsx`, import the component and render it inside the `<Link>` after the label. Add the import near the top (after the existing `next/link` import):

```tsx
import { LinkPending } from '@/components/nav/LinkPending'
```

Then inside `NavItem`, change the `<Link>` body from:

```tsx
      {label}
      {active && (
```

to:

```tsx
      {label}
      <LinkPending />
      {active && (
```

- [ ] **Step 3: Render it inside the mobile menu link**

In `src/components/nav/MobileNav.tsx`, add the import (after the `next/navigation` import):

```tsx
import { LinkPending } from '@/components/nav/LinkPending'
```

Then inside the menu `<Link>`, add `<LinkPending />` right after the second `<span>` (the Hebrew label), before the closing `</Link>`. Change:

```tsx
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: active ? 'var(--primary)' : '#6E6E6C' }}>
                    {n.label}
                  </span>
                </Link>
```

to:

```tsx
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: active ? 'var(--primary)' : '#6E6E6C' }}>
                    {n.label}
                  </span>
                  <LinkPending />
                </Link>
```

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/nav/LinkPending.tsx src/components/nav/AppNav.tsx src/components/nav/MobileNav.tsx
git commit -m "feat(nav): per-link pending indicator via useLinkStatus"
```

---

## Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Clean build cache + full check**

```bash
Remove-Item -Recurse -Force .next
pnpm typecheck
pnpm lint
pnpm build
```
Expected: all PASS, build completes.

- [ ] **Step 2: Manual click-through**

Run `pnpm dev`. Then, logged in:
1. Click Offers → Campaigns → Offers → open an offer → Admin.
2. Confirm for each navigation: a skeleton appears **immediately** (no blank/frozen wait) and the clicked nav link shows the pulsing dot.
3. Confirm the destination content replaces the skeleton once loaded.
4. Toggle a slow network (DevTools → Network → Slow 3G) and repeat to make the skeletons clearly visible.

Expected: every transition shows instant feedback; no screen stays blank waiting on the server.

- [ ] **Step 3: Final commit (if any manual tweaks were needed)**

```bash
git add -A
git commit -m "chore(nav): verification pass for navigation perf + feedback"
```

---

## Self-Review Notes

- **Spec coverage:** loading.tsx skeletons (Tasks 2-5) ✓; parallelize + cache (Tasks 6-7) ✓; immediate navigation affordance (Task 8) ✓. The spec's "top progress bar" is realized as a per-link pending dot — `useLinkStatus` reports only the nearest ancestor Link, so a per-link indicator is the idiomatic built-in form and gives the same "something happened instantly" feedback without a third-party progress-bar library. Out-of-scope items (AI thinking states, middleware behavior, migrations) untouched ✓.
- **Type consistency:** `getSessionUser` returns `User | null` and is consumed identically in role/onboarding/credits/layout. `listVerticals`/`getCurrentUserRole` become cached consts with the same call signature as before.
- **No placeholders:** every step has complete code or an exact command.
