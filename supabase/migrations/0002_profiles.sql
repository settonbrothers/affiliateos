-- 0002_profiles.sql
-- User profile rows, 1:1 with auth.users. RLS on from day 1.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  system_role system_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- SECURITY DEFINER helper: an admin check that reads `profiles` WITHOUT being
-- subject to RLS. Required because a SELECT policy on `profiles` that itself
-- queries `profiles` triggers Postgres "infinite recursion detected in policy".
-- Same pattern as is_workspace_member() in 0003. See decisions/001.
create function is_current_user_admin() returns boolean
  language sql security definer stable
  set search_path = public
  as $$
  select exists (
    select 1 from profiles where id = auth.uid() and system_role = 'admin'
  );
$$;

create policy "users read own profile" on profiles for select
  using (auth.uid() = id);

create policy "users update own profile" on profiles for update
  using (auth.uid() = id);

create policy "admins read all" on profiles for select
  using (is_current_user_admin());
