# AFFEX "Lamborghini" Reskin — Status & Handoff (2026-07-08)

Read this first to continue the reskin in a new session. It captures what's done, how to deploy, the locked design decisions, and what's left.

**Production:** https://affiliateos-sooty.vercel.app · **main HEAD at handoff:** `55d7552`
**Spec:** `docs/superpowers/specs/2026-07-06-affex-lambo-reskin-design.md`
**Phase 0+1 plan:** `docs/superpowers/plans/2026-07-06-affex-lambo-reskin-phase-0-1.md`
**Pixel mocks (source of truth):** `docs/design/affex-lambo/*.dc.html` (+ `README.md`)

---

## ⚠️ Deployment — READ THIS

GitHub → Vercel **auto-deploy is broken** (the webhook stopped creating deployments after ~8 rapid pushes; new pushes to `main` do NOT deploy on their own). **Deploy manually with the Vercel CLI**, which is installed + authenticated (`settonbrothers`) + linked to project `affiliateos`:

```
# from C:\Users\97252\.gemini\antigravity\scratch\affiliateos
vercel --prod --yes
```

This builds remotely and aliases `affiliateos-sooty.vercel.app`. Confirm with `readyState: READY` + `Aliased`. It's visual-only work → no migrations/env/secrets needed. App screens are auth-gated, so live visual checks require a logged-in session (owner reviews; agent cannot see them).

**Git flow used:** feature branch → `git merge --ff-only` into `main` → `git push origin main` → `vercel --prod --yes`.

---

## Locked design decisions (apply to ALL remaining screens)

- **Palette (globals.css `:root`):** base black `--background #0D0B09` (Lamborghini-style dark); **elevated warm surfaces** `--card #211D18`, `--card-elevated #2A241D`, `--hover-bg #2A241D` (cards/nav clearly LIGHTER than the page = depth, not flat black); `--border rgba(255,255,255,0.30)` (bold, visible lines); primary Giallo `--primary #F5C518`; `--radius 0` (sharp). Body has a faint warm-yellow radial vignette (`rgba(210,165,45,0.12)` from top). Muted text brightened for readability (`--muted-foreground #B2B2B0`, `--muted-fainter #A2A2A0`, `--muted-faint #949492`).
- **Top nav** is a dark bar `rgba(42,36,29,0.96)` — deliberately lighter than the page (Lamborghini "menu bar" elevation).
- **Fonts:** Heebo (`--font-sans`, Hebrew/body), **Oswald** (`--font-display`, headings/names/numbers), **IBM Plex Mono** (`--font-mono`, micro-labels/data). Loaded via `next/font` in `src/app/layout.tsx`.
- **NO "AI look":** **no emojis, no long em-dashes `—`.** Use `lucide-react` line icons (Lock, Check, TrendingUp…) and thin-line/`·` placeholders. (En-dash `–` in numeric ranges is fine.) See memory `no-ai-look-design`.
- **Primary Button hover:** `#D9A800` (darker gold — visible on BOTH dark and white surfaces).
- **WHITE editorial treatment for content pages** (user wants it "in some places, not all"): the **campaign page** is the built example — a Lamborghini "Selezione" **dark→white→dark sandwich**: dark hero band → warm off-white body (`#F6F4EF`, big dark Oswald headings, thin `#DED8CB` rules, light inputs/tables, a dark verdict callout slab) → dark closing band, **full-bleed** edge-to-edge. Reuse this pattern for other report/content pages if the user wants (candidate: Billing). Core "terminal" screens (offers list/detail) stay dark.
- Inline styles + CSS vars are the established codebase convention (not a smell).

---

## DONE & DEPLOYED

**Phase 0 — Foundation:** token remap, 3 fonts, sidebar→sticky top nav (`AppNav` horizontal, yellow active underline), sharpened shadcn `Button`/`Card`/`Input`, global focus ring.

