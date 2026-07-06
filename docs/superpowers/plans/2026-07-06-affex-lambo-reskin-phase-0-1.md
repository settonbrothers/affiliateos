# AFFEX Lamborghini Reskin — Phase 0 + Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the app foundation (tokens, fonts, top-nav layout, primitives) and the two signature screens (`/offers` list + `/offers/[id]` detail) from the AFFEX V8 dark-green theme into the AFFEX "Lamborghini" identity — pure black `#0A0A0A`, Lamborghini-yellow `#F5C518` accent, Oswald + IBM Plex Mono type, sharp zero-radius edges, 13-dimension scorecard.

**Architecture:** Visual layer only. Remap `globals.css` tokens, add two fonts via `next/font`, rewrite the `(app)/layout.tsx` sidebar into a sticky top nav bar, restyle shadcn primitives, then restyle `OffersTable`, `evidence-bars.tsx` (5→13 dims), `OfferVerdict`, and add an always-on analysis hero to the offer detail page. No routes, DB, Zod, orchestrator, lock-rule, or prop-API changes.

**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind v4, shadcn/ui, next-intl (RTL/he), `next/font/google` (Heebo, Oswald, IBM Plex Mono), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-06-affex-lambo-reskin-design.md`
**Pixel source of truth:** `docs/design/affex-lambo/*.dc.html` (+ `README.md`). Open the relevant mock beside each task.

**Branch:** `feat/affex-lambo-reskin` (already created; spec + mocks committed).

---

## Conventions for this plan

- **Visual work is verified, not unit-tested.** Where a task only changes styling, the "test" is: `pnpm typecheck` + `pnpm build` clean, then visual verification against the mock via the preview tools (`preview_inspect` for exact colors/fonts — more reliable than screenshots; `preview_screenshot` for layout). Unit tests (Vitest) are used ONLY for pure logic (verdict→tier map, dimension-label resolution).
- **Windows gotcha:** after any branch switch run `Remove-Item -Recurse -Force .next` before `pnpm typecheck`/`build` (Next leaks route validator types across branches).
- **Never** use PowerShell `>` to write files (UTF-16 corrupts TS). Edits go through the Edit/Write tools.
- Commit after every task with the shown message.

---

## File Structure (what Phase 0+1 touches)

**Phase 0 — Foundation**
- Modify: `src/app/globals.css` — token remap + `--radius:0` + font `@theme` vars.
- Modify: `src/app/layout.tsx` — add Oswald + IBM Plex Mono fonts, put all three `variable`s on `<html>`.
- Modify: `src/app/(app)/layout.tsx` — sidebar → sticky top nav bar.
- Rewrite: `src/components/nav/AppNav.tsx` — vertical → horizontal nav with 2px yellow active underline.
- Modify: `src/components/LanguageToggle.tsx` — bordered mono `EN`/`עב` box.
- Modify: `src/components/ui/button.tsx` — primary yellow/ink, sharp, hover→white; outline restyle.
- Modify: `src/components/ui/card.tsx` — sharp panel, `#0C0C0C`, hairline border.

**Phase 1 — Core screens**
- Create: `src/lib/offers/verdict-tier.ts` — verdict→tier map (pure logic, tested).
- Create: `src/lib/offers/verdict-tier.test.ts` — Vitest.
- Modify: `messages/he.json` + `messages/en.json` — add 13 dimension labels.
- Rewrite: `src/components/crack-score/evidence-bars.tsx` — 5→13 dims, yellow-at-peak, Oswald score.
- Modify: `src/components/offers/OfferVerdict.tsx` — tiered chip.
- Rewrite: `src/components/offers/OffersTable.tsx` — dense rows, giant per-row Crack Score, verdict chip, HOT/NEW, filter tabs.
- Modify: `src/app/(app)/offers/page.tsx` — header (mono kicker + Heebo 800 title + counts) + "הוספת הצעה +" CTA.
- Modify: `src/app/(app)/offers/[id]/page.tsx` — add always-on analysis hero; restyle header/breadcrumb.
- Modify: `src/components/wizard/CampaignWizard.tsx` — 8 stepper tiles per mock.

---

# PHASE 0 — FOUNDATION

### Task 0.1: Token remap in `globals.css`

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace the `:root` token block and add font `@theme` vars**

Replace the `@theme inline { … }` block's font line and the `:root` block. In `@theme inline`, keep `--font-sans` and add two lines after it:

```css
  --font-sans: var(--font-heebo), ui-sans-serif, system-ui, sans-serif;
  --font-display: var(--font-oswald), ui-sans-serif, sans-serif;
  --font-mono: var(--font-plex-mono), ui-monospace, monospace;
```

Replace the whole `:root { … }` block with:

```css
:root {
  --radius: 0; /* AFFEX Lambo: sharp corners (drives shadcn --radius-sm/md/lg) */

  /* Backgrounds */
  --background:  #0A0A0A;
  --sidebar-bg:  #0A0A0A;
  --card:        #0C0C0C;
  --card-elevated: #0E0E0E;
  --hover-bg:    #121212;

  /* Text */
  --foreground:         #FFFFFF;
  --card-foreground:    #FFFFFF;
  --text-secondary:     #C9C9C7;
  --muted-foreground:   #8A8A88;
  --muted-fainter:      #6E6E6C;
  --muted-faint:        #5E5E5C;
  --muted:              #0C0C0C;

  /* Brand — Lamborghini Giallo */
  --primary:            #F5C518;
  --primary-foreground: #0A0A0A;
  --ring:               #F5C518;

  /* Accent-on-dark tints */
  --accent-fill:   rgba(245, 197, 24, 0.06);
  --accent-border: rgba(245, 197, 24, 0.40);
  --accent-glow:   rgba(245, 197, 24, 0.55);

  /* Structure */
  --border:      rgba(255, 255, 255, 0.09);
  --shadow:      0 4px 24px rgba(0, 0, 0, 0.45);
  --transition:  180ms cubic-bezier(0.2, 0.9, 0.1, 1);

  /* Amber — reserve for compliance cap / human-review only */
  --amber-bg:     rgba(245, 158, 11, 0.07);
  --amber-border: rgba(245, 158, 11, 0.18);
  --amber-text:   #fbbf24;

  /* Spacing (8-point grid) */
  --space-1: 8px;
  --space-2: 16px;
  --space-3: 24px;
  --space-4: 32px;
  --space-5: 40px;
  --space-6: 48px;
  --space-8: 64px;

  /* Layout */
  --nav-height:      62px;
  --space-internal:  24px;
  --space-section:   40px;
}
```

- [ ] **Step 2: Add a global focus ring in `@layer base`**

In the `@layer base { … }` block, after the `body { … }` rule, add:

```css
  :focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px #0A0A0A, 0 0 0 4px var(--primary);
  }
