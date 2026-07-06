# Handoff: AFFEX — "Lamborghini" Visual Reskin

## Overview
A full visual redesign of **AffiliateOS** (`settonbrothers/affiliateos`) into the AFFEX
identity: a **pure-black canvas with a single Lamborghini-yellow accent**, condensed
display type, and sharp (zero-radius) edges. It replaces the current dark-green
(`#22D67A`) shadcn/Tailwind theme.

**Scope is visual only.** Routes, data models, orchestrator logic, the offer-wizard
lock rules, the credit economy, and RTL/i18n are **unchanged**. Every screen was
built directly against the real code (routes, `messages/he.json`, `underwriting.ts`,
the wizard in `offers/[id]/page.tsx`), so structure and copy already conform — the
task is to re-skin, not re-architect.

## About the Design Files
The files in this bundle are **design references written as HTML Design Components**
(`*.dc.html`) — prototypes of the intended look and behavior, **not** production code
to paste in. Recreate them inside the existing **Next.js 15 / React 19 / Tailwind v4 /
shadcn** codebase using its established patterns (edit `globals.css` tokens + restyle
the shadcn components + adjust `(app)/layout.tsx`). Do not ship the HTML directly.

## Fidelity
**High-fidelity.** Exact colors, type, spacing, motion, and states below. Recreate
pixel-faithfully using the codebase's components.

---

## Design Tokens — exact remap of `src/app/globals.css` `:root`

| Token | Current (green theme) | New (AFFEX) |
|---|---|---|
| `--radius` | `0.875rem` | **`0`** (sharp corners — signature; also affects shadcn `--radius-sm/md/lg`) |
| `--background` | `#151515` | `#0A0A0A` |
| `--sidebar-bg` | `#181818` | `#0A0A0A` |
| `--card` | `#1D1D1D` | `#0C0C0C` (elevated panels `#0E0E0E`) |
| `--hover-bg` | `#242424` | `#121212` |
| `--foreground` | `#F4F4F5` | `#FFFFFF` |
| `--text-secondary` | `#B8BDC7` | `#C9C9C7` |
| `--muted-foreground` | `#7D828A` | `#8A8A88` (fainter labels `#6E6E6C`, faint `#5E5E5C`) |
| `--muted` | `#242424` | `#0C0C0C` |
| `--primary` | `#22D67A` | **`#F5C518`** (Lamborghini Giallo) |
| `--primary-foreground` | `#0d0d0d` | `#0A0A0A` |
| `--ring` | `#22D67A` | `#F5C518` |
| `--border` | `rgba(255,255,255,0.05)` | `rgba(255,255,255,0.09)` |
| `--shadow` | `0 4px 24px rgba(0,0,0,0.45)` | unchanged |
| amber (`--amber-*`) | warnings | keep, but prefer neutral grey for caution; reserve amber only if truly needed |

Accent-on-dark tints (used for chips/rows/glow): `rgba(245,197,24,0.06)` fill,
`rgba(245,197,24,0.4)` border, `rgba(245,197,24,0.55)` glow.

Optional theme variants (present as a tweak in the mocks, not required):
Arancio orange `#FF5B00`, Verde lime `#C6F23E`. Ship yellow only unless asked.

### Fonts (add via `next/font`)
- **Heebo** (already loaded) — all Hebrew UI + body. Weights 400/500/600/700/800.
- **Oswald** — display headings, offer/model names, **all Latin numerals** incl. the
  giant Crack Score. Weights 500/600/700.
- **IBM Plex Mono** — micro-labels, routes/breadcrumbs, data values, KPI captions,
  tickers. Weights 400/500/600.

In `globals.css @theme`: keep `--font-sans: var(--font-heebo)`; add
`--font-display: var(--font-oswald)` and `--font-mono: var(--font-plex-mono)`.

### Typography rules
- Hebrew headline → Heebo 800, `line-height:0.95`, `letter-spacing:-0.01em`.
- English/number headline & names → Oswald 600, `letter-spacing:0.01–0.03em` (often UPPERCASE).
- Mono labels → IBM Plex Mono, UPPERCASE, `font-size:9.5–11px`, `letter-spacing:0.1–0.22em`, color `#6E6E6C`.
- Keep numbers/English/mono in `dir="ltr"` spans inside the RTL layout (as the mocks do).

### Color discipline (critical)
Yellow appears **only at peaks**: the Crack Score number, HOT/LIVE dots, the active
nav underline, the primary CTA fill, "recommended/high" verdicts, and a key positive
delta. Everything structural is white / ink / grey. Do **not** flood the UI with yellow
(an earlier iteration did and it read cheap — restraint is the whole point).

