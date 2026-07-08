# AFFEX White Editorial (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the white "Selezione" editorial treatment to Auth (`/login`, `/signup`), Onboarding (`/onboarding`), and the offer-page Wizard Outputs (Deep Brief, Avatar, Spy, Test Kit, Ad Copy, Creatives).

**Architecture:** Extract a small reusable editorial toolkit (`src/components/brand/editorial/`) plus light-form CSS classes, then compose the three screens on it. Auth and Onboarding are full-screen pages (own layouts — no full-bleed margin trick). Wizard Outputs renders each deliverable inside a contained off-white "document" surface within the otherwise-dark offer page.

**Tech Stack:** Next.js App Router (server + client components), inline styles + CSS vars (the codebase convention), next-intl, Vitest for any pure helper.

**Spec:** `docs/superpowers/specs/2026-07-08-affex-white-editorial-phase-3-design.md`

---

## File structure

**Create**
- `src/components/brand/editorial/EditorialSurface.tsx` — off-white body block (bg `#F6F4EF`, dark text, padding). The reusable white canvas.
- `src/components/brand/editorial/EditorialSection.tsx` — yellow-bar + Oswald heading (+ optional note) with a top thin rule, wrapping children.
- `src/components/brand/editorial/EditorialSlab.tsx` — dark callout slab for a headline insight inside white body.
- `src/components/auth/AuthEditorialShell.tsx` — two-column split (statement | form).

**Modify**
- `src/app/globals.css` — add `.affex-light-field`, `.affex-light-label`, `.affex-light-select` classes + a `.affex-doc a` link color.
- `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx` — render `AuthEditorialShell`.
- `src/components/auth/LoginForm.tsx`, `SignupForm.tsx` — light fields.
- `src/app/onboarding/page.tsx` (wrapper) + `src/components/onboarding/OnboardingWizard.tsx` — editorial sandwich.
- `src/app/(app)/offers/[id]/page.tsx` — wrap deliverable tabs in `EditorialSurface`.
- Deliverable displays (light restyle): `src/components/deep-brief/DeepBriefDisplay.tsx`, `src/components/avatar-builder/AvatarDisplay.tsx`, `src/components/spy-analysis/SpyAnalysisDisplay.tsx`, `src/components/offers/TestKitView.tsx`, `src/components/offers/AdCopyView.tsx`, `src/components/creative-engine/CreativesDisplay.tsx`.
- `messages/he.json`, `messages/en.json` — new `auth.statement*` + `onboarding.kicker` strings.

**Light-token palette (the one recipe used everywhere on white):**
- Body bg `#F6F4EF`; primary text `#1F1B16`; secondary text `#6B6459`; faint `#8A8375`.
- Thin rule `#DED8CB`; field border `#DED8CB`; field bg `#FFFFFF`; field focus ring `#F5C518`.
- Dark slab bg `#0D0B09` with white text (for callouts).
- Accent stays Giallo `#F5C518`; keep `--radius: 0` (sharp).

---

## Task 1: Editorial toolkit + light-form CSS

**Files:**
- Create: `src/components/brand/editorial/EditorialSurface.tsx`
- Create: `src/components/brand/editorial/EditorialSection.tsx`
- Create: `src/components/brand/editorial/EditorialSlab.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Create `EditorialSurface.tsx`**

```tsx
import type { CSSProperties, ReactNode } from 'react'

/**
 * The warm off-white "Selezione" canvas. Renders dark Oswald content on
 * #F6F4EF. `bleed` adds the negative margins that cancel the app <main>
 * padding for edge-to-edge full-bleed (used inside the (app) layout); omit it
 * on standalone full-screen pages (auth/onboarding).
 */
export function EditorialSurface({
  children,
  bleed = false,
  style,
}: {
  children: ReactNode
  bleed?: boolean
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        background: '#F6F4EF',
        color: '#1F1B16',
        padding: 'clamp(28px,4vw,52px) clamp(24px,4vw,48px)',
        ...(bleed
          ? {
              marginInlineStart: 'calc(-1 * clamp(20px,4vw,64px))',
              marginInlineEnd: 'calc(-1 * clamp(20px,4vw,64px))',
            }
          : {}),
        ...style,
      }}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Create `EditorialSection.tsx`**