```

- [ ] **Step 3: Verify build**

Run: `Remove-Item -Recurse -Force .next; pnpm typecheck`
Expected: no errors (the `--sidebar-width` var was removed — Step handled in Task 0.3; if typecheck flags nothing, CSS vars are untyped so this passes regardless).

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(reskin): AFFEX Lambo token remap — yellow, pure black, sharp edges"
```

---

### Task 0.2: Add Oswald + IBM Plex Mono fonts

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Import and configure the two fonts**

Replace the Heebo import block with:

```tsx
import { Heebo, Oswald, IBM_Plex_Mono } from 'next/font/google'
```

and below the existing `heebo` declaration add:

```tsx
const oswald = Oswald({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-oswald',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
})
```

- [ ] **Step 2: Put all three variables on `<html>`**

Change the `<html>` className:

```tsx
    <html
      lang={locale}
      dir={dir}
      className={`${heebo.variable} ${oswald.variable} ${plexMono.variable}`}
    >
```

- [ ] **Step 3: Verify fonts load**

Run: `pnpm dev` (background), then use `preview_start` for `dev`, open `/offers`, and `preview_eval` with:
`getComputedStyle(document.documentElement).getPropertyValue('--font-oswald')`
Expected: a non-empty font-family string containing `Oswald`.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(reskin): load Oswald (display) + IBM Plex Mono (mono) fonts"
```

---

### Task 0.3: Sidebar → sticky top nav bar

**Files:**
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Replace the `aside` layout with a top nav header**

Replace the entire `return ( … )` of `AppLayout` with:

```tsx
  return (
    <div className="flex min-h-screen flex-col">
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 'var(--nav-height)',
          padding: '0 clamp(20px,3vw,44px)',
          background: 'rgba(10,10,10,0.9)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(20px,3vw,44px)' }}>
          {/* Wordmark */}
          <div dir="ltr" style={{ display: 'flex', alignItems: 'baseline', gap: '1px' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '21px', fontWeight: 700 }}>AFF</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '21px', fontWeight: 700, color: 'var(--primary)' }}>EX</span>
          </div>
          <AppNav items={navItems} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(14px,2vw,22px)' }}>
          {/* Credits pill */}
          <div dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: '7px', fontFamily: 'var(--font-mono)' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--primary)',
              }}
            />
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#E4E4E2' }}>{balance ?? '—'}</span>
            <span style={{ fontSize: '10px', letterSpacing: '0.08em', color: '#7A7A78' }}>CR</span>
          </div>
          <LanguageToggle />
        </div>
      </header>
      <main className="flex-1 overflow-auto" style={{ padding: 'clamp(28px,4vw,52px) clamp(20px,4vw,64px) 40px' }}>
        <div style={{ maxWidth: '1500px', margin: '0 auto', width: '100%' }}>{children}</div>
      </main>
    </div>
  )
```

Note: keep the existing top-of-function data fetching (`user`, `isOnboarded`, `balance`, `isAdmin`, `t`, `navItems`) unchanged. Remove the now-unused sidebar markup only.

- [ ] **Step 2: Verify layout**

Run: preview `/offers`; `preview_screenshot`. Expected: black top bar, `AFFEX` wordmark on the right (RTL start), horizontal nav, credits pill + `EN` on the left. No left sidebar.
`preview_inspect` on `header` → `height` should be `62px`, `borderBottom` visible.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/layout.tsx"
git commit -m "feat(reskin): replace left sidebar with sticky top nav bar"
```

---

### Task 0.4: Horizontal `AppNav` with yellow active underline

**Files:**
- Rewrite: `src/components/nav/AppNav.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItemProps {
  href: string
  label: string
}

function NavItem({ href, label }: NavItemProps) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className="navlink"
      style={{
        position: 'relative',
        display: 'inline-block',
        padding: '0 0 20px',
        fontSize: '13.5px',
        fontWeight: 500,
        textDecoration: 'none',
        color: active ? 'var(--foreground)' : '#7A7A78',
        transition: 'color 0.2s',
      }}
    >
      {label}
      {active && (
        <span
          style={{
            position: 'absolute',
            insetInline: 0,
            bottom: 'calc(-1 * ((var(--nav-height) - 20px) / 2) + 10px)',
            height: '2px',
            background: 'var(--primary)',
          }}
        />
      )}
    </Link>
  )
}

interface AppNavProps {
  items: NavItemProps[]
}

export function AppNav({ items }: AppNavProps) {
  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 'clamp(16px,2vw,30px)' }}>
      {items.map((item) => (
        <NavItem key={item.href} href={item.href} label={item.label} />
      ))}
    </nav>
  )
}
```

- [ ] **Step 2: Add the `.navlink:hover` rule to `globals.css`**

In `src/app/globals.css`, after the `@layer base { … }` block add:

