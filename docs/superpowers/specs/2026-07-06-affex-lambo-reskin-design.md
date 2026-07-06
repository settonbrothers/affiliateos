# AFFEX "Lamborghini" Reskin — Design Spec

**Date:** 2026-07-06
**Status:** Approved for planning
**Scope:** Visual-only reskin of AffiliateOS (`settonbrothers/affiliateos`)
**Design source:** `docs/design/affex-lambo/` (vendored `*.dc.html` mocks + `README.md` handoff) — the pixel source of truth.

---

## 1. Goal & Non-Goals

### Goal
Re-skin the entire app from the current **AFFEX V8 dark-green** theme into the **AFFEX "Lamborghini"** identity: pure-black canvas (`#0A0A0A`), a single Lamborghini-yellow accent (`#F5C518`), condensed display type (Oswald), monospace micro-labels (IBM Plex Mono), and sharp zero-radius edges. Restraint is the core principle — yellow appears only at peaks.

### Non-Goals (do NOT change)
Routes, DB schema, migrations, Zod contracts, orchestrator logic, wizard lock rules, credit economy/guardrails, RLS, **component prop APIs**, RTL/i18n structure. This is the visual layer only. Every screen was designed against the real routes/components/`messages/he.json`, so structure and copy already conform.

### Decisions locked during brainstorming
- **Yellow only.** The mocks include optional Arancio-orange (`#FF5B00`) and Verde-lime (`#C6F23E`) accent variants — we ship yellow only, no theme switcher.
- **Restore 13 dimensions.** V8's `evidence-bars.tsx` collapsed the scorecard to 5 monochrome bars. The reskin renders all **13 real `ScoreDimensions`** (from `src/types/agents/underwriting.ts`) with Hebrew labels.
- **One cohesive spec, phased implementation** (Phase 0–4 below).
- **Keep the wizard's real navigation model.** The real `CampaignWizard` navigates via `Link`/`href` per step (not client-state view-switching as the mock prototype does). We keep the `href` routing + prop API and only restyle the tiles + panels.

---

## 2. Current State (what we're replacing)

- `src/app/globals.css :root` is still the **green** theme: `--primary: #22D67A`, `--background: #151515`, `--card: #1D1D1D`, `--radius: 0.875rem`. (The README "current" column matches this exactly.)
- Layout `(app)/layout.tsx` uses a **left sidebar** (`--sidebar-width: 180px`) with `AppNav` (vertical) + a credits pill footer + `LanguageToggle`.
- Fonts: only **Heebo** is loaded (`src/app/layout.tsx`), exposed as `--font-heebo` / `--font-sans`.
- `evidence-bars.tsx` shows 5 bars; `OfferScorecard`/`OfferVerdict`/`TrendingBadge`/`status.ts` are gray-only V8 styling.
- `CampaignWizard.tsx` is presentational: receives `steps: WizardStep[]` (`key`, `label`, `href`, `isActive`, `isLocked`, `isComplete`, `isSkippable`); renders a `Link` per step; locked steps render non-linked.

---

## 3. Design Tokens — exact `globals.css :root` remap

| Token | Current (green) | New (AFFEX Lambo) |
|---|---|---|
| `--radius` | `0.875rem` | **`0`** (drives shadcn `--radius-sm/md/lg`) |
| `--background` | `#151515` | `#0A0A0A` |
| `--sidebar-bg` | `#181818` | `#0A0A0A` |
| `--card` | `#1D1D1D` | `#0C0C0C` (elevated panels `#0E0E0E`) |
| `--hover-bg` | `#242424` | `#121212` |
| `--foreground` | `#F4F4F5` | `#FFFFFF` |
| `--text-secondary` | `#B8BDC7` | `#C9C9C7` |
| `--muted-foreground` | `#7D828A` | `#8A8A88` (fainter `#6E6E6C`, faint `#5E5E5C`) |
| `--muted` | `#242424` | `#0C0C0C` |
| `--primary` | `#22D67A` | **`#F5C518`** |
| `--primary-foreground` | `#0d0d0d` | `#0A0A0A` |
| `--ring` | `#22D67A` | `#F5C518` |
| `--border` | `rgba(255,255,255,0.05)` | `rgba(255,255,255,0.09)` |
| `--shadow` | `0 4px 24px rgba(0,0,0,0.45)` | unchanged |

