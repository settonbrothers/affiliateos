# AFFEX AI Waiting States — Design / איפיון

**Date:** 2026-07-08
**Problem:** every AFFEX action that matters is an async AI call (2s–60s). Today the UI just
disables a button and shows "analyzing…" — the system looks dead while it thinks, so the user
doesn't know anything is happening or feel the value being produced. This spec defines one
coherent, honest, on-brand "thinking" language and how it applies to **every** screen/action.

## Principles

1. **Never a dead screen.** The moment an AI action starts, the surface visibly comes alive.
2. **Honest motion, not fake progress.** AI duration is variable and unknown. We do NOT show a
   determinate bar that fills to 100% and then stalls (the classic lie). We use *indeterminate*
   motion (a sweeping shimmer), an *elapsed* counter, and *narration* (what stage it's in).
3. **Narrate the work.** Show what the model is doing right now — scanning dimensions, reading the
   page, running gap-fill research, drafting hooks. The waiting time becomes a story.
4. **The reveal is the payoff.** When the result lands it *arrives* — a count-up, a shoot-in, a
   crack — never a silent DOM swap. The bigger the result, the bigger the reveal.
5. **Reuse the mechanism we have.** `useAiRunStatus` already tracks a run (`isRunning` →
   terminal → `router.refresh()`); the waiting UI keys off `isRunning`, the reveal keys off the
   freshly-mounted result component.

## The visual language (shared)

- **Scan aesthetic:** dark terminal — mono kicker (`AFFEX ▸ WORKING`), a pulsing Giallo `LIVE`
  dot, the subject name in Oswald, a list of steps/dimensions revealing line-by-line (dashed
  leaders), an **indeterminate sweep bar** (Giallo shimmer on a faint track), an elapsed timer,
  and a blinking `◈ …  ▊` status line. No fake numbers while scanning — placeholders are pulsing
  dots.
- **Reveal:** result count-up (numbers animate 0→value), bars `shootIn` (scaleX from the end),
  content `fadeUp`. On the flagship it's the full "crack".

Three intensity tiers, chosen by how big the result is:

| Tier | Used for | Waiting UI | Reveal |
|---|---|---|---|
| **T1 — Crack Reveal** (flagship) | Underwriting / analyze-offer (produces THE Crack Score) | Full-screen `AnalyzingOverlay`: 13-dimension scan, sweep, elapsed, "CRACKING OFFER" | Overlay cracks out (fade+blur+scale) → offer hero's `EvidenceBars` reveals: score counts up, 13 bars shoot in |
| **T2 — Working Panel** | Deep Brief, Avatar, Spy, Test Kit, Ad Copy, Creatives, Diagnosis | Inline `ScanPanel` in the content area: action name + rotating step labels + sweep + elapsed | Panel clears → the white editorial document `fadeUp`s in (its cards/sections already animate) |
| **T3 — Inline Pulse** | Compliance check, translation fill, short lookups | Compact one-line scan strip beside the trigger (kicker + sweep + elapsed) | Result fades in |

Discovery (admin) is its own case: it already streams a **funnel** (discovered→triage→deep→
approved) that updates live — that IS its waiting state; we just add a running pulse + elapsed.

## Per-screen application

- **Offer detail · Analyze** → **T1**. `AnalyzeButton` renders `AnalyzingOverlay` while running;
  reveal via `EvidenceBars` mount animation. The signature moment.
- **Offer detail · deliverable tabs** (Deep Brief / Avatar / Spy / Test Kit / Ad Copy / Creatives)
  → **T2**. Each generate button renders `ScanPanel` (with action-specific step labels) below
  itself while running; on completion the restyled white display reveals.
- **Campaign · Diagnose** → **T2** (ScanPanel with diagnosis steps) → the white diagnosis reveals.
- **Offer · Compliance** → **T3** compact strip.
- **Admin · Discovery** → funnel + running pulse (existing funnel is the narration).
- **Any list/page load** (non-AI) → NOT this system; those use the existing skeleton/empty
  (`StateView`) treatment. This spec is only for *thinking* (AI) waits.

## Components to build

- `src/components/ai/AnalyzingOverlay.tsx` (client) — T1 full-screen scan for underwriting, with a
  **crack-out exit** animation when `running` flips false (self-managed show state so the exit
  plays over the freshly-refreshed result behind it). Props: `running`, `offerName`, `offerUrl`.
- `src/components/ai/ScanPanel.tsx` (client) — T2/T3 inline scan strip. Props: `running`,
  `title`, `steps: string[]` (rotating narration), `variant?: 'panel' | 'inline'`.
- Enhance `EvidenceBars` — reveal-on-mount: the big score counts up (rAF) and the 13 bars
  `shootIn` (staggered). Gated by a `reveal` prop so it only animates when it should
  (default on; the flagship path always reveals).
- Shared CSS keyframes in `globals.css`: `affexSweep`, `affexBlink`, `affexShoot`, `affexScanLine`,
  `affexCrackOut` (fade+blur+scale).
- Step-label copy per action in `messages/*` (e.g. deepBrief: "reading the page", "gap-fill
  research", "drafting the brief").

## Honesty / edge cases

- **Slow runs:** the scan loops/holds after all steps shown; elapsed keeps ticking; never claims
  completion early.
- **Failure:** on terminal `failed`/`partial`, the overlay/panel exits to the existing error +
  auto-refund messaging (tie into `StateView` warn tone where a full state is warranted).
- **Reload mid-run:** `useAiRunStatus` already resumes from `initialRunId`; the waiting UI
  re-appears automatically on mount when `isRunning`.
- **Reduced motion:** respect `prefers-reduced-motion` — swap the sweep/count-up for a static
  "working…" + instant reveal.

## Rollout

1. **T1 Crack Reveal** for underwriting (flagship) — `AnalyzingOverlay` + `EvidenceBars` reveal.
2. **T2 ScanPanel** + wire the deliverable generate buttons + Diagnose.
3. **T3** compliance strip; discovery running pulse; reduced-motion pass.