```css
.navlink:hover { color: #FFFFFF !important; }
```

- [ ] **Step 3: Verify**

Run: preview `/offers`. Expected: active item (`AI Picks`) white + Oswald + 2px yellow underline flush with the nav bar's bottom border; inactive items `#7A7A78`, hover → white. `preview_inspect` the active link's underline span → `background` `rgb(245, 197, 24)`.

- [ ] **Step 4: Commit**

```bash
git add src/components/nav/AppNav.tsx src/app/globals.css
git commit -m "feat(reskin): horizontal AppNav with yellow active underline"
```

---

### Task 0.5: LanguageToggle bordered mono box

**Files:**
- Modify: `src/components/LanguageToggle.tsx`

- [ ] **Step 1: Replace the `style` object of the `<button>`**

```tsx
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '10.5px',
        color: 'var(--muted-foreground)',
        background: 'transparent',
        border: '1px solid rgba(255,255,255,0.16)',
        cursor: 'pointer',
        padding: '3px 8px',
        opacity: isPending ? 0.5 : 1,
        transition: 'var(--transition)',
      }}
```

- [ ] **Step 2: Verify + commit**

Run: preview `/offers`; confirm the `EN` box is a bordered mono chip (sharp corners). Then:

```bash
git add src/components/LanguageToggle.tsx
git commit -m "feat(reskin): LanguageToggle bordered mono box"
```

---

### Task 0.6: Restyle shadcn Button + Card primitives

**Files:**
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/card.tsx`

- [ ] **Step 1: Sharpen Button variants**

In `button.tsx`, replace the `cva` base string's `rounded-md` with `rounded-none`, and replace the `variants.variant` block with:

```tsx
      variant: {
        default:
          'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] font-bold hover:bg-white',
        outline:
          'border border-[rgba(255,255,255,0.24)] bg-transparent text-white hover:bg-[var(--hover-bg)]',
        ghost: 'hover:bg-[var(--hover-bg)]',
      },
```

Also change `size.sm` and `size.lg` to use `rounded-none` (replace their `rounded-md`).

- [ ] **Step 2: Sharpen Card**

Open `src/components/ui/card.tsx`. On the root `Card` element's className, replace any `rounded-*` with `rounded-none`, ensure `bg-[var(--color-card)]` and `border-[var(--color-border)]` (add if the current card uses different tokens). Do not change the sub-components' structure/props.

- [ ] **Step 3: Verify**

Run: `Remove-Item -Recurse -Force .next; pnpm typecheck; pnpm build`
Expected: clean. Preview any page with a primary button (e.g. `/offers` header after Phase 1, or `/offers/new`); `preview_inspect` a primary button → `borderRadius` `0px`, `backgroundColor` `rgb(245, 197, 24)`.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/button.tsx src/components/ui/card.tsx
git commit -m "feat(reskin): sharpen Button + Card (radius 0, yellow primary)"
```

---

### Task 0.7: Phase 0 checkpoint

- [ ] **Step 1: Full build + visual sweep**

Run: `Remove-Item -Recurse -Force .next; pnpm typecheck; pnpm lint; pnpm build`
Expected: all clean.

- [ ] **Step 2: Visual confirmation**

Preview `/offers`. Confirm against `docs/design/affex-lambo/AFFEX AI Picks.dc.html` header/nav chrome: pure-black bg, top nav bar, yellow wordmark `EX`, mono credits pill. (The table body is restyled in Phase 1.)

---

# PHASE 1 — CORE SCREENS

### Task 1.1: Verdict→tier pure logic (TDD)

**Files:**
- Create: `src/lib/offers/verdict-tier.ts`
- Test: `src/lib/offers/verdict-tier.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { verdictTier } from './verdict-tier'

describe('verdictTier', () => {
  it('maps top verdicts to hi', () => {
    expect(verdictTier('high_ceiling_opportunity')).toBe('hi')
    expect(verdictTier('strategic_opportunity')).toBe('hi')
    expect(verdictTier('strong_test')).toBe('hi')
  })
  it('maps middle verdicts to mid', () => {
    expect(verdictTier('small_paid_test')).toBe('mid')
    expect(verdictTier('watch')).toBe('mid')
  })
  it('maps low verdicts to low', () => {
    expect(verdictTier('reject')).toBe('low')
    expect(verdictTier('organic_only')).toBe('low')
    expect(verdictTier('seo_review_only')).toBe('low')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test verdict-tier`
Expected: FAIL — cannot find module `./verdict-tier`.

- [ ] **Step 3: Implement**

```ts
import type { Verdict } from '@/types/agents/underwriting'

export type VerdictTier = 'hi' | 'mid' | 'low'

const TIER: Record<Verdict, VerdictTier> = {
  reject: 'low',
  organic_only: 'low',
  seo_review_only: 'low',
  watch: 'mid',
  small_paid_test: 'mid',
  strong_test: 'hi',
  strategic_opportunity: 'hi',
  high_ceiling_opportunity: 'hi',
}

export function verdictTier(verdict: Verdict): VerdictTier {
  return TIER[verdict]
}

/** CSS for a verdict chip by tier (matches AFFEX Lambo mock). */
export function verdictChipStyle(tier: VerdictTier): React.CSSProperties {
  if (tier === 'hi')
    return { color: 'var(--primary)', border: '1px solid var(--accent-border)', background: 'var(--accent-fill)' }
  if (tier === 'mid')
    return { color: '#E4E4E2', border: '1px solid rgba(255,255,255,0.16)', background: 'transparent' }
  return { color: '#8A8A88', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent' }
}

export function verdictDotColor(tier: VerdictTier): string {
  return tier === 'hi' ? 'var(--primary)' : tier === 'mid' ? '#B0B0AE' : '#5E5E5C'
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test verdict-tier`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/offers/verdict-tier.ts src/lib/offers/verdict-tier.test.ts
git commit -m "feat(reskin): verdict→tier mapping + chip styles"
```

---

### Task 1.2: 13 Hebrew dimension labels in i18n

**Files:**
- Modify: `messages/he.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Add a `dimensions` block to `he.json`**