```tsx
import type { ReactNode } from 'react'

export function EditorialSection({
  label,
  note,
  children,
}: {
  label: string
  note?: string
  children: ReactNode
}) {
  return (
    <section
      className="flex flex-col gap-5"
      style={{ paddingTop: 'clamp(28px,4vw,40px)', borderTop: '1px solid #DED8CB' }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px' }}>
        <span style={{ width: '4px', height: '24px', background: 'var(--primary)', flexShrink: 0 }} />
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(22px,3vw,34px)',
            fontWeight: 600,
            letterSpacing: '0.02em',
            color: '#1F1B16',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        {note && (
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '12px',
              color: '#8A8375',
              marginInlineStart: 'auto',
            }}
          >
            {note}
          </span>
        )}
      </div>
      {children}
    </section>
  )
}
```

- [ ] **Step 3: Create `EditorialSlab.tsx`**

```tsx
import type { ReactNode } from 'react'

export function EditorialSlab({
  label,
  children,
}: {
  label?: string
  children: ReactNode
}) {
  return (
    <div style={{ background: '#0D0B09', color: '#FFFFFF', padding: 'clamp(20px,3vw,32px)' }}>
      {label && (
        <div
          dir="ltr"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.14em',
            color: 'var(--muted-faint)',
            marginBottom: '10px',
          }}
        >
          {label}
        </div>
      )}
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Add light-form classes to `globals.css`** (after the `.affex-cta` block)

```css
.affex-light-label { font-family: var(--font-sans); font-size: 13px; font-weight: 500; color: #1F1B16; }
.affex-light-field,
.affex-light-select {
  font-family: var(--font-sans); font-size: 14px; color: #1F1B16;
  background: #FFFFFF; border: 1px solid #DED8CB; border-radius: 0;
  padding: 10px 12px; width: 100%; transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.affex-light-field:focus,
.affex-light-select:focus { outline: none; border-color: #F5C518; box-shadow: 0 0 0 2px rgba(245,197,24,0.35); }
.affex-doc a { color: #9A6B00; text-decoration: underline; }
```

- [ ] **Step 5: Typecheck + build**

Run: `pnpm typecheck` then `pnpm build`
Expected: both succeed (new files compile; nothing consumes them yet).

- [ ] **Step 6: Commit**

```bash
git add src/components/brand/editorial src/app/globals.css
git commit -m "feat(reskin): editorial toolkit (Surface/Section/Slab) + light-form CSS"
```

---

## Task 2: Auth — white statement split

**Files:**
- Create: `src/components/auth/AuthEditorialShell.tsx`
- Modify: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`
- Modify: `src/components/auth/LoginForm.tsx`, `src/components/auth/SignupForm.tsx`
- Modify: `messages/he.json`, `messages/en.json`

- [ ] **Step 1: Add i18n strings** to the `auth` block in BOTH `messages/he.json` and `messages/en.json`

he.json:
```json
    "kicker": "AFFEX · UNDERWRITING TERMINAL",
    "statementSignIn": "לזהות את המנצח לפני שמישהו אחר.",
    "statementSignUp": "לחתום עסקאות על בסיס ראיות, לא תחושות.",
    "trustEvidence": "כל ציון מגובה בראיות",
    "trustSpeed": "אנדררייטינג בדקות",
    "trustPrivate": "הנתונים שלך נשארים שלך",
```
en.json:
```json
    "kicker": "AFFEX · UNDERWRITING TERMINAL",
    "statementSignIn": "Spot the winner before anyone else.",
    "statementSignUp": "Underwrite on evidence, not gut feel.",
    "trustEvidence": "Every score backed by evidence",
    "trustSpeed": "Underwriting in minutes",
    "trustPrivate": "Your data stays yours",
```

- [ ] **Step 2: Create `AuthEditorialShell.tsx`**

```tsx
import { Check, Lock, TrendingUp } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'

import { EditorialSurface } from '@/components/brand/editorial/EditorialSurface'

export async function AuthEditorialShell({
  statement,
  form,
}: {
  statement: string
  form: ReactNode
}) {
  const t = await getTranslations('auth')
  const trust = [
    { Icon: TrendingUp, label: t('trustEvidence') },
    { Icon: Lock, label: t('trustPrivate') },
    { Icon: Check, label: t('trustSpeed') },
  ]
  return (
    <main style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,0.9fr)', background: '#0D0B09' }} className="max-[760px]:!grid-cols-1">
      <EditorialSurface style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '28px' }}>
        <div dir="ltr" style={{ display: 'flex', alignItems: 'baseline', gap: '1px' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, color: '#1F1B16' }}>AFF</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, color: '#9A6B00' }}>EX</span>
        </div>
        <div dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.2em', color: '#8A8375' }}>
          {t('kicker')}
        </div>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'clamp(34px,4.5vw,56px)', fontWeight: 600, lineHeight: 1.02, color: '#1F1B16', maxWidth: '18ch' }}>
          {statement}
        </h1>
        <div style={{ borderTop: '1px solid #DED8CB', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {trust.map(({ Icon, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: '#6B6459' }}>
              <Icon size={16} strokeWidth={2} color="#9A6B00" />
              {label}
            </div>
          ))}
        </div>
      </EditorialSurface>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(28px,4vw,52px)', background: '#0D0B09' }}>
        <div className="affex-doc" style={{ width: '100%', maxWidth: '380px', background: '#F6F4EF', padding: 'clamp(24px,3vw,36px)' }}>
          {form}
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Rewrite `login/page.tsx`** to use the shell

```tsx
import { getTranslations } from 'next-intl/server'

import { AuthEditorialShell } from '@/components/auth/AuthEditorialShell'
import { LoginForm } from '@/components/auth/LoginForm'

export default async function LoginPage() {
  const t = await getTranslations('auth')
  return <AuthEditorialShell statement={t('statementSignIn')} form={<LoginForm />} />
}
```

- [ ] **Step 4: Rewrite `signup/page.tsx`** to use the shell

```tsx
import { getTranslations } from 'next-intl/server'

import { AuthEditorialShell } from '@/components/auth/AuthEditorialShell'
import { SignupForm } from '@/components/auth/SignupForm'

export default async function SignupPage() {
  const t = await getTranslations('auth')
  return <AuthEditorialShell statement={t('statementSignUp')} form={<SignupForm />} />
}
```

- [ ] **Step 5: Light-restyle `LoginForm.tsx` (and mirror in `SignupForm.tsx`)**

Replace the shadcn `<Label>`/`<Input>` with light-class equivalents, and the title/links to dark-on-light. Keep all logic/handlers unchanged. The field pattern becomes:

```tsx
<div className="flex flex-col gap-1.5">
  <label htmlFor="email" className="affex-light-label">{t('email')}</label>
  <input id="email" type="email" autoComplete="email" className="affex-light-field" {...register('email')} />
  {errors.email && <p style={{ fontSize: '13px', color: '#B23A24' }}>{errors.email.message}</p>}
</div>
```

Add a form title above the fields:
```tsx
<h2 style={{ margin: '0 0 4px', fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 600, color: '#1F1B16' }}>{t('signInTitle')}</h2>
<p style={{ margin: '0 0 8px', fontSize: '13px', color: '#6B6459' }}>{t('signInSubtitle')}</p>
```
Buttons: primary uses `.affex-cta` (Giallo, ink text); secondary (magic link) is a light outline button:
```tsx
<button type="submit" disabled={isPending} className="affex-cta" style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, color: '#0A0A0A', background: '#F5C518', border: 'none', padding: '12px 18px', cursor: 'pointer' }}>
  {isPending ? t('signingIn') : t('signInBtn')}
</button>
<button type="button" onClick={onMagicLink} disabled={isPending} style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, color: '#1F1B16', background: 'transparent', border: '1px solid #DED8CB', padding: '12px 18px', cursor: 'pointer' }}>
  {t('sendMagicLink')}
