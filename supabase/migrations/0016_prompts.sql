-- 0016_prompts.sql
-- DB-backed prompt versioning. Markdown files in prompts/<orchestrator>/<version>.md
-- are the source of truth in git; scripts/prompts-sync.mjs upserts each into this
-- table. The rollback flow (M3 /admin/prompts) flips `is_active` to swap versions
-- in <60s, no redeploy needed.

create type prompt_type as enum ('main', 'judge', 'extractor', 'compliance');

create table prompts (
  id uuid primary key default gen_random_uuid(),
  orchestrator_name text not null,
  prompt_type prompt_type not null default 'main',
  version text not null,         -- 'v1', 'v2', ...
  vertical_id uuid references verticals(id),  -- nullable = global
  content text not null,
  is_active boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique (orchestrator_name, prompt_type, version, vertical_id)
);
create index prompts_active_idx
  on prompts(orchestrator_name, prompt_type, vertical_id, is_active);

alter table prompts enable row level security;
create policy "admin read prompts" on prompts for select
  using (is_current_user_admin());
create policy "admin write prompts" on prompts for all
  using (is_current_user_admin());
-- Sync script + service-role reads bypass RLS (admin client).