Add under a top-level `"dimensions"` key (place it near the other domain blocks, e.g. after `"offers"`):

```json
  "dimensions": {
    "economics": "כלכלה",
    "demand": "ביקוש",
    "competition": "תחרות",
    "creative_opportunity": "הזדמנות קריאייטיב",
    "funnel_fit": "התאמת פאנל",
    "compliance": "רגולציה",
    "operator_fit": "התאמת מפעיל",
    "data_confidence": "ביטחון נתונים",
    "offer_trust": "אמון בהצעה",
    "scale_potential": "פוטנציאל סקייל",
    "cashflow_fit": "התאמת תזרים",
    "high_ceiling_potential": "תקרה גבוהה",
    "execution_complexity": "מורכבות ביצוע"
  },
```

- [ ] **Step 2: Add the English mirror to `en.json`**

```json
  "dimensions": {
    "economics": "Economics",
    "demand": "Demand",
    "competition": "Competition",
    "creative_opportunity": "Creative Opportunity",
    "funnel_fit": "Funnel Fit",
    "compliance": "Compliance",
    "operator_fit": "Operator Fit",
    "data_confidence": "Data Confidence",
    "offer_trust": "Offer Trust",
    "scale_potential": "Scale Potential",
    "cashflow_fit": "Cashflow Fit",
    "high_ceiling_potential": "High-Ceiling Potential",
    "execution_complexity": "Execution Complexity"
  },
```

- [ ] **Step 3: Verify JSON parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/he.json','utf8')); JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add messages/he.json messages/en.json
git commit -m "feat(reskin): 13 scorecard dimension labels (he/en)"
```

---

### Task 1.3: EvidenceBars — 5 → 13 dimensions

**Files:**
- Rewrite: `src/components/crack-score/evidence-bars.tsx`

Open `docs/design/affex-lambo/AFFEX Offer.dc.html` (the "13 evidence bars" grid + Crack Score) for reference.

- [ ] **Step 1: Rewrite the component**

```tsx
'use client'

import { useTranslations } from 'next-intl'

import {
  SCORE_DIMENSION_LABELS,
  type ScoreDimensions,
} from '@/types/agents/underwriting'

interface EvidenceBarsProps {
  scores: ScoreDimensions | null | undefined
  weightedScore: number | null | undefined
  size?: 'full' | 'mini'
}

// Render order = SCORE_DIMENSION_LABELS key order (13 dims).
const DIM_KEYS = Object.keys(SCORE_DIMENSION_LABELS) as (keyof ScoreDimensions)[]

function scoreColor(v: number): string {
  if (v >= 80) return 'var(--primary)'
  if (v >= 65) return '#FFFFFF'
  return '#6E6E6C'
}

