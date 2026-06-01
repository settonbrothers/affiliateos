-- 0020_offer_operator_notes.sql
-- 1) Add a free-form notes field on offers for operator (media-buyer) knowledge
--    that doesn't fit into URL-extracted facts (e.g. internal CPA, audience
--    profile, vendor reputation, private traffic-rule agreements).
-- 2) Fix the ai_runs.offer_id FK so deleting an offer cascades. Until now the
--    FK was RESTRICT, which made it impossible to delete an offer that had
--    any ai_runs against it — broke the new Delete UI.

alter table offers add column operator_notes text;

alter table ai_runs drop constraint ai_runs_offer_id_fkey;
alter table ai_runs
  add constraint ai_runs_offer_id_fkey
  foreign key (offer_id) references offers(id) on delete cascade;
