-- 0042_fix_reserve_credits.sql
-- Forward-fix for 0040. The original reserve_credits() was recorded as applied
-- on the remote, but its body never worked against the real credit_ledger
-- schema (migration 0025): it referenced a non-existent `description` column,
-- omitted the NOT NULL `entry_type`, and used `FOR UPDATE` with an aggregate
-- (rejected by Postgres). Every credit-gated edge function that bundles the
-- RPC-based credits.ts therefore 500s at reserveCredits().
--
-- Because 0040's version is already in the remote migration history, editing it
-- in place does NOT re-run via `db push` ("Remote database is up to date"). This
-- new migration reconciles the deployed database. Idempotent: DROP + CREATE.
--
-- Correct behaviour: serialise per workspace with a transaction-scoped advisory
-- lock, sum the balance, and (if covered) write the debit as entry_type='used'
-- with a negative amount and the human label in `reason`. Returns the new ledger
-- row id on success, or NULL when the balance can't cover the cost.

drop function if exists reserve_credits(uuid, int, text);

create or replace function reserve_credits(
  p_workspace_id uuid,
  p_amount int,
  p_description text
) returns uuid language plpgsql as $$
declare
  v_balance int;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_workspace_id::text));

  select coalesce(sum(amount), 0) into v_balance
  from credit_ledger
  where workspace_id = p_workspace_id;

  if v_balance < p_amount then
    return null;
  end if;

  insert into credit_ledger (workspace_id, entry_type, amount, action, reason)
  values (p_workspace_id, 'used', -p_amount, null, p_description)
  returning id into v_id;

  return v_id;
end;
$$;

-- Make PostgREST pick up the new function signature immediately.
notify pgrst, 'reload schema';