export function EvidenceBars({ scores, weightedScore, size = 'full' }: EvidenceBarsProps) {
  const t = useTranslations('dimensions')
  const isMini = size === 'mini'

  if (!scores || weightedScore == null) {
    return (
      <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', padding: '8px 0' }}>
        Run an analysis to see the Crack Score.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMini ? '16px' : '24px' }}>
      {/* Crack Score number */}
      <div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--muted-foreground)',
            marginBottom: '4px',
          }}
        >
          Crack Score
        </div>
        <div dir="ltr" style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: isMini ? '48px' : 'clamp(90px,13vw,160px)',
              fontWeight: 600,
              lineHeight: 0.8,
              letterSpacing: '-0.01em',
              color: scoreColor(weightedScore),
            }}
          >
            {weightedScore}
          </span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: isMini ? '16px' : '28px', color: '#4E4E4C' }}>
            /100
          </span>
        </div>
      </div>

      {/* 13 bars, 2-col grid */}
      <div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--muted-foreground)',
            marginBottom: '16px',
          }}
        >
          THE EVIDENCE · 13 DIMENSIONS
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMini ? '1fr' : '1fr 1fr',
            gap: '12px 26px',
          }}
        >
          {DIM_KEYS.map((key) => {
            const v = scores[key]
            const strong = v >= 80
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    width: '96px',
                    fontSize: '11.5px',
                    color: strong ? 'var(--text-secondary)' : 'var(--muted-foreground)',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {t(key)}
                </span>
                <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${v}%`,
                      height: '100%',
                      background: strong ? 'var(--primary)' : '#4A4A48',
                      transition: 'var(--transition)',
                    }}
                  />
                </div>
                <span
                  dir="ltr"
                  style={{
                    width: '26px',
                    textAlign: 'left',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: strong ? 'var(--primary)' : 'var(--muted-foreground)',
                    flexShrink: 0,
                  }}
                >
                  {v}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build + render**

Run: `Remove-Item -Recurse -Force .next; pnpm typecheck`
Expected: clean. Then preview an analyzed offer's scorecard tab (`/offers/<id>?tab=scorecard`) and confirm 13 labelled bars in a 2-col grid, giant Oswald score, yellow only on `>=80` dims. `preview_inspect` a `>=80` bar fill → `backgroundColor` `rgb(245, 197, 24)`.

- [ ] **Step 3: Commit**

```bash
git add src/components/crack-score/evidence-bars.tsx
git commit -m "feat(reskin): EvidenceBars renders all 13 dimensions, yellow-at-peak"
```

---

### Task 1.4: Tiered verdict chip

**Files:**
- Modify: `src/components/offers/OfferVerdict.tsx`

- [ ] **Step 1: Replace the badge with a tiered chip**

Add imports at top:

```tsx
import { verdictTier, verdictChipStyle, verdictDotColor } from '@/lib/offers/verdict-tier'
```

Replace the `<Badge style={GRAY_BADGE}>…</Badge>` block (and delete the `GRAY_BADGE` const + the unused `Badge` import) with:

```tsx
        {(() => {
          const tier = verdictTier(p.verdict)
          return (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '9px',
                padding: '9px 16px',
                fontSize: '14px',
                fontWeight: 700,
                ...verdictChipStyle(tier),
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: verdictDotColor(tier) }} />
              {VERDICT_LABELS[p.verdict]}
            </span>
          )
        })()}
```

- [ ] **Step 2: Verify**

Run: `Remove-Item -Recurse -Force .next; pnpm typecheck`
Expected: clean (no unused `Badge`/`GRAY_BADGE`). Preview a high-verdict offer → yellow chip on faint yellow fill; a `reject` offer → grey chip.

- [ ] **Step 3: Commit**

```bash
git add src/components/offers/OfferVerdict.tsx
git commit -m "feat(reskin): tiered verdict chip (yellow/white/grey)"
```

---

### Task 1.5: OffersTable — dense rows + filters

**Files:**
- Rewrite: `src/components/offers/OffersTable.tsx`

Open `docs/design/affex-lambo/AFFEX AI Picks.dc.html` for the exact row grid, column header, filter tabs, and per-row Crack Score / verdict chip / HOT-NEW tag styling. Reproduce that structure with the real `Offer[]` data. Illustrative-only fields in the mock (momentum, payout string) render as `—` when the real data is absent (payout is currently unavailable — keep the `—` dash the existing table uses).

- [ ] **Step 1: Rewrite the component**

Requirements (translate the mock's inline styles into this component; keep it a client component using `useTranslations('offers')`):
- Client-side filter tabs: `הכל` / `מומלצות` (score≥80) / `חמות` (`trending_signal==='rising'`) / `חדשות` (no `evaluation`). Active tab: white text + 2px yellow underline; inactive `#7A7A78`.
- Column header row (mono uppercase `#5E5E5C`, `font-size:9.5px`): `#` · `OFFER` · `VERTICAL` · `PAYOUT` · `VERDICT` · `CRACK SCORE` (drop `MOM.` since real momentum data is not present).
- Each row is a `Link` to `/offers/${offer.id}` styled as a grid row: rank (mono, `#5E5E5C`, `01`-padded), offer name (Oswald 20px, `dir="ltr"`) + `website_url` beneath (mono `#6E6E6C`), `HOT` tag when `trending_signal==='rising'` (ink on yellow), `NEW` tag when no evaluation (yellow, yellow border), vertical (Heebo `#9A9A98`), payout (`—`), verdict chip via `verdictTier`/`verdictChipStyle` when `evaluation.payload.verdict` exists else `—`, and the giant Crack Score (Oswald 42px, `scoreColor` from Task 1.3 logic — reuse the `>=80` yellow / `65-79` white / `<65` grey thresholds; `/100` suffix `#4E4E4C`).
- Row hover: bg `#121212` + a 2px yellow leading edge (`inset-inline-start`). Use a `.prow` class + the hover rules already present in `globals.css`? They are NOT — add these to `globals.css`:

```css
.prow { transition: background 0.18s ease; position: relative; }
.prow:hover { background: #121212 !important; }
.prow:hover .pedge { transform: scaleY(1) !important; }
```

Full component:

```tsx
'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { verdictTier, verdictChipStyle, verdictDotColor } from '@/lib/offers/verdict-tier'
import { VERDICT_LABELS } from '@/types/agents/underwriting'
import type { Offer } from '@/types/db'

type FilterKey = 'all' | 'rec' | 'hot' | 'new'

function scoreColor(v: number): string {
  if (v >= 80) return 'var(--primary)'
  if (v >= 65) return '#FFFFFF'
  return '#6E6E6C'
}

const GRID = '40px minmax(120px,1.4fr) 96px 106px 150px 150px'

export function OffersTable({ offers }: { offers: Offer[] }) {
  const t = useTranslations('offers')
  const [filter, setFilter] = useState<FilterKey>('all')

  const isRising = (o: Offer) => (o as { trending_signal?: string }).trending_signal === 'rising'
  const scoreOf = (o: Offer) => o.evaluation?.payload?.weighted_score ?? null

  const passes = (o: Offer) => {
    if (filter === 'all') return true
    if (filter === 'rec') return (scoreOf(o) ?? 0) >= 80
    if (filter === 'hot') return isRising(o)
    return scoreOf(o) == null // 'new'
  }
  const list = offers.filter(passes)

  const filters: { key: FilterKey; label: string; dot?: boolean }[] = [
    { key: 'all', label: t('filterAll') },
    { key: 'rec', label: t('filterRecommended') },
    { key: 'hot', label: t('filterHot'), dot: true },
    { key: 'new', label: t('filterNew') },
  ]

  return (
    <div>
      {/* Filter tabs */}
      <div
        style={{
          display: 'flex',
          gap: 'clamp(18px,2vw,30px)',
          borderBottom: '1px solid var(--border)',
          marginBottom: '4px',
        }}
      >
        {filters.map((f) => {
          const active = filter === f.key
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              style={{
                position: 'relative',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '0 0 14px',
                fontSize: '14px',
                fontWeight: 600,
                color: active ? '#FFFFFF' : '#7A7A78',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
              }}
            >
              {f.dot && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--primary)' }} />}
              {f.label}
              {active && (
                <span style={{ position: 'absolute', insetInline: 0, bottom: '-1px', height: '2px', background: 'var(--primary)' }} />
              )}
            </button>
          )
        })}
      </div>

      {list.length === 0 ? (
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: 'var(--muted-foreground)' }}>{t('empty')}</p>
        </div>
      ) : (
        <>
          {/* Column header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: GRID,
              alignItems: 'center',
              gap: '16px',
              padding: '16px 12px 12px',
              fontFamily: 'var(--font-mono)',
              fontSize: '9.5px',
              letterSpacing: '0.12em',
              color: '#5E5E5C',
            }}
          >
            <span>#</span>
            <span>{t('colName')}</span>
            <span>VERTICAL</span>
            <span>PAYOUT</span>
            <span>VERDICT</span>
            <span style={{ color: 'var(--accent-border)' }}>CRACK SCORE</span>
          </div>

          <div style={{ borderTop: '1px solid var(--border)' }}>
            {list.map((offer, i) => {
              const score = scoreOf(offer)
              const verdict = offer.evaluation?.payload?.verdict ?? null
              const tier = verdict ? verdictTier(verdict) : null
              const vertical = (offer as { vertical?: string }).vertical
              return (
                <Link
                  key={offer.id}
                  href={`/offers/${offer.id}`}
                  className="prow"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: GRID,
                    alignItems: 'center',
                    gap: '16px',
                    padding: '18px 12px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <span
                    className="pedge"
                    style={{
                      position: 'absolute',
                      insetInlineStart: 0,
                      top: '10px',
                      bottom: '10px',
                      width: '2px',
                      background: 'var(--primary)',
                      transform: 'scaleY(0)',
                      transformOrigin: 'center',
                      transition: 'transform 0.2s ease',
                    }}
                  />
                  <span dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: i === 0 ? 'var(--primary)' : '#5E5E5C', textAlign: 'right' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span dir="ltr" style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {offer.name}
                      </span>
                      {isRising(offer) && (
                        <span dir="ltr" style={{ flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '8.5px', letterSpacing: '0.06em', color: '#0A0A0A', background: 'var(--primary)', padding: '2px 6px' }}>▲ HOT</span>
                      )}
                      {score == null && (
                        <span dir="ltr" style={{ flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '8.5px', letterSpacing: '0.06em', color: 'var(--primary)', border: '1px solid var(--accent-border)', padding: '2px 6px' }}>NEW</span>
                      )}
                    </div>
                    {offer.website_url && (
                      <div dir="ltr" style={{ marginTop: '4px', fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: '#6E6E6C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' }}>
                        {offer.website_url}
                      </div>
                    )}
                  </div>

                  <span style={{ fontSize: '13px', color: '#9A9A98' }}>{vertical ?? '—'}</span>

                  <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '13px' }}>—</span>

                  {tier && verdict ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', justifySelf: 'start', fontSize: '12px', fontWeight: 600, padding: '5px 11px', whiteSpace: 'nowrap', ...verdictChipStyle(tier) }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: verdictDotColor(tier) }} />
                      {VERDICT_LABELS[verdict]}
                    </span>
                  ) : (
                    <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '13px' }}>—</span>
                  )}

                  <div dir="ltr" style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '42px', fontWeight: 600, lineHeight: 0.8, color: score == null ? '#4E4E4C' : scoreColor(score) }}>
                      {score ?? '—'}
                    </span>
                    {score != null && <span style={{ fontFamily: 'var(--font-display)', fontSize: '14px', color: '#4E4E4C' }}>/100</span>}
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add the 4 filter labels to i18n**

In `messages/he.json` `"offers"` block add: `"filterAll": "הכל"`, `"filterRecommended": "מומלצות"`, `"filterHot": "חמות"`, `"filterNew": "חדשות"`. In `messages/en.json` `"offers"` block add the English mirror (`"All"`, `"Recommended"`, `"Hot"`, `"New"`).

- [ ] **Step 3: Verify**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/he.json','utf8'));JSON.parse(require('fs').readFileSync('messages/en.json','utf8'));console.log('ok')"` → `ok`.
Run: `Remove-Item -Recurse -Force .next; pnpm typecheck` → clean.
Preview `/offers`: dense rows, giant Crack Score per row, filter tabs switch client-side, hover shows yellow leading edge. Compare to `AFFEX AI Picks.dc.html`.

- [ ] **Step 4: Commit**

```bash
git add src/components/offers/OffersTable.tsx src/app/globals.css messages/he.json messages/en.json
git commit -m "feat(reskin): OffersTable dense rows + filter tabs + per-row Crack Score"
```

---

### Task 1.6: Offers page header

**Files:**
- Modify: `src/app/(app)/offers/page.tsx`

Open `docs/design/affex-lambo/AFFEX AI Picks.dc.html` header block for reference.

- [ ] **Step 1: Restyle the page header**

Replace the page's header markup (the title/subtitle area above `<OffersTable/>`) with a header matching the mock: a mono kicker (`TODAY'S OPPORTUNITIES`, `--primary`, `letter-spacing:0.22em`), a Heebo-800 headline (`t('title')`, `font-size:clamp(34px,5vw,56px)`, `line-height:0.95`), a mono counts line (`<n> OFFERS · <n> SCORED · <n> HOT`, `dir="ltr"`), and a primary CTA `הוספת הצעה +` (Link to `/offers/new`, styled as the yellow primary button). Keep the existing server-side data fetch (`listOffers`) and the counts derivation from the real array (`offers.length`, count with `evaluation`, count with `trending_signal==='rising'`).

Exact header JSX (place above `<OffersTable offers={offers} />`, keep imports for `getTranslations`, `Link`, `listOffers`):

```tsx
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap', marginBottom: 'clamp(24px,3vw,38px)' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.22em', color: 'var(--primary)', marginBottom: '12px' }}>
            TODAY&apos;S OPPORTUNITIES
          </div>
          <h1 style={{ margin: 0, fontSize: 'clamp(34px,5vw,56px)', fontWeight: 800, lineHeight: 0.95, letterSpacing: '-0.01em' }}>
            {t('title')}
          </h1>
          <div dir="ltr" style={{ marginTop: '14px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#7A7A78', display: 'flex', gap: '14px', justifyContent: 'flex-end' }}>
            <span><span style={{ color: '#C9C9C7' }}>{offers.length}</span> OFFERS</span>
            <span style={{ color: '#3A3A38' }}>·</span>
            <span><span style={{ color: 'var(--primary)' }}>{scoredCount}</span> SCORED</span>
            <span style={{ color: '#3A3A38' }}>·</span>
            <span><span style={{ color: 'var(--primary)' }}>{hotCount}</span> HOT</span>
          </div>
        </div>
        <Link href="/offers/new" style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 700, color: '#0A0A0A', background: 'var(--primary)', padding: '12px 22px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
          {t('addOffer')} +
        </Link>
      </div>