</button>
```
Footer link stays, dark-on-light: wrap in `<p style={{ fontSize: '13px', color: '#6B6459' }}>` with the `<Link>` given `className="affex-doc"` inline (or `style={{ color: '#9A6B00', textDecoration: 'underline' }}`). Drop the now-unused `Button`, `Input`, `Label` imports. Remove the AFFEX wordmark div (the shell renders the wordmark). Mirror exactly the same transformation in `SignupForm.tsx`.

- [ ] **Step 6: Clean build (Windows) + typecheck + build**

Run: `Remove-Item -Recurse -Force .next` then `pnpm typecheck` then `pnpm build`
Expected: both succeed; `/login` and `/signup` compile.

- [ ] **Step 7: Commit**

```bash
git add src/components/auth src/app/(auth) messages/he.json messages/en.json
git commit -m "feat(reskin): Auth as white statement-split editorial"
```

---

## Task 3: Onboarding — white editorial sandwich

**Files:**
- Modify: `src/app/onboarding/page.tsx` (only if it wraps the wizard in dark chrome — otherwise leave)
- Modify: `src/components/onboarding/OnboardingWizard.tsx`
- Modify: `messages/he.json`, `messages/en.json`

- [ ] **Step 1: Add i18n** to the `onboarding` block in BOTH files

he.json: `"kicker": "AFFEX · הגדרת פרופיל מפעיל",`
en.json: `"kicker": "AFFEX · OPERATOR PROFILE SETUP",`

- [ ] **Step 2: Read `src/app/onboarding/page.tsx`** to see what wraps `OnboardingWizard`. If it centers the wizard on the dark page, keep that outer wrapper but let the wizard render its own full-width sandwich (remove any max-width card around it). Record the exact change needed; if the page is just `<OnboardingWizard .../>` in a centered main, change the main to full-width: `<main style={{ minHeight: '100vh', background: '#0D0B09' }}>`.

- [ ] **Step 3: Restyle `OnboardingWizard.tsx`** — wrap the existing step content in the editorial sandwich. Keep ALL state/handlers (`step`, `finish`, `toggleChannel`, etc.) unchanged. New structure:

```tsx
// imports add:
import { EditorialSurface } from '@/components/brand/editorial/EditorialSurface'
import { EditorialSection } from '@/components/brand/editorial/EditorialSection'

