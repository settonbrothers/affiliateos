-- 0011_extracted_facts.sql
-- Structured facts pulled from a source_document by SourceExtractionOrchestrator.
-- Each fact carries the exact source_quote it came from so the admin can verify.

create type fact_type as enum (
  'commission_value', 'commission_type', 'payout_delay', 'cookie_duration',
  'traffic_rule_paid_social', 'traffic_rule_google', 'traffic_rule_native',
  'traffic_rule_youtube', 'traffic_rule_brand_bidding', 'traffic_rule_direct_link',
  'traffic_rule_email', 'traffic_rule_seo', 'traffic_rule_organic_social',
  'allowed_geo', 'restricted_geo', 'cap', 'refund_policy',
  'compliance_claim', 'pricing_aov', 'minimum_payout', 'contact', 'other'
);
create type fact_status as enum ('proposed', 'verified', 'rejected');

create table extracted_facts (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  source_document_id uuid references source_documents(id),
  fact_type fact_type not null,
  fact_value text not null,
  source_quote text,
  confidence_score int,  -- 0-100
  status fact_status not null default 'proposed',
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index extracted_facts_offer_idx on extracted_facts(offer_id);
create index extracted_facts_status_idx on extracted_facts(status);

alter table extracted_facts enable row level security;
create policy "admin manage extracted_facts" on extracted_facts for all
  using (is_current_user_admin());