```

Add before the `return`, deriving counts:

```tsx
  const scoredCount = offers.filter((o) => o.evaluation?.payload?.weighted_score != null).length
  const hotCount = offers.filter((o) => (o as { trending_signal?: string }).trending_signal === 'rising').length
```

Add `"addOffer": "הוספת הצעה"` to `he.json` `"offers"` and `"Add offer"` to `en.json` `"offers"` (verify `t('title')` already exists; if not, add `"title"`).

- [ ] **Step 2: Verify + commit**

Run: JSON parse check + `Remove-Item -Recurse -Force .next; pnpm typecheck` → clean. Preview `/offers`, compare header to mock.

```bash
git add "src/app/(app)/offers/page.tsx" messages/he.json messages/en.json
git commit -m "feat(reskin): offers page header (kicker, headline, counts, CTA)"
```

---

### Task 1.7: Offer detail — analysis hero + header

**Files:**
- Modify: `src/app/(app)/offers/[id]/page.tsx`

Open `docs/design/affex-lambo/AFFEX Offer.dc.html` for the breadcrumb, offer header, and analysis hero (score+verdict left, 13 bars right, reasons + kill criteria row).

- [ ] **Step 1: Restyle the offer header + add a breadcrumb**

Replace the header `<div className="flex items-start justify-between">…</div>` (lines ~153-173) with a mock-faithful header: a mono breadcrumb (`‹ AI PICKS / <NAME>`), an Oswald offer name (`dir="ltr"`, `clamp(40px,6vw,72px)`), a mono meta line (`website_url · vertical · payout`), and the `AnalyzeButton` styled as an outline button on the left. Keep the `isAdmin` "manage sources" link. Keep `AnalyzeButton` props unchanged.

```tsx
      <div dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.1em', color: '#6E6E6C' }}>
        ‹ AI PICKS&nbsp;<span style={{ color: '#3A3A38' }}>/</span>&nbsp;<span style={{ color: '#9A9A98' }}>{offer.name.toUpperCase()}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
        <div>
          <h1 dir="ltr" style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'clamp(40px,6vw,72px)', fontWeight: 600, lineHeight: 0.9, letterSpacing: '0.01em', textAlign: 'right' }}>
            {offer.name}
          </h1>
          {offer.website_url && (
            <div dir="ltr" style={{ marginTop: '12px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#7A7A78' }}>
              {offer.website_url}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link href={`/admin/offers/${offer.id}/sources`} className="text-sm text-[var(--color-muted-foreground)] underline">
              {t('manageSources')}
            </Link>
          )}
          <AnalyzeButton offerId={offer.id} initialStatus={run?.status ?? null} initialRunId={run?.id ?? null} />
        </div>
      </div>
