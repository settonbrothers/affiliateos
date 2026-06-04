-- 0025_credits.sql
-- M5 slice 1: the credit economy. usage_pricing_rules maps an AI action to its
-- credit cost; credit_ledger is the append-only source of truth (balance =
-- sum(amount)). Edge functions reserve (debit) before an LLM call and refund on
-- failure. Trial credits are granted on signup so stealth users aren't blocked
-- before Stripe (slice 2) is wired.

create type credit_entry_type as enum (
  'granted',   -- trial / promo grant
  'used',      -- debit for an AI action (amount negative)
  'refunded',  -- reversal of a debit (amount positive)
  'purchased', -- Stripe top-up (slice 2)
  'expired',
  'adjusted'   -- manual admin correction
);

create table usage_pricing_rules (
  action text primary key,
  credits int not null,
  updated_at timestamptz not null default now()
);
insert into usage_pricing_rules (action, credits) values
  ('analyze-offer', 5),
  ('generate-test-kit', 10),
  ('diagnose-results', 5),
  ('check-compliance', 2);

create table credit_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  entry_type credit_entry_type not null,
  amount int not null, -- positive = credit, negative = debit
  action text,         -- the AI action for used/refunded entries
  ai_run_id uuid references ai_runs(id),
  reason text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index credit_ledger_workspace_idx on credit_ledger(workspace_id, created_at desc);

alter table usage_pricing_rules enable row level security;
alter table credit_ledger enable row level security;

create policy "authenticated read pricing" on usage_pricing_rules for select
  using (auth.uid() is not null);
create policy "admin manage pricing" on usage_pricing_rules for all
  using (is_current_user_admin());

create policy "admin manage ledger" on credit_ledger for all
  using (is_current_user_admin());
create policy "members read own ledger" on credit_ledger for select
  using (is_workspace_member(workspace_id));
-- Debits/refunds are written by the edge fns (service role); grants by admins.

-- Extend the signup trigger to also grant trial credits to the new workspace.
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

  insert into public.workspaces (name, created_by)
  values (coalesce(nullif(split_part(new.email, '@', 1), ''), 'workspace'), new.id)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, new.id, 'owner');

  insert into public.workspace_credit_caps (workspace_id)
  values (ws_id);

  insert into public.credit_ledger (workspace_id, entry_type, amount, reason)
  values (ws_id, 'granted', 100, 'Signup trial credits');

  return new;
end;
$$;

-- Backfill: grant trial credits to every existing workspace that has none.
insert into public.credit_ledger (workspace_id, entry_type, amount, reason)
select w.id, 'granted', 100, 'Backfill trial credits'
from public.workspaces w
where not exists (
  select 1 from public.credit_ledger l where l.workspace_id = w.id
);
