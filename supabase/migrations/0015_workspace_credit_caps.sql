-- 0015_workspace_credit_caps.sql
-- Per-workspace spend ceilings (USD and credits) + a daily roll-up the
-- orchestrators increment after every LLM call. Stops a single workspace from
-- burning the AI budget if something goes wrong.

create table workspace_credit_caps (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  daily_usd_cap numeric(10, 2) not null default 10.00,
  monthly_usd_cap numeric(10, 2) not null default 100.00,
  daily_credits_cap int not null default 50,
  monthly_credits_cap int not null default 500,
  updated_at timestamptz not null default now()
);

create table workspace_daily_usage (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  day date not null,
  usd_spent numeric(10, 4) not null default 0,
  credits_spent int not null default 0,
  primary key (workspace_id, day)
);

alter table workspace_credit_caps enable row level security;
alter table workspace_daily_usage enable row level security;

create policy "members read own caps" on workspace_credit_caps for select
  using (is_workspace_member(workspace_id));
create policy "admin manage caps" on workspace_credit_caps for all
  using (is_current_user_admin());

create policy "members read own usage" on workspace_daily_usage for select
  using (is_workspace_member(workspace_id));
-- Inserts/updates go through the service role (edge functions), so no write
-- policy is needed for end-users.