```

- [ ] **Step 2: Add an always-on analysis hero above the wizard**

Between the header block and `<CampaignWizard …>`, insert a hero that renders ONLY when `evaluation?.payload` exists. Left column: `EvidenceBars` score + verdict chip (reuse `OfferVerdict`'s chip by rendering `<OfferVerdict evaluation={evaluation} />` — or, to match the mock's compact hero, render just the score + `<EvidenceBars/>`). To keep scope tight and avoid duplicating verdict internals, render the hero as a bordered panel wrapping `<EvidenceBars scores={evaluation.payload.scores} weightedScore={evaluation.payload.weighted_score} />` in a 2-col grid with a right-side reasons/kill panel. Import `EvidenceBars`:

```tsx
import { EvidenceBars } from '@/components/crack-score/evidence-bars'
```

Insert:

```tsx
      {evaluation?.payload && (
        <div style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'radial-gradient(90% 130% at 22% 0%, #17140A 0%, #0C0C0C 62%)', padding: 'clamp(24px,3vw,40px)' }}>
          <EvidenceBars scores={evaluation.payload.scores} weightedScore={evaluation.payload.weighted_score} />
        </div>
      )}
```

Note: the `scorecard`/`verdict` tabs remain reachable (routes unchanged); the hero simply surfaces the score permanently per the mock. Do not remove any existing tab branch.

- [ ] **Step 3: Verify**

Run: `Remove-Item -Recurse -Force .next; pnpm typecheck` → clean. Preview `/offers/<analyzed-id>`: Oswald name, breadcrumb, and an always-visible hero panel with the giant score + 13 bars. Compare to `AFFEX Offer.dc.html`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/offers/[id]/page.tsx"
git commit -m "feat(reskin): offer detail — Oswald header, breadcrumb, always-on analysis hero"
```

---

### Task 1.8: CampaignWizard 8-step stepper tiles

**Files:**
- Modify: `src/components/wizard/CampaignWizard.tsx`

Open `docs/design/affex-lambo/AFFEX Offer.dc.html` "PIPELINE STEPPER" for the tile styling. Keep the `WizardStep` prop API and `Link`/`href` navigation exactly (do not switch to client-state).

