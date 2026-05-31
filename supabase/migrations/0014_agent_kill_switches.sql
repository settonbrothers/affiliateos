-- 0014_agent_kill_switches.sql
-- Per-orchestrator emergency stop. Each orchestrator checks its row before
-- doing any LLM work; flipping is_paused immediately blocks new runs.

create table agent_kill_switches (
  orchestrator_name text primary key,
  is_paused boolean not null default false,
  paused_by uuid references profiles(id),
  paused_at timestamptz,
  reason text,
  updated_at timestamptz not null default now()
);

insert into agent_kill_switches (orchestrator_name) values
  ('UnderwritingOrchestrator'),
  ('SourceExtractionOrchestrator'),
  ('TestKitOrchestrator'),
  ('DiagnosisOrchestrator'),
  ('ComplianceCheckOrchestrator');

alter table agent_kill_switches enable row level security;
create policy "admin read kill_switches" on agent_kill_switches for select
  using (is_current_user_admin());
create policy "admin update kill_switches" on agent_kill_switches for update
  using (is_current_user_admin());
-- Inserts intentionally not policy-allowed: the only inserts come from this
-- migration. New orchestrators get added by a future migration.
