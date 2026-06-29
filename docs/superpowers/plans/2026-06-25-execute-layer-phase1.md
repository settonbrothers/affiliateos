# Execute Layer — Phase 1 Implementation Plan (v2)

> Status: **Pending Izhak approval** (2026-06-25). Author: ARTURO (operational), from ANGELO's design
> spec + Izhak's refinements. No product code written until approved. Build = TDD, task order below.
> Planning = Izhak + ANGELO; build = ARTURO under Izhak's explicit approval.

## Scope (locked)
Facebook ad copy only · Hebrew + English (native, not machine-translated) · pipeline
ProductExcavate + AvatarExcavate → Angle → Hook → Copy → Judge/Refine (refine ≤ 2) · built on the
existing orchestrator pattern + guardrails (kill-switch, daily USD cap, credit guard, LLM-judge, DLQ)
+ credits + i18n · Opus for generation + judging · internal dogfooding first (Izhak + Israel).

## Approved architecture decisions
1. ONE orchestrator (`generate-ad-copy`) with internal sequential stages (precedent: `discover-offers`
   runs triage→mine→deep internally). One ai_run, one credit charge, one stored generation.
2. Bilingual copy generated NATIVELY in he + en (transcreation, not `translate-content`). Both judged.
3. New tables in migration 0032 with workspace-scoped + admin RLS.
4. Opus model + pricing added to `anthropicJson.ts` PRICING map (exact Opus rate verified vs the live
   API at build time — do NOT hardcode an unverified number).

## Izhak refinements folded in
- **Excavate = two explicit deep legs**, both feeding Angle→Hook→Copy:
  - **Product-excavation:** what the product truly solves and where it is genuinely best (not feature-listing).
  - **Avatar-excavation:** exactly who the reader is, their pain in their own words, objections, desires.
    NOTE: avatar here = COPY foundation, not audience targeting (targeting stays Phase 3).
- **Taste Corpus (critical):** the engine ingests a human taste set.
  - Seed: Izhak + Israel supply ~50 copy examples + avatar analyses via a simple sheet/doc the system
    reads (CSV/Sheet export — no complex UI).
  - Dual use: (a) few-shot for Angle/Hook/Copy; (b) judge CALIBRATION. The judge does NOT hard-block
    quality until it is calibrated against the human-labelled examples — never against fixtures ARTURO
    invents.
- **Edit-Loop (the flywheel):** the UI is editable, not read-only.
  - Izhak edits the agent's copy in-system; we save original + edited + good/bad + reason.
  - The (original → edited) pair is the strongest learning signal; it flows back into the Taste Corpus.
  - Keep it simple: textarea + save + rating. No diff-viewer yet.
