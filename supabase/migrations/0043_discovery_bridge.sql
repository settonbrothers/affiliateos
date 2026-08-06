-- 0043_discovery_bridge.sql
-- The Discovery deep analysis was dropped on the floor at approval time:
-- approveCandidate read discovery_candidates.deep_analysis and never used it,
-- so a promoted offer started with zero sources and zero facts. Underwriting
-- then scored it from the offer name alone, and its own hard rules
-- (data_confidence < 50 -> cap at 'watch'; fewer than 5 verified facts ->
-- nothing above 'small_paid_test') capped every discovered offer structurally.
--
-- Two columns close the loop. No new tables, so no new RLS: both inherit the
-- policies already on offers / discovery_candidates.

-- Back-link to the candidate the offer came from. Until now the link was
-- one-way (candidate.promoted_offer_id), so a promoted offer could not recover
-- the analysis that justified promoting it.
alter table offers
  add column if not exists discovery_candidate_id uuid
    references discovery_candidates(id) on delete set null;

create index if not exists offers_discovery_candidate_idx
  on offers(discovery_candidate_id);

-- DiscoveryNetworkOrchestrator output (which network carries the offer, EPC /
-- commission estimates, trending signal + its evidence). The scan ran this for
-- every candidate scoring >= 70 but only persisted it when promoted_offer_id
-- was already set — which is never true during a scan, since promotion is a
-- manual step afterwards. Every one of those Haiku calls was paid for and
-- discarded. Park the result on the candidate so approval can carry it over.
alter table discovery_candidates
  add column if not exists network_analysis jsonb;
