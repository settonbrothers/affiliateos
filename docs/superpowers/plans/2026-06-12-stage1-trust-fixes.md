# Stage 1 Trust Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the four "the product feels broken" gaps: extracted facts never reach the analysis or the offer page (item 8), users see no source citations (item 9), every offer is stuck on `draft` (item 6), and there is no admin nav link (item 1).

**Architecture:** Four isolated changes that ride existing rails. (1) Ingested facts with high extraction confidence auto-verify so the underwriting run actually receives them; low-confidence facts still wait for admin review. (2) A new migration (0029) adds read-only RLS policies so any user who can see an offer can also see its **verified** facts and their source-document URLs; a new `OfferFactsList` component renders them (value + source quote + link) on the Overview tab. (3) Offer status auto-advances along the existing enum (`needs_source_ingestion` → `ready_for_analysis` → `ai_analyzed`) at the three lifecycle moments, guarded with `.in('status', …)` so a further-along status is never demoted; admins get a manual override select. (4) The app sidebar gains an Admin link for admins.

**Tech Stack:** Next.js 15 App Router (server components + server actions), Supabase (RLS, Deno edge functions via service-role client), Zod, Vitest.

**Migration note (admin-coordinated per CLAUDE.md):** This plan adds migration `0029_user_fact_visibility.sql` (RLS policies only — no schema change, so NO `database.ts` regen is needed). Izak approved Stage 1 including this migration on 2026-06-12.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/app/(app)/layout.tsx` | App sidebar — add conditional Admin link | Modify |
| `src/app/(app)/offers/[id]/page.tsx` | Pass `isAdmin` + verified facts into Overview | Modify |
| `src/components/offers/OfferOverview.tsx` | Gate "Manage sources", render facts section + status control | Modify |
| `supabase/migrations/0029_user_fact_visibility.sql` | Read policies for verified facts + source docs | Create |
| `src/lib/facts/display.ts` | Pure helpers: fact-type labels, display sort, safe hostname | Create |
| `src/lib/facts/display.test.ts` | Unit tests for the helpers | Create |
| `src/lib/queries/offers.ts` | `getVerifiedFacts` query (join to source URL) | Modify |
| `src/components/offers/OfferFactsList.tsx` | Render verified facts with quote + source link | Create |
| `supabase/functions/ingest-source/index.ts` | Auto-verify high-confidence facts; advance status | Modify |
| `supabase/functions/analyze-offer/index.ts` | Advance status to `ai_analyzed` on success | Modify |
| `src/lib/actions/offers.ts` | `createOffer` initial status; `updateOfferStatus` action | Modify |
| `src/lib/validations/offer.ts` | `OFFER_STATUSES` + `OfferStatusUpdateSchema` | Modify |
| `src/lib/validations/offer.test.ts` | Unit tests for the status schema | Create |
| `src/lib/offers/status.ts` | Status label + badge-class maps (exhaustive, typed) | Create |
| `src/components/offers/OfferStatusSelect.tsx` | Admin-only status override select | Create |
| `src/components/offers/OffersTable.tsx` | Colored, labeled status badges | Modify |

**Commands:** test = `pnpm test`; single file = `pnpm exec vitest run <path>`; `pnpm typecheck`; `pnpm lint`. Vitest covers `src/**` only; `supabase/functions` is Deno (excluded from tsconfig) and is verified by deploy + the manual e2e scripts.

---

## Task 1: Admin nav link + gate "Manage sources" (item 1)

**Why:** Admins can only reach `/admin` by typing the URL; meanwhile the "Manage sources" button on the Overview tab shows for everyone (non-admins who click it just bounce off the admin layout).

**Files:**
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/components/offers/OfferOverview.tsx`
- Modify: `src/app/(app)/offers/[id]/page.tsx:115-117`

- [ ] **Step 1: Add the Admin link to the app sidebar**

In `src/app/(app)/layout.tsx`, add the import (after the `isOnboarded` import on line 5):

```ts
import { isCurrentUserAdmin } from '@/lib/auth/role'
```

After `const balance = await getCurrentBalance()` (line 22), add:

```ts
  const isAdmin = await isCurrentUserAdmin()
```

Inside the `<nav>` block, after the Campaigns `<Link>` (line 40), add:

```tsx
          {isAdmin && (
            <Link
              href="/admin"
              className="rounded-md px-3 py-2 hover:bg-[var(--color-muted)]"
            >
              Admin
            </Link>
          )}
```

- [ ] **Step 2: Gate the "Manage sources" button behind isAdmin**

In `src/components/offers/OfferOverview.tsx`, change the `Props` type and destructuring (lines 7-12) to:

```ts
type Props = {
  offer: Offer
  operatorNotes: string | null
  isAdmin: boolean
}

export function OfferOverview({ offer, operatorNotes, isAdmin }: Props) {
```

Wrap the "Manage sources" button (lines 47-49) in the admin condition:

```tsx
        {isAdmin && (
          <Button asChild size="sm" variant="ghost">
            <Link href={`/admin/offers/${offer.id}/sources`}>Manage sources</Link>
          </Button>
        )}
```

- [ ] **Step 3: Pass isAdmin from the offer page**

In `src/app/(app)/offers/[id]/page.tsx`, the page already computes `const isAdmin = await isCurrentUserAdmin()` (line 56). Change the Overview render (line 115-117) to:

```tsx
      {activeTab === 'overview' && (
        <OfferOverview
          offer={offer}
          operatorNotes={offer.operator_notes}
          isAdmin={isAdmin}
        />
      )}
```

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/layout.tsx src/components/offers/OfferOverview.tsx "src/app/(app)/offers/[id]/page.tsx"
git commit -m "feat(nav): admin sidebar link + gate Manage-sources behind admin"
```

---

## Task 2: Migration 0029 — user read access to verified facts + source docs

**Why:** `extracted_facts` and `source_documents` RLS is admin-only (`0011`, `0010`), so the user-facing offer page cannot show facts or citations at all. New read-only policies let any user who can already see the offer (offers RLS still gates that) read its **verified** facts and the source documents they cite. Policy-only migration — no table shape change, no `database.ts` regen.

**Files:**
- Create: `supabase/migrations/0029_user_fact_visibility.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0029_user_fact_visibility.sql`:

```sql
-- 0029_user_fact_visibility.sql
-- Users could not see extracted facts or their source documents (RLS was
-- admin-only), so verdicts shipped with no visible evidence. Open read-only
-- access to VERIFIED facts (+ the source documents they cite) to any user who
-- can already see the offer — offer visibility itself still gates everything,
-- because the offers RLS policies apply inside the exists() subquery.

create policy "verified facts visible with offer" on extracted_facts
  for select
  using (
    status = 'verified'
    and exists (select 1 from offers o where o.id = extracted_facts.offer_id)
  );

create policy "source documents visible with offer" on source_documents
  for select
  using (
    exists (select 1 from offers o where o.id = source_documents.offer_id)
  );
```

- [ ] **Step 2: Apply to the linked project**

Run: `pnpm dlx supabase@latest db push`
Expected: `0029_user_fact_visibility.sql` applied. If the CLI has no access token in this environment, mark this as an owner step in the final handoff and continue — the app code degrades gracefully (users just see an empty facts list until applied).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0029_user_fact_visibility.sql
git commit -m "feat(rls): users can read verified facts + source docs of visible offers"
```

---

## Task 3: Fact display helpers (pure, TDD)

**Why:** The facts UI needs three bits of logic worth unit-testing: human labels for the 22 `fact_type` enum values, a deterministic display order (money facts first, then by confidence), and a crash-safe hostname extractor for source links.

**Files:**
- Create: `src/lib/facts/display.ts`
- Test: `src/lib/facts/display.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/facts/display.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { factTypeLabel, hostnameOf, sortFactsForDisplay } from './display'

describe('factTypeLabel', () => {
  it('maps known enum values to human labels', () => {
    expect(factTypeLabel('commission_value')).toBe('Commission')
    expect(factTypeLabel('traffic_rule_brand_bidding')).toBe('Brand bidding')
  })

  it('humanizes unknown values instead of crashing', () => {
    expect(factTypeLabel('future_fact_kind')).toBe('Future fact kind')
  })
})

describe('sortFactsForDisplay', () => {
  it('puts money facts before unprioritized types', () => {
    const sorted = sortFactsForDisplay([
      { fact_type: 'contact', confidence_score: 99 },
      { fact_type: 'commission_value', confidence_score: 50 },
    ])
    expect(sorted[0]?.fact_type).toBe('commission_value')
  })

  it('orders same-type facts by confidence, highest first', () => {
    const sorted = sortFactsForDisplay([
      { fact_type: 'allowed_geo', confidence_score: 40 },
      { fact_type: 'allowed_geo', confidence_score: 90 },
    ])
    expect(sorted[0]?.confidence_score).toBe(90)
  })

  it('does not mutate the input array', () => {
    const input = [
      { fact_type: 'other', confidence_score: 1 },
      { fact_type: 'commission_value', confidence_score: 1 },
    ]
    sortFactsForDisplay(input)
    expect(input[0]?.fact_type).toBe('other')
  })
})

describe('hostnameOf', () => {
  it('extracts the hostname', () => {
    expect(hostnameOf('https://partners.example.com/terms?x=1')).toBe(
      'partners.example.com'
    )
  })

  it('returns the raw string for unparseable URLs', () => {
    expect(hostnameOf('not a url')).toBe('not a url')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/lib/facts/display.test.ts`
Expected: FAIL — `Failed to resolve import "./display"`.

- [ ] **Step 3: Write the helpers**

Create `src/lib/facts/display.ts`:

```ts
import type { Database } from '@/types/database'

type FactType = Database['public']['Enums']['fact_type']

// Human labels for the fact_type enum (migration 0011). factTypeLabel falls
// back to a humanized raw value so a future enum member can't crash the UI.
const FACT_TYPE_LABELS: Partial<Record<FactType, string>> = {
  commission_value: 'Commission',
  commission_type: 'Commission type',
  payout_delay: 'Payout delay',
  cookie_duration: 'Cookie duration',
  traffic_rule_paid_social: 'Paid social rules',
  traffic_rule_google: 'Google Ads rules',
  traffic_rule_native: 'Native ads rules',
  traffic_rule_youtube: 'YouTube rules',
  traffic_rule_brand_bidding: 'Brand bidding',
  traffic_rule_direct_link: 'Direct linking',
  traffic_rule_email: 'Email rules',
  traffic_rule_seo: 'SEO rules',
  traffic_rule_organic_social: 'Organic social rules',
  allowed_geo: 'Allowed GEOs',
  restricted_geo: 'Restricted GEOs',
  cap: 'Caps',
  refund_policy: 'Refund policy',
  compliance_claim: 'Compliance claim',
  pricing_aov: 'Pricing / AOV',
  minimum_payout: 'Minimum payout',
  contact: 'Contact',
  other: 'Other',
}

export function factTypeLabel(type: string): string {
  return (
    FACT_TYPE_LABELS[type as FactType] ??
    type.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
  )
}

// Money/terms facts first; anything unprioritized keeps insertion order after
// them. Within the same priority, highest extraction confidence wins.
const DISPLAY_PRIORITY: readonly FactType[] = [
  'commission_value',
  'commission_type',
  'payout_delay',
  'minimum_payout',
  'cookie_duration',
  'pricing_aov',
  'allowed_geo',
  'restricted_geo',
  'cap',
]

export function sortFactsForDisplay<
  T extends { fact_type: string; confidence_score: number | null },
>(facts: T[]): T[] {
  const rank = (t: string): number => {
    const i = DISPLAY_PRIORITY.indexOf(t as FactType)
    return i === -1 ? DISPLAY_PRIORITY.length : i
  }
  return [...facts].sort(
    (a, b) =>
      rank(a.fact_type) - rank(b.fact_type) ||
      (b.confidence_score ?? 0) - (a.confidence_score ?? 0)
  )
}

// For "source ↗" links — never let a malformed stored URL crash the page.
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/lib/facts/display.test.ts`
Expected: PASS (7 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/facts/display.ts src/lib/facts/display.test.ts
git commit -m "feat(facts): display helpers — labels, sort order, safe hostname"
```

---

## Task 4: Verified facts on the offer Overview (items 8b + 9)

**Why:** The Overview tab shows only the manual form fields; the facts the AI extracted (with their source quotes and URLs) are invisible to users. Surface them with full provenance.

**Files:**
- Modify: `src/lib/queries/offers.ts`
- Create: `src/components/offers/OfferFactsList.tsx`
- Modify: `src/components/offers/OfferOverview.tsx`
- Modify: `src/app/(app)/offers/[id]/page.tsx`

- [ ] **Step 1: Add the query**

In `src/lib/queries/offers.ts`, append at the end of the file:

```ts
export type VerifiedFact = {
  id: string
  fact_type: string
  fact_value: string
  source_quote: string | null
  confidence_score: number | null
  source_documents: { url: string } | null
}

// Verified facts + the URL of the source doc each one cites. RLS (0029)
// scopes this to offers the current user can see; before 0029 is applied it
// simply returns [] for non-admins.
export async function getVerifiedFacts(
  offerId: string
): Promise<VerifiedFact[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('extracted_facts')
    .select(
      'id, fact_type, fact_value, source_quote, confidence_score, source_documents(url)'
    )
    .eq('offer_id', offerId)
    .eq('status', 'verified')
  return (data ?? []) as VerifiedFact[]
}
```

- [ ] **Step 2: Create the facts list component**

Create `src/components/offers/OfferFactsList.tsx`:

```tsx
import {
  factTypeLabel,
  hostnameOf,
  sortFactsForDisplay,
} from '@/lib/facts/display'
import type { VerifiedFact } from '@/lib/queries/offers'

export function OfferFactsList({ facts }: { facts: VerifiedFact[] }) {
  if (facts.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        No verified facts yet — the analysis runs on offer details alone until
        sources are ingested.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {sortFactsForDisplay(facts).map((f) => (
        <li key={f.id} className="text-sm">
          <span className="font-medium">{factTypeLabel(f.fact_type)}:</span>{' '}
          <span>{f.fact_value}</span>
          {f.source_quote && (
            <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
              “{f.source_quote}”
            </p>
          )}
          {f.source_documents?.url && (
            <a
              href={f.source_documents.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline"
            >
              {hostnameOf(f.source_documents.url)} ↗
            </a>
          )}
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 3: Render the section in OfferOverview**

In `src/components/offers/OfferOverview.tsx` (as left by Task 1), add the imports:

```ts
import { OfferFactsList } from '@/components/offers/OfferFactsList'
import type { VerifiedFact } from '@/lib/queries/offers'
```

Extend `Props` with the facts:

```ts
type Props = {
  offer: Offer
  operatorNotes: string | null
  isAdmin: boolean
  facts: VerifiedFact[]
}

export function OfferOverview({ offer, operatorNotes, isAdmin, facts }: Props) {
```

Between the closing `</dl>` and the button row `<div className="flex items-center gap-3 border-t …">`, insert:

```tsx
      <div className="border-t border-[var(--color-border)] pt-4">
        <h3 className="mb-2 text-sm font-medium">
          Verified facts ({facts.length})
        </h3>
        <OfferFactsList facts={facts} />
      </div>
```

- [ ] **Step 4: Fetch facts on the offer page**

In `src/app/(app)/offers/[id]/page.tsx`, add `getVerifiedFacts` to the existing `@/lib/queries/offers` import block, then fetch it only for the active tab (same pattern as compliance/test-kit), after the `isAdmin` line:

```ts
  // Verified facts feed the Overview's evidence section.
  const facts = activeTab === 'overview' ? await getVerifiedFacts(id) : []
```

And pass it to the component:

```tsx
      {activeTab === 'overview' && (
        <OfferOverview
          offer={offer}
          operatorNotes={offer.operator_notes}
          isAdmin={isAdmin}
          facts={facts}
        />
      )}
```

- [ ] **Step 5: Typecheck + lint + full tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/queries/offers.ts src/components/offers/OfferFactsList.tsx src/components/offers/OfferOverview.tsx "src/app/(app)/offers/[id]/page.tsx"
git commit -m "feat(offers): show verified facts with source quotes + links on Overview"
```

---

## Task 5: Auto-verify high-confidence facts at ingest (item 8a)

**Why:** Every extracted fact lands as `proposed`, but `analyze-offer` reads only `verified` facts — so unless an admin hand-approves each fact, **underwriting runs with zero facts**. Auto-verify facts the extractor itself is confident about (≥ 70 of 0-100); low-confidence ones still wait for review. Auto-verified rows keep `reviewed_by` NULL, which preserves the audit distinction from human-verified rows. Admins can still reject any fact in Manage sources.

**Files:**
- Modify: `supabase/functions/ingest-source/index.ts:188-199`

- [ ] **Step 1: Set status by confidence on insert**

In `supabase/functions/ingest-source/index.ts`, add a constant next to the other module constants (after `MAX_RAW_TEXT_LEN` on line 14):

```ts
// Facts at/above this extraction confidence (0-100) are auto-verified so the
// underwriting run actually receives them; below it they stay 'proposed' for
// admin review. Auto-verified rows keep reviewed_by NULL (≠ human-verified).
const AUTO_VERIFY_MIN_CONFIDENCE = 70
```

Replace the facts insert (lines 188-199) with:

```ts
    if (p.facts.length > 0) {
      await admin.from('extracted_facts').insert(
        p.facts.map((f) => ({
          offer_id: args.offerId,
          source_document_id: sdId,
          fact_type: f.fact_type as never,
          fact_value: f.fact_value,
          source_quote: f.source_quote,
          confidence_score: f.confidence_score,
          status: (f.confidence_score >= AUTO_VERIFY_MIN_CONFIDENCE
            ? 'verified'
            : 'proposed') as never,
        }))
      )
    }
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/ingest-source/index.ts
git commit -m "feat(ingest): auto-verify facts at confidence >= 70 so analysis gets them"
```

(Deploy happens in Task 8 — Deno code is outside `pnpm typecheck`/vitest scope.)

---

## Task 6: Offer status auto-advance (item 6, part 1)

**Why:** Status is hardcoded to `'draft'` at creation and never updated by anything, so the whole lifecycle enum is dead weight and the offers list reads "Draft, Draft, Draft". Advance it at the three lifecycle moments. Guards use `.in('status', …)` so a manually-set later status (e.g. `published`) is never demoted.

**Files:**
- Modify: `src/lib/actions/offers.ts:56`
- Modify: `supabase/functions/ingest-source/index.ts` (after job completion)
- Modify: `supabase/functions/analyze-offer/index.ts` (after `recordRunSuccess`)

- [ ] **Step 1: New offers start at needs_source_ingestion**

In `src/lib/actions/offers.ts` line 56, change:

```ts
      status: 'draft',
```

to:

```ts
      // Lifecycle: needs_source_ingestion → ready_for_analysis (ingest) →
      // ai_analyzed (underwriting) → published (admin). 'draft' is reserved
      // for rows that aren't ready to enter the pipeline (e.g. promoted
      // golden-set entries an admin is still editing).
      status: 'needs_source_ingestion',
```

- [ ] **Step 2: Successful ingestion advances to ready_for_analysis**

In `supabase/functions/ingest-source/index.ts`, inside `processIngestion`, right after the job is marked completed (the `.update({ status: 'completed', … }).eq('id', args.jobId)` call), add:

```ts
    // Sources exist now — advance the offer past the ingestion stage. The
    // .in() guard never demotes a further-along status.
    await admin
      .from('offers')
      .update({
        status: 'ready_for_analysis',
        updated_at: new Date().toISOString(),
      })
      .eq('id', args.offerId)
      .in('status', ['draft', 'needs_source_ingestion'])
```

- [ ] **Step 3: Successful underwriting advances to ai_analyzed**

In `supabase/functions/analyze-offer/index.ts`, inside the `EdgeRuntime.waitUntil` async block, right after the `recordRunSuccess(runId, …)` call completes, add:

```ts
          // A verdict exists now — reflect it on the offer. Guard so an
          // already-published/rejected offer is never demoted.
          await admin
            .from('offers')
            .update({
              status: 'ai_analyzed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', offerId)
            .in('status', [
              'draft',
              'needs_source_ingestion',
              'ready_for_analysis',
            ])
```

- [ ] **Step 4: Typecheck + lint (Node side)**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors (edge files are outside tsconfig; this validates `actions/offers.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/offers.ts supabase/functions/ingest-source/index.ts supabase/functions/analyze-offer/index.ts
git commit -m "feat(offers): status auto-advances through the lifecycle"
```

---

## Task 7: Status labels, badge colors + admin override (item 6, part 2)

**Why:** Even with auto-advance, raw enum values (`needs_source_ingestion`) are unreadable, and an admin has no way to set `published`/`rejected`/`deprecated` — the gate that will matter once discovery-funnel offers go live.

**Files:**
- Modify: `src/lib/validations/offer.ts`
- Test: `src/lib/validations/offer.test.ts` (create)
- Create: `src/lib/offers/status.ts`
- Modify: `src/lib/actions/offers.ts`
- Create: `src/components/offers/OfferStatusSelect.tsx`
- Modify: `src/components/offers/OfferOverview.tsx`
- Modify: `src/components/offers/OffersTable.tsx`

- [ ] **Step 1: Write the failing schema test**

Create `src/lib/validations/offer.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { OFFER_STATUSES, OfferStatusUpdateSchema } from './offer'

describe('OfferStatusUpdateSchema', () => {
  it('accepts every lifecycle status', () => {
    for (const status of OFFER_STATUSES) {
      expect(OfferStatusUpdateSchema.safeParse({ status }).success).toBe(true)
    }
  })

  it('covers the full 7-value offer_status enum', () => {
    expect(OFFER_STATUSES).toHaveLength(7)
  })

  it('rejects values outside the enum', () => {
    expect(
      OfferStatusUpdateSchema.safeParse({ status: 'live' }).success
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/lib/validations/offer.test.ts`
Expected: FAIL — `OFFER_STATUSES` is not exported.

- [ ] **Step 3: Add the schema**

Append to `src/lib/validations/offer.ts`:

```ts
// Mirrors the offer_status enum (migration 0005). Kept as a const tuple so
// both z.enum and UI <select> options derive from one source.
export const OFFER_STATUSES = [
  'draft',
  'needs_source_ingestion',
  'ready_for_analysis',
  'ai_analyzed',
  'published',
  'rejected',
  'deprecated',
] as const

export const OfferStatusUpdateSchema = z.object({
  status: z.enum(OFFER_STATUSES),
})
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/lib/validations/offer.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 5: Create the label/badge maps**

Create `src/lib/offers/status.ts`:

```ts
import type { OfferStatus } from '@/types/db'

// Exhaustive (Record<OfferStatus, …>) so adding an enum value without a label
// becomes a compile error rather than a blank badge.
export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  draft: 'Draft',
  needs_source_ingestion: 'Needs sources',
  ready_for_analysis: 'Ready for analysis',
  ai_analyzed: 'Analyzed',
  published: 'Published',
  rejected: 'Rejected',
  deprecated: 'Deprecated',
}

export const OFFER_STATUS_BADGE_CLASS: Record<OfferStatus, string> = {
  draft: 'border-zinc-300 bg-zinc-100 text-zinc-700',
  needs_source_ingestion: 'border-amber-300 bg-amber-100 text-amber-800',
  ready_for_analysis: 'border-blue-300 bg-blue-100 text-blue-800',
  ai_analyzed: 'border-green-300 bg-green-100 text-green-800',
  published: 'border-emerald-400 bg-emerald-100 text-emerald-900',
  rejected: 'border-red-300 bg-red-100 text-red-800',
  deprecated: 'border-zinc-300 bg-zinc-100 text-zinc-500',
}
```

- [ ] **Step 6: Add the updateOfferStatus action**

In `src/lib/actions/offers.ts`, add to the imports:

```ts
import { isCurrentUserAdmin } from '@/lib/auth/role'
import {
  OfferStatusUpdateSchema,
  // …existing OfferCreateSchema/OfferUpdateSchema imports stay
} from '@/lib/validations/offer'
```

Append the action:

```ts
// Admin-only manual override of the lifecycle status (publish/reject/etc.).
// RLS ("admin write offers") enforces this server-side too — the explicit
// check exists to return a clear error instead of a silent 0-row update.
export async function updateOfferStatus(
  offerId: string,
  status: string
): Promise<{ error: string } | void> {
  const parsed = OfferStatusUpdateSchema.safeParse({ status })
  if (!parsed.success) return { error: 'Invalid status.' }
  if (!(await isCurrentUserAdmin())) return { error: 'Admins only.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('offers')
    .update({
      status: parsed.data.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', offerId)
  if (error) return { error: error.message }

  revalidatePath('/offers')
  revalidatePath(`/offers/${offerId}`)
}
```

- [ ] **Step 7: Create the status select component**

Create `src/components/offers/OfferStatusSelect.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { updateOfferStatus } from '@/lib/actions/offers'
import { OFFER_STATUS_LABELS } from '@/lib/offers/status'
import { OFFER_STATUSES } from '@/lib/validations/offer'
import type { OfferStatus } from '@/types/db'

export function OfferStatusSelect({
  offerId,
  status,
}: {
  offerId: string
  status: OfferStatus
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex items-center gap-2">
      <select
        defaultValue={status}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.value
          startTransition(async () => {
            const res = await updateOfferStatus(offerId, next)
            if (res?.error) {
              setError(res.error)
            } else {
              setError(null)
              router.refresh()
            }
          })
        }}
        className="rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1 text-sm"
      >
        {OFFER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {OFFER_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
```

- [ ] **Step 8: Wire status display into OfferOverview**

In `src/components/offers/OfferOverview.tsx` (as left by Task 4), add imports:

```ts
import { OfferStatusSelect } from '@/components/offers/OfferStatusSelect'
import { Badge } from '@/components/ui/badge'
import {
  OFFER_STATUS_BADGE_CLASS,
  OFFER_STATUS_LABELS,
} from '@/lib/offers/status'
```

Remove `['Status', offer.status],` from the `rows` array, and insert a dedicated row as the first child of the `<dl>` (before the `rows.map`):

```tsx
        <div className="flex items-center gap-4">
          <dt className="w-40 text-sm text-[var(--color-muted-foreground)]">
            Status
          </dt>
          <dd className="text-sm">
            {isAdmin ? (
              <OfferStatusSelect offerId={offer.id} status={offer.status} />
            ) : (
              <Badge className={OFFER_STATUS_BADGE_CLASS[offer.status]}>
                {OFFER_STATUS_LABELS[offer.status]}
              </Badge>
            )}
          </dd>
        </div>
```

- [ ] **Step 9: Colored badges on the offers list**

In `src/components/offers/OffersTable.tsx`, add the import:

```ts
import {
  OFFER_STATUS_BADGE_CLASS,
  OFFER_STATUS_LABELS,
} from '@/lib/offers/status'
```

Change the status cell (line 33) to:

```tsx
              <Badge className={OFFER_STATUS_BADGE_CLASS[offer.status]}>
                {OFFER_STATUS_LABELS[offer.status]}
              </Badge>
```

- [ ] **Step 10: Typecheck + lint + full tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all green.

- [ ] **Step 11: Commit**

```bash
git add src/lib/validations/offer.ts src/lib/validations/offer.test.ts src/lib/offers/status.ts src/lib/actions/offers.ts src/components/offers/OfferStatusSelect.tsx src/components/offers/OfferOverview.tsx src/components/offers/OffersTable.tsx
git commit -m "feat(offers): readable status badges + admin lifecycle override"
```

---

## Task 8: Final verification + deploy

- [ ] **Step 1: Full suite**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: all green.

- [ ] **Step 2: Production build**

Run: `rm -rf .next && pnpm build`
Expected: build succeeds (new components compile; no route type drift).

- [ ] **Step 3: Apply migration + deploy edge functions**

```bash
pnpm dlx supabase@latest db push
pnpm dlx supabase@latest functions deploy ingest-source
pnpm dlx supabase@latest functions deploy analyze-offer
```

If the CLI lacks credentials in this environment, hand off as owner steps (or trigger the existing edge-deploy GitHub Actions `workflow_dispatch` for the two functions) and say so explicitly in the summary.

- [ ] **Step 4: Update CLAUDE.md snapshot**

Add to the Current State section: migrations now run 0001-0029 (0029 = user read access to verified facts/source docs); facts ≥70 confidence auto-verify at ingest; offer status auto-advances (needs_source_ingestion → ready_for_analysis → ai_analyzed) with admin override on the offer Overview; admin sidebar link. Commit:

```bash
git add CLAUDE.md
git commit -m "docs: record stage-1 trust fixes in CLAUDE.md snapshot"
```

- [ ] **Step 5: Push the branch**

```bash
git push -u origin claude/install-superpowers-plugin-jw8dqw
```

---

## Out of scope (deliberately)

- Underwriting still reads `verified` facts only — auto-verify (Task 5) is what makes that population non-empty; no prompt or orchestrator changes.
- No changes to user-write RLS on offers (today only admins can insert/update offers at the DB level; the single live user is the admin). Revisit when opening signup beyond stealth.
- `raw_text` of source documents becomes user-readable via 0029's policy (the app only ever selects `url`). It's fetched public page text, not a secret; column-level privacy can come later if needed.