// The `Choice` button becomes light:
function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        border: `1px solid ${active ? '#1F1B16' : '#DED8CB'}`,
        background: active ? '#1F1B16' : '#FFFFFF',
        color: active ? '#FFFFFF' : '#1F1B16',
        padding: '8px 14px', fontSize: '13px', textTransform: 'capitalize', cursor: 'pointer',
      }}>
      {String(children).replace(/_/g, ' ')}
    </button>
  )
}
```

Return becomes:
```tsx
return (
  <div style={{ minHeight: '100vh', background: '#0D0B09' }}>
    {/* Band A - dark hero */}
    <div style={{ padding: 'clamp(28px,4vw,52px) clamp(24px,4vw,48px)', background: 'radial-gradient(100% 130% at 20% 0%, #17140A 0%, #0D0B09 62%)' }}>
      <div dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.2em', color: 'var(--muted-fainter)', marginBottom: '16px' }}>{t('kicker')}</div>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'clamp(34px,5vw,56px)', fontWeight: 600, lineHeight: 0.95, color: '#FFFFFF' }}>{steps[step]}</h1>
      <div dir="ltr" style={{ marginTop: '18px', display: 'flex', gap: '10px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
        {steps.map((s, i) => (
          <span key={s} style={{ color: i === step ? 'var(--primary)' : i < step ? '#B2B2B0' : '#5E5E5C' }}>{i + 1}{i < steps.length - 1 ? ' ·' : ''}</span>
        ))}
      </div>
    </div>
    {/* Band B - white body */}
    <EditorialSurface>
      <EditorialSection label={steps[step]}>
        {/* the existing per-step field JSX, unchanged except Label->className="affex-light-label", Input->className="affex-light-field", select->className="affex-light-select", and readyLine text colors to #1F1B16 / #6B6459 */}
      </EditorialSection>
      {error && <p style={{ fontSize: '13px', color: '#B23A24' }}>{error}</p>}
    </EditorialSurface>
    {/* Band C - dark closing with nav */}
    <div dir="ltr" style={{ background: '#0D0B09', padding: 'clamp(20px,3vw,28px) clamp(24px,4vw,48px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      {/* back button (left) + skip/next/finish (right), restyled: primary = .affex-cta Giallo; secondary = 1px solid var(--border) transparent */}
    </div>
  </div>
)
```

Replace each `<Label>` with `<label className="affex-light-label">`, each `<Input>` with `<input className="affex-light-field">`, the `<select>` className with `affex-light-select`, and the step-3 summary text colors with `#1F1B16` / `#6B6459`. Restyle the three nav `<Button>`s: back + skip as `border: 1px solid var(--border); background: transparent; color: #FFFFFF; padding: 10px 18px`, next/finish as `.affex-cta` Giallo. Drop unused `Button`/`Input`/`Label`/`cn` imports if no longer referenced.

- [ ] **Step 4: Clean build + typecheck + build**

Run: `Remove-Item -Recurse -Force .next` then `pnpm typecheck` then `pnpm build`
Expected: succeed; `/onboarding` compiles.

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding src/app/onboarding messages/he.json messages/en.json
git commit -m "feat(reskin): Onboarding as white editorial sandwich"
```

---

## Task 4: Wizard Outputs — white document surface on the offer page

The deliverable tabs (`deep-brief`, `avatar`, `spy`, `test-kit`, `copy`, `creatives`) render inside `<CampaignWizard>` in `src/app/(app)/offers/[id]/page.tsx`. Wrap each deliverable's content in an `EditorialSurface` (contained off-white document — NOT full-bleed, to avoid breaking out of the nested wizard), then convert each display component to the light-token palette. The offer hero/scorecard/verdict/pipeline stay dark. `verdict`, `scorecard`, `compliance`, `campaign-view`, `overview` tabs stay dark (unchanged).

**Restyle recipe for a display component (apply to each):** map dark tokens → light:
- `#FFFFFF` / `var(--foreground)` text → `#1F1B16`
- muted greys (`#B0B0AE`, `var(--muted-foreground)`, `#A2A2A0`) → `#6B6459`
- card/surface bg (`#211D18`, `#2A241D`, `var(--card)`, dark radials) → `#FFFFFF` or `#EFEBE1` blocks, `1px solid #DED8CB`
- borders `rgba(255,255,255,0.x)` → `#DED8CB`
- keep Giallo accents, Oswald headings, mono kickers as-is (they read on white)
- the single headline takeaway → wrap in `EditorialSlab` (dark) for contrast
- any inline links → `.affex-doc` link color

- [ ] **Step 1: Wrap deliverable tab bodies in `EditorialSurface`** in `offers/[id]/page.tsx`

Add import: `import { EditorialSurface } from '@/components/brand/editorial/EditorialSurface'`. For each of the six deliverable `activeTab` blocks, wrap the existing inner `<div className="flex flex-col gap-6">…</div>` with `<EditorialSurface>…</EditorialSurface>`. The generate buttons stay inside (they render fine; if a button looks wrong on white, that is handled when its component is touched — out of scope here, note it). Leave the empty-state `<p>` text but change its color to `#6B6459` inline.

- [ ] **Step 2: Typecheck + build after the wrapper**

Run: `Remove-Item -Recurse -Force .next` then `pnpm typecheck` then `pnpm build`
Expected: succeed. At this point deliverables sit on white but their internals may still be light-on-white (unreadable) — fixed next, one component per commit.

- [ ] **Step 3: Commit the wrapper**

```bash
git add "src/app/(app)/offers/[id]/page.tsx"
git commit -m "feat(reskin): deliverable tabs render on white editorial surface"
```

- [ ] **Step 4: Light-restyle `DeepBriefDisplay.tsx`** — read it, apply the restyle recipe, wrap its core angle/takeaway in `EditorialSlab`. Then `pnpm typecheck && pnpm build`, then:
```bash
git add src/components/deep-brief/DeepBriefDisplay.tsx
git commit -m "feat(reskin): Deep Brief display on white"
```

- [ ] **Step 5: Light-restyle `AvatarDisplay.tsx`** (recipe; avatar one-liner → slab). Typecheck+build. Commit `"feat(reskin): Avatar display on white"`.

- [ ] **Step 6: Light-restyle `SpyAnalysisDisplay.tsx`** (recipe; spy verdict → slab). Typecheck+build. Commit `"feat(reskin): Spy analysis display on white"`.

- [ ] **Step 7: Light-restyle `TestKitView.tsx`** (recipe; tables to light). Typecheck+build. Commit `"feat(reskin): Test Kit view on white"`.

- [ ] **Step 8: Light-restyle `AdCopyView.tsx`** (recipe; hook cards to light). Typecheck+build. Commit `"feat(reskin): Ad Copy view on white"`.

- [ ] **Step 9: Light-restyle `CreativesDisplay.tsx`** (recipe; image grid captions to dark-on-light). Typecheck+build. Commit `"feat(reskin): Creatives display on white"`.

- [ ] **Step 10: Full verification**

Run: `pnpm typecheck` + `pnpm build` + `pnpm test`
Expected: typecheck clean, build OK, 83 tests pass.

---

## Deploy (after all tasks, owner-reviewable)

```bash
git push origin main
vercel --prod --yes
```
Confirm `readyState: READY` + `Aliased` to `affiliateos-sooty.vercel.app`. Visual review is owner-gated (auth screens). Update memory `affex-reskin-status`.

## Notes / gotchas
- Windows: `Remove-Item -Recurse -Force .next` after branch switches before typecheck/build.
- Do NOT edit `[id]` paths with PowerShell (bracket-glob truncates) — use Edit/Write tools.
- Keep all server actions, agent contracts, validation, and DB access unchanged — presentation only.
- Pre-existing ESLint warnings in `GenerateCreativesButton.tsx` / `discovery.test.ts` are not blockers.
