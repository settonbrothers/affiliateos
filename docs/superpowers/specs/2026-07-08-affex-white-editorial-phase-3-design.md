# AFFEX Lambo Reskin — Phase 3: White Editorial Screens

**Date:** 2026-07-08
**Status:** Approved (design), pending spec review
**Depends on:** Phase 0-2 (`docs/superpowers/specs/2026-07-06-affex-lambo-reskin-design.md`). The
campaign page (`/campaigns/[id]`) is the built reference for the white "Selezione" treatment.

## Goal

Apply the white "Selezione" editorial treatment (established on the campaign page) to three more
surfaces the operator experiences as **content / statement / deliverable** screens:

1. **Auth** — `/login` + `/signup`
2. **Onboarding** — `/onboarding` (4-step wizard)
3. **Wizard Outputs** — the deliverables on the offer detail page (Deep Brief, Avatar, Spy, Test
   Kit, Ad Copy, Creatives)

Everything else stays dark (terminal): offers list, offer detail chrome (hero/scorecard/verdict),
Billing, Add Offer, Admin, and the cross-cutting States / Crack Reveal / Mobile / Micro work.

**Note on mocks:** all three source mocks (`AFFEX {Auth,Onboarding,Wizard Outputs}.dc.html`) are
dark (the only `#FFFFFF` in Auth/Onboarding is a `.cta:hover`). This phase is a deliberate,
owner-approved divergence from those mocks toward the white treatment. The mocks still govern
**layout/structure**; only the color treatment changes.

## Locked visual pattern (reused, not reinvented)

The "Selezione" sandwich already shipped on the campaign page:

- Full-bleed edge-to-edge (cancel the app `<main>` padding via negative margins).
- **Band A** — dark hero: `radial-gradient(100% 130% at 20% 0%, #17140A 0%, #0D0B09 62%)`, mono
  kicker (dir=ltr), giant Oswald title, mono meta row.
- **Band B** — warm off-white body: `background #F6F4EF`, `color #1F1B16`, big dark Oswald section
  headings (yellow 4px bar + uppercase label), thin `#DED8CB` rules between sections, light inputs
  and tables, a dark "slab" (`#0D0B09`) for a key callout/verdict.
- **Band C** — dark closing strip: mono status line + pulsing Giallo dot.

Fonts/tokens unchanged (Heebo / Oswald / IBM Plex Mono; Giallo `#F5C518`; `--radius: 0`). No AI
look (no emoji, no long em-dash; lucide icons + `·` placeholders).

## Architecture — extract a shared editorial toolkit

The campaign page currently inlines this pattern. Rather than copy it three more times, extract a
small, well-bounded toolkit under `src/components/brand/editorial/` and build the three screens on
it. (Retrofitting the campaign page onto the toolkit is **out of scope** — YAGNI; it already works.)

- **`EditorialShell.tsx`** — renders the full-bleed dark→white→dark sandwich. Props:
  `kicker: string`, `title: ReactNode`, `meta?: string[]`, `closingLabel?: string`,
  `children` (the white body). Owns the negative-margin full-bleed + the three bands. Server
  component (no state).
- **`EditorialSection.tsx`** — one white section: the yellow-bar + Oswald heading (`label`,
  optional `note`) with the top thin-rule, wrapping `children`.
- **`EditorialSlab.tsx`** — a dark callout slab for a headline insight/verdict inside the white
  body (`label` + `children`).
- **Light form styling** — add reusable classes in `globals.css` (`.affex-light-field`,
  `.affex-light-label`) so forms rendered on the off-white body get light inputs (border
  `#DED8CB`, white bg, dark text, Giallo focus) without per-component inline duplication. Existing
  dark forms are untouched.

Each unit has one purpose, a clear prop interface, and no shared mutable state.

## Screen designs

### 1. Auth (`/login`, `/signup`)

New **`AuthEditorialShell`** (`src/components/auth/AuthEditorialShell.tsx`) — a two-column split
(`grid-template-columns: 1.1fr 0.9fr` per the mock; stacks to one column under ~760px):