### Motion
Sharp, fast eases. Count-up on scores/KPIs (~900ms, `t = 1-(1-t)^3`). Bars:
`shootIn`/`growBar` 0.55–0.6s `cubic-bezier(0.2,0.9,0.1,1)` stagger. Panels:
`riseIn`/`fadeUp` 0.4–0.5s. `pulse` opacity on LIVE dots. Row hover: bg→`#121212` +
yellow leading edge.

---

## Layout — the one structural change
Current `(app)/layout.tsx` uses a **left sidebar** (`AppNav`, `--sidebar-width:180px`).
The reskin uses a **sticky top black nav bar** (`height:62px`, `border-bottom
rgba(255,255,255,0.09)`, `backdrop-filter: blur(10px)`):
- Right (RTL start): `AFF` white + `EX` yellow wordmark (Oswald 700, 21px) + inline nav
  (`AI Picks` · `קמפיינים` · `חיוב` · `ניהול`) — active item has a 2px yellow underline,
  inactive `#7A7A78` → hover `#FFFFFF`.
- Left: search icon (SVG) + credits pill (`● 1,240 CR`, mono, yellow dot) + `EN` box.

Rewrite the `aside` in `(app)/layout.tsx` as this header; make `AppNav` horizontal.
`/admin` keeps the same bar with a "ניהול" tag + "← חזרה לאפליקציה"; `/onboarding` and
`/auth` are standalone (no app nav). Keep `dir="rtl"`.

---

## Screens / Views — route → design file → real components

| Route | Design file | Real components to restyle |
|---|---|---|
| `/login`, `/signup` | `AFFEX Auth.dc.html` | login/signup pages — split: left statement, right form; **invite-code field on signup only**; "magic link" on login |
| `/onboarding` | `AFFEX Onboarding.dc.html` | `OnboardingWizard` — 4 steps (מי אתה / איך אתה קונה / המיקוד שלך / מוכן); fields: experience, cashflow tolerance, channels (multi), budget min/max (sliders), vertical |
| `/offers` | `AFFEX AI Picks.dc.html` | `OffersTable` → dense row list, giant Crack Score per row, verdict chip, HOT/NEW tags, filter tabs (הכל/מומלצות/חמות/חדשות) |
| `/offers/new` | `AFFEX Add Offer.dc.html` | new-offer form: `name`, `website_url`, `affiliate_program_url`, `vertical` (chips), `operator_notes` (textarea) |
| `/offers/[id]` | `AFFEX Offer.dc.html` | `CampaignWizard` (8-step stepper + lock logic), `OfferScorecard`→`EvidenceBars` (13 dims), `OfferVerdict`, `OfferOverview` (verified facts), `AnalyzeButton` |
| `/offers/[id]` step outputs | `AFFEX Wizard Outputs.dc.html` | `DeepBriefDisplay`, `AvatarDisplay`, `SpyAnalysisDisplay`, `TestKitView`, `AdCopyView`, `CreativesDisplay` |
| `/campaigns/[id]` | `AFFEX Campaign.dc.html` | `CampaignResultsForm` (KPIs: spend/revenue/roas/cpa/conversions), performance chart, `DiagnosisView`, `DiagnoseV2Display` (winning hooks) |
| `/billing` | `AFFEX Billing.dc.html` | balance (`credit_ledger`), plan/`subscriptions`, pricing (`usage_pricing_rules`), ledger table |
| `/admin/*` | `AFFEX Admin.dc.html` | `ai-runs`, `discovery` (funnel + candidates), `kill-switches` (toggles), `invite-codes` |
| — (blueprint) | `AFFEX System Map.dc.html` | reference map of the whole system |

### Data that is real vs. illustrative
The **13 dimensions**, **8 verdicts** (`reject…high_ceiling_opportunity`), wizard step
keys/locks, HE copy, orchestrator names, and credit-metered actions are **from the code**
— match them exactly. The demo offer (Reely, score 91), the campaign numbers, and the
sample rows are **illustrative** — wire to live queries (`getOfferById`, `listOffers`,
`getBalance`, etc.).

---

## Component restyle specs (exact)
- **Button / primary**: bg `#F5C518`, color `#0A0A0A`, Heebo 700, 14–15px, padding
  `12–14px 22–30px`, radius `0`; hover bg `#FFFFFF`.
- **Button / secondary**: transparent, `1px solid rgba(255,255,255,0.24)`, color `#FFFFFF`.
- **Card / Panel**: bg `#0C0C0C`, `1px solid rgba(255,255,255,0.09)`, radius `0`,
  padding `22–40px`; hover (interactive) border `rgba(255,255,255,0.22)`, bg `#121212`.
