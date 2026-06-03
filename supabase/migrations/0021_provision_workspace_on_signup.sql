-- 0021_provision_workspace_on_signup.sql
-- Until now, signup created only a profiles row — no workspace. That left
-- offers.workspace_id and ai_runs.workspace_id permanently NULL, which silently
-- disabled the daily-USD-cap guard (it is gated on `if (offer.workspace_id)`)
-- and the workspace-scoped RLS paths. MVP is 1 user : 1 workspace, so we now
-- provision a personal workspace (+ owner membership + default credit caps) for
-- every new user, and backfill the same for existing users/offers/ai_runs.

-- 1) Go-forward: extend the new-user trigger to provision the workspace.
create or replace function handle_new_user() returns trigger
  language plpgsql security definer
  set search_path = public
  as $$
declare
  ws_id uuid;
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  -- Personal workspace. Name defaults to the email local-part for readability.
  insert into public.workspaces (name, created_by)
  values (coalesce(nullif(split_part(new.email, '@', 1), ''), 'workspace'), new.id)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, new.id, 'owner');

  -- Default budget caps so admins have a row to edit and the guard has an
  -- explicit ceiling (costCap.ts also defaults to $10 when absent).
  insert into public.workspace_credit_caps (workspace_id)
  values (ws_id);

  return new;
end;
$$;

-- 2) Backfill: provision a workspace for any existing user without membership.
do $$
declare
  r record;
  ws_id uuid;
begin
  for r in
    select p.id, p.email
    from public.profiles p
    where not exists (
      select 1 from public.workspace_members m where m.user_id = p.id
    )
  loop
    insert into public.workspaces (name, created_by)
    values (coalesce(nullif(split_part(r.email, '@', 1), ''), 'workspace'), r.id)
    returning id into ws_id;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (ws_id, r.id, 'owner');

    insert into public.workspace_credit_caps (workspace_id)
    values (ws_id);
  end loop;
end $$;

-- 3) Backfill existing rows so historical data is workspace-scoped too.
update public.offers o
set workspace_id = m.workspace_id
from public.workspace_members m
where o.workspace_id is null
  and m.user_id = o.created_by_user_id;

update public.ai_runs ar
set workspace_id = m.workspace_id
from public.workspace_members m
where ar.workspace_id is null
  and m.user_id = ar.user_id;
