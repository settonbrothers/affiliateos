-- 0006_ai_runs.sql
-- Every orchestrator invocation is recorded here (even failures). Realtime is
-- enabled so the UI can react to status changes without polling.

create type ai_run_status as enum ('pending', 'running', 'success', 'partial', 'failed');

create table ai_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id),
  user_id uuid references profiles(id),
  offer_id uuid references offers(id),
  related_entity_type text,
  related_entity_id uuid,
  orchestrator_name text not null,  -- 'UnderwritingOrchestrator' etc
  agent_version text not null,
  prompt_version_id uuid,  -- nullable, points to prompt_versions in M3+
  provider text not null default 'anthropic',
  model text not null,
  input_payload jsonb not null,
  output_payload jsonb,
  validated_output jsonb,
  envelope jsonb,  -- universal envelope: facts/assumptions/estimates/risks/unknowns/missing_data/confidence
  status ai_run_status not null default 'pending',
  error_message text,
  tokens_input int,
  tokens_output int,
  estimated_cost numeric(10, 6),
  credits_charged int default 0,
  langfuse_trace_id text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index ai_runs_offer_idx on ai_runs(offer_id);
create index ai_runs_user_idx on ai_runs(user_id);
create index ai_runs_status_idx on ai_runs(status);
create index ai_runs_orchestrator_idx on ai_runs(orchestrator_name);

alter table ai_runs enable row level security;
create policy "admin read all ai_runs" on ai_runs for select
  using (exists (select 1 from profiles where id = auth.uid() and system_role = 'admin'));
create policy "users read their own ai_runs" on ai_runs for select
  using (user_id = auth.uid());

-- Realtime publication
alter publication supabase_realtime add table ai_runs;