- **Knowledge Base:** distil copy frameworks (Hormozi, Izhak's lessons) directly into the prompts and the
  judge rubric (prompt-engineering). No RAG / no book ingestion in Phase 1.
- **Cost:** no invented number. Build → run ONE real generation → measure actual USD → set per-generation
  cap ≈ 2× measured → derive credits price from cost → report the numbers to Izhak before finalizing.

## Inputs needed from Izhak/Israel
- **I1:** Seed Taste Corpus doc (~50 labelled copy + avatar examples, good/bad + reason). Gates T0/T5.
- **I2:** Izhak's copy frameworks / lesson notes for the Knowledge-Base prompts (may ride inside I1).
- **I3 (heads-up):** the current GitHub deploy key is READ-ONLY. Landing Phase-1 code in the repo will
  need a write/push path (operator decision) — not required for planning, required before merge.

## TDD task order

**T0 — Taste Corpus ingestion (first; gates quality)**
- Table `copy_taste_examples` (in 0032): {id, kind: copy|avatar, lang, text, label: good|bad, reason,
  source: seed|edit_loop, offer_id?, vertical_id?, created_at}.
- `scripts/seed-taste-corpus.mjs`: reads a CSV/Sheet export (I1) → inserts rows. Idempotent.
- Tests: row validation; idempotent re-run.

**T1 — Contracts (dual Zod) [test-first]**
- `src/types/agents/adCopy.ts` + `supabase/functions/_shared/types/adCopy.ts` (KEEP IN SYNC, decisions/003).
- Schemas: `ProductExcavationSchema`, `AvatarExcavationSchema`, `AngleSchema`, `HookSchema`,
  `AdCopyVariantSchema` (primary_text, headline, hook, lang: he|en), `AdCopyResponseSchema =
  UniversalEnvelope.extend({ payload })`, `JudgeRubricSchema` (per-principle pass/fail + reasons).
- Tests: valid/invalid payloads, lang enum.

**T2 — Migration 0032 + RLS + credits placeholder**
- Tables: `ad_copy_generations` (offer_id, workspace_id, ai_run_id, payload jsonb, status),
  `ad_copy_edits` (generation_id, variant_ref, original_text, edited_text, rating good|bad, reason,
  created_by), `copy_taste_examples` (T0).
- RLS: `is_current_user_admin()` + `is_workspace_member(workspace_id)` per house style.
- Seed `usage_pricing_rules` with a PLACEHOLDER for `generate-ad-copy` (finalized in T8 from measurement).
- Regen `database.ts` on main after merge (not from branch).

**T3 — Prompts (Knowledge Base baked in)**
- `prompts/copy_excavate_product/v1.md`, `copy_excavate_avatar/v1.md`, `copy_angle/v1.md`,
  `copy_hook/v1.md`, `copy_write/v1.md` (bilingual; few-shot slots from Taste Corpus), `copy_judge/v1.md`
  (3-principle rubric + compliance; Hormozi/Izhak frameworks embedded).
- `pnpm prompts:sync`.

**T4 — Orchestrator [test-first on pure logic]**
- `supabase/functions/_shared/orchestrators/adCopy.ts`: `runAdCopy(input)` =
  productExcavate + avatarExcavate → angle → hook → write(he+en, few-shot from corpus) → judge →
  refine(≤2, advisory until judge calibrated) with `costGuard(accumUsd, MAX_USD)`.
- Pure functions tested without LLM: message builders, `shouldRefine()`, `costGuard()`,
  corpus few-shot selection, `assembleResponse()`.

**T5 — Copy-judge + calibration [against real corpus, not invented fixtures]**
- Judge orchestrator + `copy_judge` prompt scoring the 3 principles + compliance.
- Calibrate: run judge over the labelled seed corpus, measure agreement with human good/bad labels.
- Judge stays ADVISORY (surfaces scores, does not gate refine/reject) until agreement ≥ threshold
  (report agreement % to Izhak). Tests assert calibration runs on the seed corpus.

**T6 — Edge function**
- `supabase/functions/generate-ad-copy/index.ts`: auth → kill-switch(`AdCopyOrchestrator`) → daily cap →
  reserveCredits → recordRunStart → waitUntil(runAdCopy → judge → persist `ad_copy_generations` →
  recordRunSuccess / on-error refund + DLQ) → `{ run_id }`.

**T7 — UI (bilingual) + Edit-Loop**
- Offer detail: new `copy` tab (`TAB_KEYS`, `TAB_LABELS`, conditional fetch).
- `src/components/offers/AdCopyView.tsx` (server; he/en variants + judge scores),
  `ExecuteCopyButton.tsx` (client + Realtime on ai_runs),
  `AdCopyEditor.tsx` (client; textarea edit + good/bad + reason → `triggerSaveCopyEdit` → `ad_copy_edits`
  → feeds Taste Corpus).
- `src/lib/actions/adCopy.ts` (`triggerGenerateAdCopy`, `triggerSaveCopyEdit`), query in `queries/offers.ts`.
- i18n keys in `messages/{en,he}.json`.

**T8 — E2E + cost measurement + finalize price**
- `scripts/test-adcopy-e2e.mjs` (real AI, costs money): existing offer → generate → assert ai_run success
  + `ad_copy_generations` row + bilingual variants + judge scored + cost recorded.
- Measure actual USD of one full generation → set `MAX_USD_PER_GENERATION ≈ 2×` → derive credits price →
  update `usage_pricing_rules` → REPORT numbers to Izhak.
- `pnpm typecheck && pnpm lint && pnpm test` green.

## Out of scope (Phase 2–4)
Image generation, audience/targeting, multi-channel export, automatic Learn-loop feedback, RAG knowledge
ingestion, diff-viewer.

## Definition of Done (Phase 1)
- Generates bilingual FB ad copy for an existing offer, grounded in product + avatar excavation + Taste
  Corpus few-shot.
- Judge calibrated against the human seed corpus (agreement reported); advisory until calibrated.
- Edit-Loop persists original→edited pairs back into the corpus.
- Cost measured, cap + credits price set from real numbers and reported.
- Izhak/Israel dogfood and judge output ≥ "better than a good marketer alone."
