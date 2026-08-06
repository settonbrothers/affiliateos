-- 0044_prompts_dedupe.sql
--
-- DiagnosisV2Orchestrator and DiscoveryNetworkOrchestrator each have TWO active
-- v1 rows, inserted ten seconds apart on 2026-07-02 (a prompts:sync run that
-- overlapped itself). loadActivePrompt reads the active row with .maybeSingle(),
-- which errors on more than one row — so both orchestrators have been throwing
-- "No active prompt" on every real call since. DiscoveryNetwork's failure was
-- invisible because discover-offers swallows it as non-fatal enrichment.
--
-- The 0016 constraint `unique (orchestrator_name, prompt_type, version,
-- vertical_id)` did not stop this: Postgres treats NULLs as distinct in a
-- UNIQUE constraint, so any number of global (vertical_id IS NULL) rows can
-- share the same version.

-- 1) Collapse duplicates, keeping the earliest row of each group.
--    ai_runs.prompt_version_id is a bare uuid with no FK and is never written,
--    so deleting a prompt row orphans nothing.
delete from prompts p
using (
  select
    id,
    row_number() over (
      partition by
        orchestrator_name,
        prompt_type,
        version,
        coalesce(vertical_id::text, 'GLOBAL')
      order by created_at asc, id asc
    ) as rn
  from prompts
) dup
where p.id = dup.id
  and dup.rn > 1;

-- 2) Leave at most one active row per (orchestrator, type, vertical), keeping
--    the most recently created. A no-op once step 1 has run, but it also
--    repairs a group where two DIFFERENT versions were somehow both active.
update prompts p
set is_active = false
where p.is_active
  and exists (
    select 1
    from prompts q
    where q.orchestrator_name = p.orchestrator_name
      and q.prompt_type = p.prompt_type
      and q.vertical_id is not distinct from p.vertical_id
      and q.is_active
      and (q.created_at, q.id) > (p.created_at, p.id)
  );

-- 3) Close the hole. Partial indexes, because the plain UNIQUE constraint
--    cannot express "NULL vertical_id rows must still be distinct".
create unique index if not exists prompts_global_version_uniq
  on prompts (orchestrator_name, prompt_type, version)
  where vertical_id is null;

-- One live prompt per orchestrator, which is what loadActivePrompt assumes.
-- activatePrompt deactivates siblings before activating the target, so the
-- flow never holds two active rows at once.
create unique index if not exists prompts_one_active_global
  on prompts (orchestrator_name, prompt_type)
  where is_active and vertical_id is null;

create unique index if not exists prompts_one_active_vertical
  on prompts (orchestrator_name, prompt_type, vertical_id)
  where is_active and vertical_id is not null;
