-- 0029_user_fact_visibility.sql
-- Users could not see extracted facts or their source documents (RLS was
-- admin-only), so verdicts shipped with no visible evidence. Open read-only
-- access to VERIFIED facts (+ the source documents they cite) to any user who
-- can already see the offer — offer visibility itself still gates everything,
-- because the offers RLS policies apply inside the exists() subquery.

create policy "verified facts visible with offer" on extracted_facts
  for select
  using (
    status = 'verified'
    and exists (select 1 from offers o where o.id = extracted_facts.offer_id)
  );

create policy "source documents visible with offer" on source_documents
  for select
  using (
    exists (select 1 from offers o where o.id = source_documents.offer_id)
  );
