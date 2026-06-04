-- 0027_stripe.sql
-- M5 Stripe slice. Maps Stripe customers/subscriptions to workspaces and records
-- processed webhook events for idempotency. Credit grants from payments land in
-- credit_ledger (entry_type 'purchased'), so the credit economy is unchanged —
-- Stripe just funds it.

create table stripe_customers (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  stripe_subscription_id text not null unique,
  status text not null,                 -- active | past_due | canceled | ...
  plan text not null default 'pro',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_workspace_idx on subscriptions(workspace_id);

-- Webhook idempotency: an event id is inserted once; a duplicate delivery is a
-- no-op (unique violation -> skip).
create table stripe_events (
  event_id text primary key,
  type text not null,
  created_at timestamptz not null default now()
);

alter table stripe_customers enable row level security;
alter table subscriptions enable row level security;
alter table stripe_events enable row level security;

create policy "admin manage stripe_customers" on stripe_customers for all
  using (is_current_user_admin());
create policy "members read own stripe_customers" on stripe_customers for select
  using (is_workspace_member(workspace_id));

create policy "admin manage subscriptions" on subscriptions for all
  using (is_current_user_admin());
create policy "members read own subscriptions" on subscriptions for select
  using (is_workspace_member(workspace_id));

create policy "admin read stripe_events" on stripe_events for select
  using (is_current_user_admin());
-- stripe_events is written only by the webhook (service role).
