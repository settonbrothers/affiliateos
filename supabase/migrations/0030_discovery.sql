-- 0030_discovery.sql
-- Discovery Scanner v1: broad source-driven discovery → transparent two-stage
-- funnel → admin approval → promote to a real offer. All tables admin-only;
-- users never see candidates, only the offers an admin approves.

create type discovery_source_kind as enum ('web_search', 'directory', 'network');
create type discovery_run_status as enum (
  'queued', 'discovering', 'triaging', 'analyzing', 'completed', 'failed'
);
-- Candidate lifecycle through the funnel. 'rejected' is terminal-at-a-stage
-- (see rejection_stage); 'approved' means an admin accepted it; 'promoted'
-- means it became a real offer.
create type discovery_candidate_stage as enum (
  'discovered', 'triaged', 'analyzed', 'rejected', 'approved', 'promoted'
);

-- Admin-managed registry of where to scan. config holds kind-specific settings
-- (web_search: { query_templates: text[] }). network/directory kinds are
-- reserved for later phases.
create table discovery_sources (
  id uuid primary key default gen_random_uuid(),
  kind discovery_source_kind not null default 'web_search',
  name text not null,
  vertical_id uuid references verticals(id),
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index discovery_sources_enabled_idx on discovery_sources(enabled);

-- One row per "Start scan" click.
create table discovery_runs (
  id uuid primary key default gen_random_uuid(),
  triggered_by uuid references profiles(id),
  vertical_id uuid references verticals(id),
  status discovery_run_status not null default 'queued',
  config jsonb not null default '{}'::jsonb,   -- { breadth, queries_per_source, results_per_query }
  counts jsonb not null default '{}'::jsonb,    -- { discovered, triaged, analyzed, approved }
  total_cost_usd numeric(10,4) not null default 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index discovery_runs_status_idx on discovery_runs(status);
create index discovery_runs_created_idx on discovery_runs(created_at desc);

-- One row per discovered candidate. Keeps the full funnel trail: triage score +
-- reason, deep analysis + score, and — if it dropped — the stage and reason.
create table discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references discovery_runs(id) on delete cascade,
  source_id uuid references discovery_sources(id),
  vertical_id uuid references verticals(id),
  name text not null,
  url text,
  domain text,                       -- normalized, for dedup
  raw_snippet text,
  stage discovery_candidate_stage not null default 'discovered',
  triage_score int,                  -- 0-100
  triage_reason text,
  deep_analysis jsonb,               -- full deep-analysis payload
  deep_score int,                    -- 0-100 overall quality
  rejection_stage discovery_candidate_stage,  -- which stage it dropped at
  rejection_reason text,
  promoted_offer_id uuid references offers(id),
  created_at timestamptz not null default now()
);
create index discovery_candidates_run_idx on discovery_candidates(run_id);
create index discovery_candidates_stage_idx on discovery_candidates(stage);
create index discovery_candidates_domain_idx on discovery_candidates(domain);

alter table discovery_sources enable row level security;
alter table discovery_runs enable row level security;
alter table discovery_candidates enable row level security;

create policy "admin manage discovery_sources" on discovery_sources for all
  using (is_current_user_admin());
create policy "admin manage discovery_runs" on discovery_runs for all
  using (is_current_user_admin());
create policy "admin manage discovery_candidates" on discovery_candidates for all
  using (is_current_user_admin());

-- Seed one web_search source per vertical so the first scan works out of the box.
insert into discovery_sources (kind, name, vertical_id, config)
select
  'web_search',
  'Web search — ' || v.name,
  v.id,
  jsonb_build_object('query_templates', jsonb_build_array(
    'best ' || v.name || ' affiliate programs ' || extract(year from now())::text,
    'high commission ' || v.name || ' affiliate program',
    v.name || ' partner program payout terms'
  ))
from verticals v;