- **Crack Score number**: Oswald 600; color `#F5C518` if `weighted_score >= 80`,
  `#FFFFFF` 65–79, `#6E6E6C` < 65; "/100" suffix `#4E4E4C`, Oswald.
- **EvidenceBars (13 dims)**: label Heebo 11.5px (`#C9C9C7` strong / `#8A8A88` weak);
  track `rgba(255,255,255,0.08)` 4–5px; fill `#F5C518` if dim `>=80` else `#4A4A48`;
  value mono; `shootIn` staggered. Layout: 2-col grid.
- **Verdict chip**: high tiers (`strong_test`+) → color/border/dot `#F5C518` on
  `rgba(245,197,24,0.06)`; mid (`small_paid_test`/`watch`) → white text, border
  `rgba(255,255,255,0.16)`; low (`reject`) → `#8A8A88`, faint border.
- **Wizard stepper**: 8 tiles; done = filled yellow number box + `✓`; active = yellow
  border + 2px yellow underline; locked = dim + `🔒` and a locked panel
  ("נעול — יש להשלים קודם <dep>").
- **Table rows**: `border-bottom rgba(255,255,255,0.06)`, hover bg `#111`; numbers mono;
  column headers mono uppercase `#5E5E5C`.
- **KPI cards**: hairline grid (`gap:1px` over a `rgba(255,255,255,0.09)` background);
  caption mono uppercase; value Oswald 600; only the peak metric (ROAS) uses yellow + HOT.
- **Kill-switch toggle**: 52×28, **square** knob, track `rgba(245,197,24,0.22)` +
  yellow knob when active; muted red (`#C97A6E`) when paused ("מושהה · 503").

## Interactions & Behavior
- Nav/tab/filter/step click → switch view (client state); active gets yellow underline.
- Offer rows & wizard steps are clickable; locked steps show the locked panel.
- Onboarding: segmented radios, multi-select chips, range sliders (`accent-color:#F5C518`).
- Auth: toggle login⇄signup (invite field appears on signup).
- Count-up animations on mount for scores/KPIs/balance.

## Assets
- **No external images.** Creative/spy thumbnails use diagonal-stripe CSS placeholders —
  replace with real creative thumbnails / DALL·E outputs / offer screenshots in prod.
- **Icons** are simple inline SVGs (search, arrows, hexagon, lock, mail) — swap for the
  codebase's icon library (e.g. lucide-react).

## Do NOT change
Routes, DB schema, Zod contracts, orchestrator logic, wizard lock rules, credit
economy/guardrails, RLS, component prop APIs, RTL/i18n. Visual layer only.

## Files in this bundle
- `AFFEX System Map.dc.html` — system blueprint
- `AFFEX Auth.dc.html` — login / signup
- `AFFEX Onboarding.dc.html` — 4-step onboarding
- `AFFEX AI Picks.dc.html` — offers list (main screen)
- `AFFEX Add Offer.dc.html` — new offer
- `AFFEX Offer.dc.html` — offer wizard (Crack Score + 8 steps)
- `AFFEX Wizard Outputs.dc.html` — Deep Brief / Avatar / Spy / Test Kit / Copy / Creatives
- `AFFEX Campaign.dc.html` — campaign results + diagnosis
- `AFFEX Billing.dc.html` — credits & billing
- `AFFEX Admin.dc.html` — AI runs / discovery / kill-switches / invite codes

**States & refinements** (apply these states to the screens above):
- `AFFEX Crack Reveal.dc.html` — the **scan → crack** moment: the dark AI-generating/
  loading state that dissolves into the yellow Crack Score. Use as the transition into
  `/offers/[id]` after "Analyze", and as the generic AI-running state for wizard steps.
- `AFFEX States.dc.html` — **empty** (no offers / no campaigns), **failed run** (DLQ +
  auto-refund), and **402 · insufficient credits**. Copy is from `messages/he.json`.
- `AFFEX Mobile.dc.html` — mobile layout: offers as **cards** (table doesn't fit) + the
  full-screen **hamburger MENU** overlay (the Lamborghini nav pattern). Reference for
  responsive behaviour of every screen.
- `AFFEX Micro.dc.html` — polish kit: **toasts** (saved / −N CR / failed+refund),
  **pagination + active sort**, **focus ring** (`0 0 0 2px #0A0A0A, 0 0 0 4px #F5C518`),
  and the **text-contrast ladder** (`#FFFFFF`→`#6E6E6C`, labels-only below AA).
- `support.js` — DC runtime (only needed to open the mocks in a browser; not for prod)

To open a mock locally: serve the folder and open any `*.dc.html` (they load `support.js`).
