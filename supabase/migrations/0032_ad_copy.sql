-- 0032_ad_copy.sql
-- Execute Layer (Phase 1): Facebook ad copy generation + the Edit-Loop flywheel
-- + a continuously-growing human Taste Corpus.
--
-- ad_copy_generations: one AdCopyOrchestrator run for an offer. The full pipeline
--   output (product/avatar excavation, angles, hooks, bilingual variants, judge)
--   lives in `payload` jsonb — same envelope+payload shape the orchestrator returns.
-- ad_copy_edits: the flywheel. An operator edits a generated variant in-system;
--   we keep original + edited + good/bad + reason. The (original -> edited) pair is
--   the strongest learning signal and is fed back into the Taste Corpus.
-- copy_taste_examples: the human taste set. Added CONTINUOUSLY (Edit-Loop is the
--   main feeder; bulk import optional). Dual use: few-shot for writing + judge
--   calibration. Not a one-time seed and not a blocking precondition.

-- ── Generations ──────────────────────────────────────────────────────────────
create table ad_copy_generations (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  workspace_id uuid references workspaces(id),
  created_by_user_id uuid references profiles(id),
  ai_run_id uuid references ai_runs(id),
  -- Which underwriting run grounded this copy (traceability to the verdict).
  source_underwriting_run_id uuid references ai_runs(id),
  payload jsonb not null,
  status text not null default 'generated'
    check (status in ('generated', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ad_copy_generations_offer_idx on ad_copy_generations(offer_id);
create index ad_copy_generations_workspace_idx
  on ad_copy_generations(workspace_id) where workspace_id is not null;

alter table ad_copy_generations enable row level security;
create policy "admin manage ad_copy_generations" on ad_copy_generations for all
  using (is_current_user_admin());
create policy "members read own ad_copy_generations" on ad_copy_generations for select
  using (workspace_id is not null and is_workspace_member(workspace_id));

-- ── Edit-Loop ────────────────────────────────────────────────────────────────
create table ad_copy_edits (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references ad_copy_generations(id) on delete cascade,
  workspace_id uuid references workspaces(id),
  edited_by_user_id uuid references profiles(id),
  -- Which variant was edited (lang + its index within the generation's variants).
  variant_lang text not null check (variant_lang in ('he', 'en')),
  variant_index integer not null check (variant_index >= 0),
  original_text text not null,
  edited_text text not null,
  rating text not null check (rating in ('good', 'bad')),
  reason text,
  created_at timestamptz not null default now()
);
create index ad_copy_edits_generation_idx on ad_copy_edits(generation_id);

alter table ad_copy_edits enable row level security;
create policy "admin manage ad_copy_edits" on ad_copy_edits for all
  using (is_current_user_admin());
create policy "members read own ad_copy_edits" on ad_copy_edits for select
  using (workspace_id is not null and is_workspace_member(workspace_id));

-- ── Taste Corpus (continuous) ────────────────────────────────────────────────
create table copy_taste_examples (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('copy', 'avatar')),
  lang text not null check (lang in ('he', 'en')),
  text text not null,
  -- Optional improved/edited version (the strong signal from the Edit-Loop).
  improved_text text,
  label text not null check (label in ('good', 'bad')),
  reason text,
  source text not null default 'manual'
    check (source in ('seed', 'edit_loop', 'manual')),
  -- Optional provenance / scoping.
  workspace_id uuid references workspaces(id),
  offer_id uuid references offers(id) on delete set null,
  vertical_id uuid references verticals(id),
  source_edit_id uuid references ad_copy_edits(id) on delete set null,
  created_by_user_id uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index copy_taste_examples_kind_lang_idx on copy_taste_examples(kind, lang);
create index copy_taste_examples_vertical_idx
  on copy_taste_examples(vertical_id) where vertical_id is not null;

alter table copy_taste_examples enable row level security;
-- Admin-managed taste set (dogfooding is admin-only). Members may read examples
-- scoped to their workspace; global (workspace-null) examples stay admin-only.
create policy "admin manage copy_taste_examples" on copy_taste_examples for all
  using (is_current_user_admin());
create policy "members read own copy_taste_examples" on copy_taste_examples for select
  using (workspace_id is not null and is_workspace_member(workspace_id));

-- ── Pricing (PLACEHOLDER) ────────────────────────────────────────────────────
-- generate-ad-copy is the heaviest action (multi-stage + bilingual + judge/refine
-- on Opus), so this 15-credit value is a deliberate PLACEHOLDER only. It is
-- finalized in T8 from ONE real measured generation (actual USD -> ~2x cap ->
-- derived credit price), per the Phase-1 plan. Idempotent + non-destructive so a
-- later T8 update (or a re-run) never clobbers a finalized value.
insert into usage_pricing_rules (action, credits) values
  ('generate-ad-copy', 15)
on conflict (action) do nothing;
