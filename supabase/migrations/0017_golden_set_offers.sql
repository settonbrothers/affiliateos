-- 0017_golden_set_offers.sql
-- Hand-curated offers + their expected verdicts. Authored by Izak; the eval
-- script replays the active prompt against `facts_snapshot` and compares.

create table golden_set_offers (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,  -- 'gold-001' for human reference
  vertical_id uuid not null references verticals(id),
  offer_name text not null,
  offer_url text,
  -- The exact list of facts fed to the orchestrator. Same shape as
  -- extracted_facts rows (fact_type / fact_value / source_quote / confidence_score).
  facts_snapshot jsonb not null default '[]'::jsonb,
  expected_verdict text not null,
  expected_score_range int4range,
  expected_dimension_ranges jsonb,
  expected_high_ceiling_signal text,
  expected_risk_flags text[],
  -- Phrases the verdict reasoning SHOULD contain (e.g. 'recurring commission').
  must_mention text[],
  -- Phrases the output must NOT contain (e.g. 'guaranteed', 'easy money').
  must_not_mention text[],
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index golden_set_offers_vertical_idx on golden_set_offers(vertical_id);

alter table golden_set_offers enable row level security;
create policy "admin manage golden_set_offers" on golden_set_offers for all
  using (is_current_user_admin());
