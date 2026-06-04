-- 0028_operator_profiles.sql
-- M5: post-signup onboarding captures the operator's context (the plan's
-- user_context for underwriting operator_fit). One row per user; the (app)
-- layout redirects to /onboarding until onboarded_at is set.

create table operator_profiles (
  user_id uuid primary key references profiles(id) on delete cascade,
  experience_level text,         -- student | intermediate | advanced
  cashflow_tolerance text,       -- tight | medium | flexible
  primary_channels text[] not null default '{}',
  budget_min_usd int,
  budget_max_usd int,
  preferred_vertical_id uuid references verticals(id),
  onboarded_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table operator_profiles enable row level security;
create policy "users manage own operator_profile" on operator_profiles for all
  using (user_id = auth.uid());

-- Backfill existing users as already-onboarded so they aren't pushed through
-- the flow. New signups have no row -> they get onboarding.
insert into public.operator_profiles (user_id, onboarded_at)
select id, now() from public.profiles
on conflict (user_id) do nothing;