**Phase 1 — Core screens:**
- `/offers` (`OffersTable`): dense grid rows, client filter tabs (הכל/מומלצות/חמות/חדשות), per-row giant Oswald Crack Score, tiered verdict chip, HOT/NEW tags, `EmptyMark` thin-line placeholders; page header (mono kicker + Heebo-800 headline + counts + CTA).
- `/offers/[id]`: breadcrumb + Oswald title + always-on **analysis hero** (`EvidenceBars` shows all **13** `ScoreDimensions` with Hebrew labels, yellow-at-peak, giant score) + tiered `OfferVerdict` chip + **8-step pipeline stepper** (done/active/locked, lucide Lock/Check).
- `src/lib/offers/verdict-tier.ts` (+test): 8 verdicts → hi/mid/low + chip styles. 13 Hebrew dim labels in `messages/{he,en}.json` under `dimensions`.
- **Data fix:** `listOffers` (`src/lib/queries/offers.ts`) now enriches each offer with its latest `UnderwritingOrchestrator` run payload — the score lived only in `ai_runs`, so the list showed no Crack Score before.

**Polish rounds 1–4** (readability greys, nav vertical alignment, lucide icons replacing emojis, thin-line placeholders, visible inputs, warm-black + surface elevation + bold borders + faint yellow depth).

**Phase 2 — `/campaigns/[id]`** rebuilt as the WHITE editorial "Selezione" page (see decisions above). Components restyled: `CampaignResultsForm` (light inputs, `auto-fit` grid — no ghost cell), `DiagnosisView` (light report + dark verdict slab), `DiagnoseV2Display` (light winning-hooks table), `DiagnoseCreativesForm` (light + sharp text/images tabs).

---

## ON HOLD — Logo (user unhappy, set aside)

Built but **rejected by the user** as inaccurate to the guidelines:
- `src/components/brand/AffexMark.tsx` — AFFEX "crack" symbol (yellow square + heavy "A" as a **vector path** + diagonal crack `skewX(-16°)`), variants `primary`/`mono-white`/`mono-ink`.
- `src/app/icon.svg` — favicon (same mark).
- Placed in: nav lockup (`(app)/layout.tsx`), `/login`, `/signup`.

**Problem:** the hand-authored "A" path + crack position don't match the official mark. **Next session:** get the EXACT geometry from `docs/design/affex-lambo/AFFEX Logo Guidelines - standalone.html` (it's a compressed "bundler" HTML — the intended `AffexMark.tsx` + tokens are inside; the thumbnail SVG shows the A is **Oswald 700** with crack `skewX(-16°)`, width ~5.4%, `inset-inline-end 32.6%`, clear-space S·0.25). Do NOT guess the path — extract/decompress the doc or rebuild from its precise spec. Optionally revert the 3 placements + favicon until the mark is right.

---

## NOT DONE (remaining screens — still dark via tokens, not yet restyled to mocks)

Each has a mock in `docs/design/affex-lambo/`:
- **Wizard Outputs** (`AFFEX Wizard Outputs.dc.html`) — Deep Brief / Avatar / Spy / Test Kit / Ad Copy / Creatives step panels on `/offers/[id]`.
- **Auth** (`AFFEX Auth.dc.html`) — split statement/form; only the logo was added so far.
- **Onboarding** (`AFFEX Onboarding.dc.html`) — 4-step wizard.
- **Add Offer** (`AFFEX Add Offer.dc.html`) — `/offers/new`.
- **Billing** (`AFFEX Billing.dc.html`) — strong candidate for the white editorial treatment.
- **Admin** (`AFFEX Admin.dc.html`) — ai-runs / discovery / kill-switches / invite-codes.
- **States** (`AFFEX States.dc.html`) — empty / failed+refund / 402.
- **Crack Reveal** (`AFFEX Crack Reveal.dc.html`) — scan→crack loading transition.
- **Mobile** (`AFFEX Mobile.dc.html`) — offers as cards + hamburger overlay; responsive pass.
- **Micro** (`AFFEX Micro.dc.html`) — toasts / pagination / focus ring / contrast ladder.

---

## Practical notes
- Windows: after switching branches run `Remove-Item -Recurse -Force .next` before `pnpm typecheck`/`build`.
- Do NOT edit files with PowerShell on paths containing `[id]` (bracket-glob truncates files) — use the Edit/Write tools.
- Verify each change: `pnpm typecheck` + `pnpm build` (+ `pnpm test` = 83) before deploying.
- Pre-existing unrelated ESLint warnings in `GenerateCreativesButton.tsx` / `discovery.test.ts` are not blockers.
