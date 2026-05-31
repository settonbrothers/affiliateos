-- 0012_source_fetch_jobs.sql
-- Async job tracking for the ingest-source edge function:
-- queued -> fetching -> extracting -> completed (or failed). On completion the
-- job points at the source_document it produced.

create type fetch_job_status as enum ('queued', 'fetching', 'extracting', 'completed', 'failed');

create table source_fetch_jobs (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  url text not null,
  status fetch_job_status not null default 'queued',
  triggered_by uuid not null references profiles(id),
  source_document_id uuid references source_documents(id),
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index source_fetch_jobs_status_idx on source_fetch_jobs(status, created_at);

alter table source_fetch_jobs enable row level security;
create policy "admin manage source_fetch_jobs" on source_fetch_jobs for all
  using (is_current_user_admin());
