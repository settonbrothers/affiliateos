-- 0046_copy_evidence_story_v4.sql
-- Staged evidence-bounded story engine. The runtime remains disabled until the
-- sealed 72-run evaluation and owner blind review pass.

alter table ad_copy_generations
  add column if not exists engine_version text not null default 'legacy-v2',
  add column if not exists output_status text
    check (output_status is null or output_status in ('ready_for_user', 'needs_evidence', 'compliance_review', 'blocked')),
  add column if not exists creative_hint text;

create table copy_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  workspace_id uuid references workspaces(id),
  source_id text not null,
  publisher_id text not null,
  source_url text,
  source_type text not null,
  independence text not null check (independence in ('independent', 'first_party', 'owner_verified')),
  quality text not null check (quality in ('low', 'medium', 'high')),
  claim text not null,
  actual_person boolean not null default false,
  source_quote text,
  snapshot_sha256 text not null check (snapshot_sha256 ~ '^[a-f0-9]{64}$'),
  captured_at timestamptz not null default now(),
  unique (offer_id, snapshot_sha256)
);
create index copy_source_snapshots_offer_idx on copy_source_snapshots(offer_id, captured_at desc);
alter table copy_source_snapshots enable row level security;
create policy "admin manage copy_source_snapshots" on copy_source_snapshots for all using (is_current_user_admin());
create policy "members read own copy_source_snapshots" on copy_source_snapshots for select
  using (workspace_id is not null and is_workspace_member(workspace_id));

create table copy_eval_cases (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  domain text not null check (domain in ('donation', 'product')),
  split text not null check (split in ('calibration', 'holdout', 'regression')),
  source_pack jsonb not null,
  sealed_sha256 text not null check (sealed_sha256 ~ '^[a-f0-9]{64}$'),
  revealed_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz not null default now()
);
alter table copy_eval_cases enable row level security;
create policy "admin manage copy_eval_cases" on copy_eval_cases for all using (is_current_user_admin());

create table copy_eval_runs (
  id uuid primary key default gen_random_uuid(),
  protocol_version text not null,
  engine_version text not null,
  baseline_version text not null,
  prompt_manifest_sha256 text not null check (prompt_manifest_sha256 ~ '^[a-f0-9]{64}$'),
  model_id text not null,
  repetitions_per_engine integer not null check (repetitions_per_engine = 3),
  status text not null check (status in ('running', 'awaiting_owner', 'passed', 'failed', 'aborted')),
  metrics jsonb not null default '{}'::jsonb,
  details jsonb not null default '[]'::jsonb,
  total_cost_usd numeric(10, 4),
  started_by uuid references profiles(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index copy_eval_runs_started_idx on copy_eval_runs(started_at desc);
alter table copy_eval_runs enable row level security;
create policy "admin manage copy_eval_runs" on copy_eval_runs for all using (is_current_user_admin());

create table copy_eval_owner_scores (
  id uuid primary key default gen_random_uuid(),
  eval_run_id uuid not null references copy_eval_runs(id) on delete cascade,
  case_id uuid not null references copy_eval_cases(id),
  blind_left_id text not null,
  blind_right_id text not null,
  presented_repetition integer not null check (presented_repetition between 0 and 2),
  scores jsonb not null,
  preference text not null check (preference in ('left', 'right', 'tie')),
  publishability_left boolean not null,
  publishability_right boolean not null,
  truth_reject_left boolean not null default false,
  truth_reject_right boolean not null default false,
  scored_by uuid not null references profiles(id),
  scored_at timestamptz not null default now(),
  unique (eval_run_id, case_id)
);
alter table copy_eval_owner_scores enable row level security;
create policy "admin manage copy_eval_owner_scores" on copy_eval_owner_scores for all using (is_current_user_admin());
