-- 0047_campaign_economics_agency.sql
-- Internal offer economics and the complete paid-traffic funnel. Additive only:
-- legacy USD fields remain readable while callers move to explicit currencies.

create table offer_economics (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  workspace_id uuid references workspaces(id),
  schema_version text not null default 'offer-economics-v1'
    check (schema_version = 'offer-economics-v1'),
  payload jsonb not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  is_current boolean not null default true,
  source_label text,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index offer_economics_one_current_idx
  on offer_economics(offer_id) where is_current;
create index offer_economics_history_idx
  on offer_economics(offer_id, captured_at desc);
alter table offer_economics enable row level security;
create policy "admin manage offer_economics" on offer_economics for all
  using (is_current_user_admin()) with check (is_current_user_admin());
create policy "members read own offer_economics" on offer_economics for select
  using (workspace_id is not null and is_workspace_member(workspace_id));

alter table campaigns
  add column if not exists reporting_currency text not null default 'USD'
    check (reporting_currency ~ '^[A-Z]{3}$');

alter table campaign_results
  add column if not exists spend_amount numeric(12, 2),
  add column if not exists spend_currency text,
  add column if not exists affiliate_clicks int not null default 0,
  add column if not exists approved_conversions int not null default 0,
  add column if not exists reversed_conversions int not null default 0,
  add column if not exists commission_amount numeric(12, 2),
  add column if not exists commission_currency text;

update campaign_results
set spend_amount = spend_usd,
    spend_currency = 'USD',
    commission_amount = revenue_usd,
    commission_currency = 'USD'
where spend_amount is null;

alter table campaign_results
  alter column spend_amount set default 0,
  alter column spend_amount set not null,
  alter column spend_currency set default 'USD',
  alter column spend_currency set not null,
  add constraint campaign_results_spend_amount_nonnegative
    check (spend_amount >= 0),
  add constraint campaign_results_spend_currency_iso
    check (spend_currency ~ '^[A-Z]{3}$'),
  add constraint campaign_results_affiliate_clicks_nonnegative
    check (affiliate_clicks >= 0),
  add constraint campaign_results_approved_nonnegative
    check (approved_conversions >= 0),
  add constraint campaign_results_reversed_nonnegative
    check (reversed_conversions >= 0),
  add constraint campaign_results_commission_nonnegative
    check (commission_amount is null or commission_amount >= 0),
  add constraint campaign_results_commission_currency_iso
    check (commission_currency is null or commission_currency ~ '^[A-Z]{3}$');

comment on table offer_economics is
  'Internal payout facts and provenance. Never expose as advertising claims.';
comment on column campaign_results.affiliate_clicks is
  'Clicks from the marketer landing page to the affiliate offer.';
comment on column campaign_results.approved_conversions is
  'Network-approved conversions; distinct from raw conversions.';
