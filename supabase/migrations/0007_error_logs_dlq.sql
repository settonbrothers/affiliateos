-- 0007_error_logs_dlq.sql
-- Structured, queryable error log + dead-letter queue for failed work.

create type error_severity as enum ('debug', 'info', 'warning', 'error', 'critical');

create table error_logs (
  id uuid primary key default gen_random_uuid(),
  severity error_severity not null,
  source text not null,  -- 'edge:analyze-offer' etc
  message text not null,
  context jsonb,
  user_id uuid references profiles(id),
  workspace_id uuid references workspaces(id),
  created_at timestamptz not null default now()
);
create index error_logs_created_idx on error_logs(created_at desc);
create index error_logs_severity_idx on error_logs(severity) where severity in ('error', 'critical');

create type failed_message_type as enum ('ai_run', 'webhook_send', 'email_send', 'stripe_webhook');
create type failed_message_status as enum ('pending', 'retrying', 'succeeded', 'abandoned');

create table failed_messages (
  id uuid primary key default gen_random_uuid(),
  message_type failed_message_type not null,
  payload jsonb not null,
  attempts int not null default 0,
  max_attempts int not null default 3,
  last_error text,
  status failed_message_status not null default 'pending',
  next_retry_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index failed_messages_status_idx on failed_messages(status, next_retry_at);

alter table error_logs enable row level security;
alter table failed_messages enable row level security;
create policy "admin read error_logs" on error_logs for select
  using (is_current_user_admin());
create policy "admin read failed_messages" on failed_messages for select
  using (is_current_user_admin());
create policy "admin write failed_messages" on failed_messages for all
  using (is_current_user_admin());