- [ ] **Step 1: Restyle the stepper row**

Replace the stepper markup (the `steps.map(...)` block that renders each step label) with mock-faithful tiles: a horizontal scroll row (`display:flex; gap:8px; overflow-x:auto`), each tile `min-width:118px`, bordered `#0C0C0C`; number box (26×26, mono) — filled yellow + `✓` when `isComplete`, yellow border when `isActive`, dim when `isLocked`; an Oswald English caption is not available (steps only carry `label`), so render `label` (Heebo) as the tile title and the padded index / `✓` / `🔒` as the mark; active tile gets a 2px yellow underline; locked tiles are `#090909`, dim, non-linked with a `🔒`. Preserve the "THE PIPELINE — <done>/<total> COMPLETE" heading using `completedCount`/`totalCount` props (add the heading if not present, styled mono).

Concrete tile (inside the existing `.map`, replacing the per-step content; keep the `step.isLocked ? stepContent : <Link href={step.href}>{stepContent}</Link>` wrapper):

```tsx
          const stepContent = (
            <div
              className={cn('step', step.isActive && 'is-active', step.isLocked && 'cursor-not-allowed')}
              style={{
                flex: 1,
                minWidth: '118px',
                border: `1px solid ${step.isActive ? 'var(--accent-border)' : 'var(--border)'}`,
                background: step.isActive ? 'var(--accent-fill)' : step.isLocked ? '#090909' : '#0C0C0C',
                padding: '14px 14px 16px',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '26px',
                    height: '26px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: step.isComplete ? '#0A0A0A' : step.isLocked ? '#5E5E5C' : step.isActive ? 'var(--primary)' : '#C9C9C7',
                    background: step.isComplete ? 'var(--primary)' : 'transparent',
                    border: `1px solid ${step.isComplete || step.isActive ? 'var(--primary)' : 'rgba(255,255,255,0.18)'}`,
                  }}
                >
                  {step.isComplete ? '✓' : String(index + 1).padStart(2, '0')}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: step.isLocked ? '#4E4E4C' : '#6E6E6C' }}>
                  {step.isLocked ? '🔒' : step.isComplete ? '' : '›'}
                </span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: step.isLocked ? '#6E6E6C' : '#FFFFFF' }}>{step.label}</div>
              {step.isActive && <span style={{ position: 'absolute', insetInline: 0, bottom: '-1px', height: '2px', background: 'var(--primary)' }} />}
            </div>
          )
```

Change the row container to `style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}` and ensure `cn` is imported (`import { cn } from '@/lib/utils'` — likely already present).

- [ ] **Step 2: Verify**

Run: `Remove-Item -Recurse -Force .next; pnpm typecheck` → clean. Preview `/offers/<id>`: 8 tiles, done=yellow✓ box, active=yellow underline, locked=dim+🔒. Click an unlocked tile → navigates (`?tab=`); locked tile is not a link. Compare to mock.

- [ ] **Step 3: Commit**

```bash
git add src/components/wizard/CampaignWizard.tsx
git commit -m "feat(reskin): 8-step pipeline stepper tiles (done/active/locked)"
```

---

### Task 1.9: Phase 1 checkpoint

- [ ] **Step 1: Full verification**

Run: `Remove-Item -Recurse -Force .next; pnpm typecheck; pnpm lint; pnpm test; pnpm build`
Expected: all clean/green.

- [ ] **Step 2: Visual sweep against mocks**

Preview and compare:
- `/offers` → `AFFEX AI Picks.dc.html` (header, filters, dense rows, per-row score).
- `/offers/<analyzed-id>` → `AFFEX Offer.dc.html` (breadcrumb, Oswald name, analysis hero, 13 bars, verdict chip, 8-step stepper).
Confirm color discipline (yellow only at peaks), RTL intact, no route/contract changes (`git diff --stat main` limited to CSS/TSX/i18n/layout).

- [ ] **Step 3: Push branch (do not merge yet)**

```bash
git push -u origin feat/affex-lambo-reskin
```

---

## Self-Review notes (author)

- **Spec coverage (Phase 0+1 subset):** tokens ✓ (0.1), fonts ✓ (0.2), top-nav ✓ (0.3/0.4/0.5), primitives ✓ (0.6), 13-dim scorecard ✓ (1.3), verdict tiers ✓ (1.1/1.4), offers list ✓ (1.5/1.6), offer detail + stepper ✓ (1.7/1.8), Hebrew dim labels ✓ (1.2). Phases 2–4 (Wizard Outputs, Campaign, Auth/Onboarding/Add-Offer/Billing/Admin, States/Crack-Reveal/Mobile/Micro) are intentionally deferred to follow-on plans on the same spec + mocks.
- **Type consistency:** `verdictTier`/`verdictChipStyle`/`verdictDotColor` defined in Task 1.1 and consumed identically in 1.4 + 1.5. `scoreColor` thresholds (≥80 yellow / ≥65 white / else grey) are duplicated intentionally in `evidence-bars.tsx` (per-number, ≥65 rule) and `OffersTable.tsx` (per-row) — same thresholds, local helpers; acceptable given they render different elements.
- **Placeholders:** none — every code step ships complete code or an exact style translation of a named mock region.

---

## Follow-on plans (not in this document)

Each gets its own `docs/superpowers/plans/` file after Phase 1 lands and the foundation is visually confirmed:
- **Phase 2:** Wizard Outputs (Deep Brief / Avatar / Spy / Test Kit / Copy / Creatives) + `/campaigns/[id]` (KPI cards, chart, diagnosis).
- **Phase 3:** Auth, Onboarding, Add Offer, Billing, Admin.
- **Phase 4:** Crack Reveal transition, States (empty/failed/402), Mobile (cards + hamburger), Micro (toasts/pagination/focus-ring/contrast ladder).
