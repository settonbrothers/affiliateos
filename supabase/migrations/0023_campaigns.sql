-- 0023_campaigns.sql
-- M4: campaigns the operator actually runs against a test kit, the raw results
-- they paste in, and the AI diagnosis of those results.

create type campaign_status as enum (
  'draft',
  'results_entered',
  'diagnosed',
  'archived'
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  test_kit_id uuid references test_kits(id),
  workspace_id uuid references workspaces(id),
  created_by_user_id uuid references profiles(id),
  name text not null,
  channel text,   -- traffic channel actually used
  geo text,
  status campaign_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campaigns_offer_idx on campaigns(offer_id);
create index campaigns_workspace_idx on campaigns(workspace_id) where workspace_id is not null;

-- One current results row per campaign (re-entry upserts).
create table campaign_results (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null unique references campaigns(id) on delete cascade,
  spend_usd numeric(12, 2) not null default 0,
  impressions int not null default 0,
  clicks int not null default 0,
  landing_views int not null default 0,
  conversions int not null default 0,
  revenue_usd numeric(12, 2) not null default 0,
  days_running int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table result_diagnoses (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  ai_run_id uuid references ai_runs(id),
  workspace_id uuid references workspaces(id),
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index result_diagnoses_campaign_idx on result_diagnoses(campaign_id);

alter table campaigns enable row level security;
alter table campaign_results enable row level security;
alter table result_diagnoses enable row level security;

-- Campaigns are operator-owned: workspace members manage their own; admins all.
create policy "admin manage campaigns" on campaigns for all
  using (is_current_user_admin());
create policy "members manage own campaigns" on campaigns for all
  using (workspace_id is not null and is_workspace_member(workspace_id));

-- Results are reachable through the campaign's workspace membership.
create policy "admin manage campaign_results" on campaign_results for all
  using (is_current_user_admin());
create policy "members manage own campaign_results" on campaign_results for all
  using (
    exists (
      select 1 from campaigns c
      where c.id = campaign_results.campaign_id
        and c.workspace_id is not null
        and is_workspace_member(c.workspace_id)
    )
  );

-- Diagnoses are written by the edge fn (service role); members read theirs.
create policy "admin manage result_diagnoses" on result_diagnoses for all
  using (is_current_user_admin());
create policy "members read own result_diagnoses" on result_diagnoses for select
  using (workspace_id is not null and is_workspace_member(workspace_id));