- **Left — white statement panel** (off-white): AFFEX wordmark, mono kicker, a giant dark Oswald
  statement line, a thin rule, short supporting copy, and 2-3 trust markers (lucide `Lock`,
  `TrendingUp`, `Check` + one-line labels).
- **Right — form panel**: the existing `LoginForm` / `SignupForm`, restyled to light fields
  (`.affex-light-*`), on a light card. Thin dark framing edges top/bottom keep it inside the
  terminal world.

`login/page.tsx` and `signup/page.tsx` both render `AuthEditorialShell` with their own statement
copy + form as a child. Statement/label strings go through `messages/{he,en}.json` (`auth.*`). No
change to auth logic or server actions.

### 2. Onboarding (`/onboarding`)

Restyle `OnboardingWizard.tsx` with `EditorialShell`:

- **Band A (dark hero):** mono kicker, Oswald welcome headline, a thin numbered step rail
  (`1 · 2 · 3 · 4`, current step in Giallo).
- **Band B (white body):** the current step's fields as `.affex-light-*` inputs under an
  `EditorialSection` heading; helper copy in `#6B6459`.
- **Band C (dark closing):** the primary "continue / finish" CTA (Giallo `.affex-cta`), plus a
  quiet back link.

Wizard state, validation (`lib/validations/onboarding.ts`), and the submit action are unchanged —
this is presentation only.

### 3. Wizard Outputs (offer detail deliverables)

The offer detail page (`/offers/[id]`) keeps its **dark** chrome (hero, scorecard, verdict, pipeline
stepper). When a **deliverable** panel is shown, its content renders as a **full-bleed white
editorial band** inside the dark page — "a document you pulled from the terminal." Wrap each of
these displays in `EditorialSection`s on a white body:

- `DeepBriefDisplay` (`src/components/deep-brief/`)
- `AvatarDisplay` (`src/components/avatar-builder/`)
- `SpyAnalysisDisplay` (`src/components/spy-analysis/`)
- `TestKitView` (`src/components/offers/`)
- `AdCopyView` / `AdCopyEditor` (`src/components/offers/`)
- Creatives display (`src/components/campaigns/DiagnoseV2Display` is already light; the offer-side
  creatives view, if distinct, matches)

Each display: off-white surface, Oswald sub-headings + thin `#DED8CB` rules, data in light tables,
the single most important takeaway (e.g. the brief's core angle, the avatar's one-liner, the spy
verdict) in an `EditorialSlab`. Generate/empty/loading states stay legible on white. Input forms
that live beside a deliverable (`SpyInputForm`, `AdCopyEditor` fields) use `.affex-light-*`.

The exact injection point (a shared white wrapper in the offer page vs. per-display) is a
plan-level detail; the requirement is: deliverable content reads white, page chrome stays dark, no
double background.

## Out of scope

- Add Offer, Admin, States, Crack Reveal, Mobile, Micro (separate later work).
- Retrofitting the campaign page onto the new toolkit.
- Any change to server actions, agents, DB, or i18n message *keys* beyond adding new auth/onboarding
  copy strings.

## Testing / verification

- `pnpm typecheck` + `pnpm build` + `pnpm test` (83) green after each screen.
- Visual review on production is owner-gated (auth-gated screens); deploy via `vercel --prod --yes`
  (GitHub auto-deploy is broken) and confirm `READY` + `Aliased` to `affiliateos-sooty.vercel.app`.
- Manual RTL check: Hebrew body flows right-to-left; mono kickers/meta stay `dir="ltr"`.
- No new automated tests required (presentational); if any pure helper is extracted (e.g. step-rail
  formatting), unit-test it.

## Risks / notes

- **Full-bleed math**: the negative-margin trick must match the current `<main>` padding
  (`clamp(28px,4vw,52px)` block, `clamp(20px,4vw,64px)` inline) exactly, or bands leak a gutter.
  Centralize it in `EditorialShell` so all screens share one correct value.
- **Windows**: after branch switches, `Remove-Item -Recurse -Force .next` before typecheck/build.
- **Do not edit `[id]` paths with PowerShell** (bracket-glob truncates) — use Edit/Write tools.
- Deliver in three independent slices (Auth, Onboarding, Wizard Outputs) so each can ship + be
  reviewed on its own.
