-- 0008_audit_logs.sql
-- Append-only audit trail for user-facing mutations. Writes go through the
-- service role (edge functions / server); reads are admin-only.

create type audit_action as enum (
  'offer.create', 'offer.update', 'offer.delete', 'offer.publish',
  'ai_run.start', 'ai_run.complete',
  'prompt.activate', 'prompt.rollback',
  'kill_switch.toggle',
  'credit.grant', 'credit.deduct', 'credit.refund',
  'user.invite', 'user.delete',
  'fact.approve', 'fact.reject',
  'subscription.create', 'subscription.cancel'
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references profiles(id),
  action audit_action not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index audit_logs_actor_idx on audit_logs(actor_user_id, created_at desc);
create index audit_logs_entity_idx on audit_logs(entity_type, entity_id);

alter table audit_logs enable row level security;
create policy "admin read audit_logs" on audit_logs for select
  using (is_current_user_admin());
