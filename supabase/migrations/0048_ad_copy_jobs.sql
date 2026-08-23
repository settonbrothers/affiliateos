-- 0048_ad_copy_jobs.sql
-- Resumable production copy generation. Each worker invocation performs at
-- most one model call, persists the checkpoint, and hands the job to a fresh
-- Edge runtime clock.

create table ad_copy_jobs (
  id uuid primary key default gen_random_uuid(),
  ai_run_id uuid not null unique references ai_runs(id) on delete cascade,
  offer_id uuid not null references offers(id) on delete cascade,
  workspace_id uuid references workspaces(id),
  user_id uuid references profiles(id),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  input_payload jsonb not null,
  checkpoint jsonb,
  credit_hold jsonb,
  attempt_count integer not null default 0,
  lease_expires_at timestamptz,
  tokens_input integer not null default 0,
  tokens_output integer not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  error_message text,
  refunded_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ad_copy_jobs_claim_idx on ad_copy_jobs(status, lease_expires_at, created_at);
create index ad_copy_jobs_offer_idx on ad_copy_jobs(offer_id, created_at desc);

alter table ad_copy_jobs enable row level security;
create policy "admin manage ad_copy_jobs" on ad_copy_jobs for all
  using (is_current_user_admin()) with check (is_current_user_admin());
create policy "users read own ad_copy_jobs" on ad_copy_jobs for select
  using (user_id = auth.uid());

comment on table ad_copy_jobs is
  'Durable checkpoints for production ad-copy generation across Edge invocations.';
