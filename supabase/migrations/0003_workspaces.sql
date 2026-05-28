-- 0003_workspaces.sql
-- Workspaces + membership. MVP is 1 user : 1 workspace, but the structure
-- supports teams later. RLS via a SECURITY DEFINER membership helper.

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role workspace_role not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table workspaces enable row level security;
alter table workspace_members enable row level security;

-- SECURITY DEFINER so the membership lookup is not itself subject to RLS
-- (avoids recursion on workspace_members policies). set search_path per
-- decisions/001 hardening (Supabase advisor flags mutable search_path).
create function is_workspace_member(ws_id uuid) returns boolean
  language sql security definer stable
  set search_path = public
  as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  );
$$;

create policy "members read workspace" on workspaces for select
  using (is_workspace_member(id));
create policy "members read their membership" on workspace_members for select
  using (user_id = auth.uid() or is_workspace_member(workspace_id));