**Accent-on-dark tints** (chips/rows/glow): fill `rgba(245,197,24,0.06)`, border `rgba(245,197,24,0.4)`, glow `rgba(245,197,24,0.55)`.

**Amber** (`--amber-*`): keep the vars but prefer neutral grey for caution; reserve amber only where truly needed (compliance cap / human-review).

### Fonts (`src/app/layout.tsx` via `next/font/google`)
- **Heebo** (already loaded) — Hebrew UI + body. Weights 400/500/600/700/800.
- **Oswald** — display headings, offer/model names, **all Latin numerals** incl. the giant Crack Score. Weights 500/600/700. Expose `--font-oswald`.
- **IBM Plex Mono** — micro-labels, routes/breadcrumbs, data values, KPI captions, tickers. Weights 400/500/600. Expose `--font-plex-mono`.

In `globals.css @theme inline`: keep `--font-sans: var(--font-heebo)`; add `--font-display: var(--font-oswald)` and `--font-mono: var(--font-plex-mono)`. All three `variable`s must be on `<html className>`.

### Typography rules
- Hebrew headline → Heebo 800, `line-height: 0.95`, `letter-spacing: -0.01em`.
- English/number headline & names → Oswald 600, `letter-spacing: 0.01–0.03em`, often UPPERCASE.
- Mono labels → IBM Plex Mono, UPPERCASE, `font-size: 9.5–11px`, `letter-spacing: 0.1–0.22em`, color `#6E6E6C`.
- Keep numbers/English/mono in `dir="ltr"` spans inside the RTL layout (as the mocks do).

### Color discipline (critical)
Yellow appears **only at peaks**: the Crack Score number, HOT/LIVE dots, the active nav underline, the primary CTA fill, "recommended/high" verdicts, and a key positive delta. Everything structural is white / ink / grey. Do **not** flood the UI with yellow.

### Motion
Sharp, fast eases. Count-up on scores/KPIs (~900ms, `t = 1-(1-t)^3`). Bars `shootIn`/`growBar` 0.55–0.6s `cubic-bezier(0.2,0.9,0.1,1)` staggered. Panels `riseIn`/`fadeUp` 0.4–0.5s. `pulse` opacity on LIVE dots. Row hover: bg→`#121212` + yellow leading edge. Respect `prefers-reduced-motion` (skip count-ups/animations → render final state).

---

## 4. Layout — the one structural change

Rewrite the `aside` in `(app)/layout.tsx` as a **sticky top black nav bar** (`height: 62px`, `border-bottom: 1px solid rgba(255,255,255,0.09)`, `backdrop-filter: blur(10px)`, `background: rgba(10,10,10,0.9)`):

- **Right (RTL start):** `AFF` white + `EX` yellow wordmark (Oswald 700, 21px) + inline horizontal nav (`AI PICKS` · `קמפיינים` · `חיוב` · `ניהול`) — active item has a 2px yellow underline; inactive `#7A7A78` → hover `#FFFFFF`. Active label uses Oswald for the current section, plain Heebo for others (per mock).
- **Left:** search icon (SVG) + credits pill (`● 1,240 CR`, IBM Plex Mono, yellow pulsing dot, real balance from `getCurrentBalance`) + `EN`/`עב` toggle box (`LanguageToggle` restyled: bordered mono box).

`AppNav` becomes horizontal. `/admin/*` keeps the same bar with a "ניהול" tag + "← חזרה לאפליקציה". `/onboarding` and `/auth` are standalone (no app nav). Keep `dir="rtl"`. Main content: remove the sidebar offset; content is centered `max-width: 1500px`, padding `clamp(...)` per mocks.

---

## 5. Component restyle specs

All exact values live in `docs/design/affex-lambo/README.md` §"Component restyle specs" and the individual mocks. Summary of what each real component becomes:

