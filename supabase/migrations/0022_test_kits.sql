-- 0022_test_kits.sql
-- M4: a generated Test Kit for an offer. Produced by TestKitOrchestrator from
-- the offer's latest underwriting verdict + verified facts. The full kit
-- (objective, angles, hooks, ad copy, landing structure, KPIs, kill/scale
-- criteria) lives in the `payload` jsonb — same envelope+payload shape the
-- orchestrator returns.

create table test_kits (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  workspace_id uuid references workspaces(id),
  created_by_user_id uuid references profiles(id),
  ai_run_id uuid references ai_runs(id),
  -- Which underwriting run this kit was built from (traceability).
  source_underwriting_run_id uuid references ai_runs(id),
  payload jsonb not null,
  status text not null default 'generated', -- generated | archived
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index test_kits_offer_idx on test_kits(offer_id);
create index test_kits_workspace_idx on test_kits(workspace_id) where workspace_id is not null;

alter table test_kits enable row level security;

-- Admins manage everything (offers are admin_only in the MVP); workspace
-- members can read their own workspace's kits. Writes go through the
-- generate-test-kit edge fn (service role), so no member write policy.
create policy "admin manage test_kits" on test_kits for all
  using (is_current_user_admin());
create policy "members read own test_kits" on test_kits for select
  using (workspace_id is not null and is_workspace_member(workspace_id));
