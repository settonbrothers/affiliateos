-- 0026_invite_codes.sql
-- M5: invite-only signup. Admins generate codes; the signup flow validates one
-- (via service role, since the user is anon at signup) and grants bonus credits
-- to the new workspace on redemption.

create table invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  bonus_credits int not null default 0,
  max_uses int not null default 1,
  uses int not null default 0,
  expires_at timestamptz,
  revoked boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  invite_code_id uuid not null references invite_codes(id) on delete cascade,
  user_id uuid references profiles(id),
  workspace_id uuid references workspaces(id),
  credits_granted int not null default 0,
  created_at timestamptz not null default now()
);
create index invite_redemptions_code_idx on invite_redemptions(invite_code_id);

alter table invite_codes enable row level security;
alter table invite_redemptions enable row level security;

-- Only admins manage/see codes. Signup-time validation + redemption run through
-- the service role (the signup server action), so no anon policy is needed.
create policy "admin manage invite_codes" on invite_codes for all
  using (is_current_user_admin());
create policy "admin read invite_redemptions" on invite_redemptions for select
  using (is_current_user_admin());
