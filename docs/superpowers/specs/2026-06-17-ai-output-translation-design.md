# AI-Output Translation (Hebrew) — Design

> Status: approved approach (gisha B, 2026-06-17). Next: implementation plan.

## Goal

Show AI-generated content (underwriting verdict/reasoning, discovery deep
analysis, test kits, diagnoses, compliance) in Hebrew for Hebrew-locale users,
WITHOUT touching the canonical English payload the eval / golden set / LLM-judge
depend on. Approach: **translate-after + cache** (decided with the owner).

## Principles

1. **Canonical payload stays English.** Generation is unchanged; eval/judge/
   rubric keep running on English. Zero impact on the quality system.
2. **Translate only free-text fields** (summaries, reasons, evidence,
   recommendations). Structured fields (scores, enums, verdict keys) stay
   canonical; their human labels are already translated as UI chrome.
3. **Lazy + cached.** A payload is translated to a locale on first view and
   cached; subsequent views are free.
4. **Best-effort / degrade-open.** If translation fails or isn't ready, show the
   English payload — never block the page.

## Data model

New migration `0031_content_translations.sql`:

```sql
create table content_translations (
  source_table text not null,   -- 'ai_runs' | 'discovery_candidates'
  source_id uuid not null,
  locale text not null,         -- 'he'
  payload jsonb not null,       -- translated free-text fields, same keys
  created_at timestamptz not null default now(),
  primary key (source_table, source_id, locale)
);
alter table content_translations enable row level security;
-- Read: anyone who can read the underlying row (admin-only tables today, so
-- admin; broaden when offers open up). Write: service role (edge) only.
create policy "read content_translations" on content_translations
  for select using (is_current_user_admin());
```

(RLS mirrors the source tables, which are admin-readable today. When user-facing
offer AI surfaces need it, widen the policy alongside the offer-visibility rule.)

## Components

- **Translation orchestrator** `_shared/orchestrators/translate.ts` (Haiku):
  input = a flat `{ key: englishText }` map + target locale; output = same keys
  translated. Real-or-mock; Zod-validated (keys preserved).
- **Edge function** `translate-content` (admin-gated, kill-switch + ai_runs
  cost): body `{ source_table, source_id, locale }`. Loads the source row's
  payload, extracts the known free-text fields for that orchestrator type,
  calls the orchestrator, upserts `content_translations`. Idempotent.
- **Field maps** (`_shared/translatable.ts`): per source type, which jsonb paths
  are free-text (e.g. underwriting: `main_reason_to_test`, `main_reason_to_avoid`,
  `kill_criteria[]`, envelope `facts[].statement`; discovery deep: `summary`,
  `key_strengths[]`, `key_risks[]`, `hard_filters.*.evidence`,
  `must_verify_before_budget[]`, `signals.*.value/evidence`).
- **Display query** `getTranslatedPayload(sourceTable, id, locale, english)`:
  returns the cached translation merged over the English payload, or the English
  payload if none; triggers a background fill (fire-and-forget server action)
  when missing + locale is he.
- **Wiring**: the 6 display surfaces (OfferScorecard reasoning, OfferVerdict,
  TestKitView, DiagnosisView, ComplianceView, discovery CandidateRow) read the
  merged payload when locale === 'he'.

## Phasing

- **A:** migration + orchestrator + field maps + edge fn + dual contracts + mock.
- **B:** the display query + wire the surfaces (start with OfferVerdict +
  discovery CandidateRow — highest value — then the rest).

## Cost

Haiku translation of one payload ≈ $0.001–0.005, cached once per (row, locale).
Negligible and bounded.

## Out of scope

Translating offer names / user data; RTL (already done); locales beyond he;
real-time streaming translation.