- **Button / primary** (shadcn `Button`): bg `#F5C518`, color `#0A0A0A`, Heebo 700, 14–15px, padding `12–14px 22–30px`, radius `0`; hover bg `#FFFFFF`.
- **Button / secondary**: transparent, `1px solid rgba(255,255,255,0.24)`, color `#FFFFFF`.
- **Card / Panel**: bg `#0C0C0C`, `1px solid rgba(255,255,255,0.09)`, radius `0`, padding `22–40px`; interactive hover → border `rgba(255,255,255,0.22)`, bg `#121212`.
- **Crack Score number**: Oswald 600; color `#F5C518` if `weighted_score >= 80`, `#FFFFFF` for 65–79, `#6E6E6C` for `<65`; `/100` suffix `#4E4E4C` Oswald. Count-up on mount.
- **EvidenceBars — 13 dims** (`src/components/crack-score/evidence-bars.tsx`): 2-col grid; per dim — label Heebo 11.5px (`#C9C9C7` if `>=80` else `#8A8A88`), track `rgba(255,255,255,0.08)` 4px, fill `#F5C518` if dim `>=80` else `#4A4A48`, value IBM Plex Mono; `shootIn` staggered `0.05s` per row. Reads real `ScoreDimensions` in `SCORE_DIMENSION_LABELS` order; **Hebrew labels** required (see §7).
- **Verdict chip** (`OfferVerdict`): high tiers (`strong_test` and above → `strategic_opportunity`, `high_ceiling_opportunity`) → color/border/dot `#F5C518` on `rgba(245,197,24,0.06)`; mid (`small_paid_test`, `watch`) → white text, border `rgba(255,255,255,0.16)`; low (`reject`, plus `organic_only`/`seo_review_only` per tier mapping) → `#8A8A88`, faint border. Map all 8 `VERDICTS` to a tier.
- **Wizard stepper** (`CampaignWizard`): 8 tiles in a horizontal scroll row; done = filled yellow number box + `✓`; active = yellow border + 2px yellow underline; locked = dim + `🔒` and (in the step's panel) a locked message ("נעול — יש להשלים קודם `<dep>`"). Preserve `href`/`Link` navigation and the `WizardStep` prop API.
- **Table rows** (`OffersTable`): dense grid rows, `border-bottom rgba(255,255,255,0.06)`, hover bg `#111` + yellow leading edge; numbers IBM Plex Mono; column headers mono uppercase `#5E5E5C`; per-row giant Crack Score (Oswald 42px), verdict chip, HOT/NEW tags, momentum delta, rank. Filter tabs (`הכל`/`מומלצות`/`חמות`/`חדשות`) with yellow active underline.
- **KPI cards** (`CampaignResultsForm` etc.): hairline grid (`gap: 1px` over a `rgba(255,255,255,0.09)` background); caption mono uppercase; value Oswald 600; only the peak metric (ROAS) uses yellow + HOT.
- **Kill-switch toggle** (`/admin/kill-switches`): 52×28, **square** knob, track `rgba(245,197,24,0.22)` + yellow knob when active; muted red (`#C97A6E`) when paused ("מושהה · 503").
- **Focus ring** (global): `0 0 0 2px #0A0A0A, 0 0 0 4px #F5C518` (from `AFFEX Micro`).

---

## 6. Screen inventory (route → mock → real components)

| Route | Mock file | Real components to restyle |
|---|---|---|
| `/login`, `/signup` | `AFFEX Auth.dc.html` | login/signup pages — split: left statement, right form; invite-code field on signup only; "magic link" on login |
| `/onboarding` | `AFFEX Onboarding.dc.html` | `OnboardingWizard` — 4 steps; segmented radios, multi-select chips, range sliders (`accent-color:#F5C518`) |
| `/offers` | `AFFEX AI Picks.dc.html` | `OffersTable` (dense rows), page header, filter tabs, `TrendingBadge` |
| `/offers/new` | `AFFEX Add Offer.dc.html` | new-offer form: `name`, `website_url`, `affiliate_program_url`, `vertical` (chips), `operator_notes` |
| `/offers/[id]` | `AFFEX Offer.dc.html` | `CampaignWizard`, `evidence-bars.tsx` (13 dims), `OfferVerdict`, `OfferOverview` (verified facts), `AnalyzeButton`, analysis hero |
| `/offers/[id]` step outputs | `AFFEX Wizard Outputs.dc.html` | `DeepBriefDisplay`, `AvatarDisplay`, `SpyAnalysisDisplay`, `TestKitView`, `AdCopyView`, `CreativesDisplay` |
| `/campaigns/[id]` | `AFFEX Campaign.dc.html` | `CampaignResultsForm` (KPIs), performance chart, `DiagnosisView`, `DiagnoseV2Display` |
| `/billing` | `AFFEX Billing.dc.html` | balance, plan/subscriptions, pricing table, ledger table |
| `/admin/*` | `AFFEX Admin.dc.html` | `ai-runs`, `discovery` (funnel + candidates), `kill-switches` (toggles), `invite-codes` |
| — (reference) | `AFFEX System Map.dc.html` | whole-system blueprint (no code) |

**States & refinements** (apply across screens):
- `AFFEX Crack Reveal.dc.html` — scan→crack transition: the AI-running/loading state that dissolves into the yellow Crack Score. Use after "Analyze" into `/offers/[id]`, and as the generic AI-running state for wizard steps.
- `AFFEX States.dc.html` — empty (no offers/campaigns), failed run (DLQ + auto-refund), 402 insufficient credits. Copy from `messages/he.json`.
- `AFFEX Mobile.dc.html` — mobile: offers as **cards** (table doesn't fit) + full-screen hamburger MENU overlay. Responsive reference for every screen.
- `AFFEX Micro.dc.html` — toasts (saved / −N CR / failed+refund), pagination + active sort, focus ring, text-contrast ladder.

### Real vs. illustrative data
The 13 dimensions, 8 verdicts, wizard step keys/locks, HE copy, orchestrator names, and credit-metered actions are **from the code** — match exactly. The demo offer (Reely, score 91), campaign numbers, and sample rows are **illustrative** — wire to live queries (`getOfferById`, `listOffers`, `getCurrentBalance`, etc.).

---

## 7. Known detail work

- **Hebrew dimension labels.** The mock uses Hebrew dim labels (כלכלה, ביקוש, תחרות, הזדמנות קריאייטיב, התאמת פאנל, רגולציה, התאמת מפעיל, ביטחון נתונים, אמון בהצעה, פוטנציאל סקייל, התאמת תזרים, תקרה גבוהה, מורכבות ביצוע). `messages/he.json` already has some (`hfEconomics`, `sigDemand`). Add a complete `he.json` map for all 13 `ScoreDimensions` keys and render from it (keep `SCORE_DIMENSION_LABELS` English for `en.json`).
- **Verdict→tier map** must cover all 8 verdicts, not just the mock's score-threshold demo.
- **Assets:** no external images; creative/spy thumbnails use diagonal-stripe CSS placeholders. Icons → swap inline SVGs for `lucide-react`.

---

## 8. Phased implementation

- **Phase 0 — Foundation:** `globals.css` token remap + `--radius: 0`; add Oswald + IBM Plex Mono in `layout.tsx`; rewrite `(app)/layout.tsx` sidebar → top nav bar; restyle shadcn primitives (button, card) + kill-switch toggle + global focus ring. Everything downstream depends on this.
- **Phase 1 — Core:** `/offers` (`OffersTable`, header, filters) + `/offers/[id]` (analysis hero, Crack Score, `evidence-bars` → 13 dims, `OfferVerdict`, `CampaignWizard` stepper, overview/verified-facts panel).
- **Phase 2 — Outputs & Campaign:** Wizard Outputs (Deep Brief / Avatar / Spy / Test Kit / Copy / Creatives) + `/campaigns/[id]` (KPI cards, chart, diagnosis).
- **Phase 3 — Peripheral screens:** Auth, Onboarding, Add Offer, Billing, Admin.
- **Phase 4 — States & polish:** Crack Reveal transition, Empty/Failed/402 states, Mobile (cards + hamburger), Micro (toasts, pagination, focus ring, contrast ladder).

---

## 9. Verification

Per phase:
- `pnpm typecheck` + `pnpm build` clean (remember: `Remove-Item -Recurse -Force .next` after branch switches).
- `pnpm lint` clean.
- Visual check via `pnpm dev` + preview tools: `preview_inspect` on colors/fonts/spacing (more reliable than screenshots for exact values), screenshot for layout, compare against the corresponding `docs/design/affex-lambo/*.dc.html`.
- Confirm color discipline (yellow only at peaks), RTL intact, no logic/route/contract changes (git diff scoped to CSS/TSX styling + `layout.tsx` + `he.json`/`en.json` labels).

---

## 10. References
- `docs/design/affex-lambo/README.md` — full handoff (authoritative on exact values).
- `docs/design/affex-lambo/*.dc.html` — per-screen high-fidelity mocks (open by serving the folder; they load `support.js`).
- `src/types/agents/underwriting.ts` — 13 `ScoreDimensions` + 8 `VERDICTS` + `SCORE_DIMENSION_LABELS`.
