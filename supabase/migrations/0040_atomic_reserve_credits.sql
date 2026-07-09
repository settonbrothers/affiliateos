-- Atomically check balance and debit credits in a single transaction with a
-- row-level lock, eliminating the race condition in the application-layer
-- read-check-insert pattern.
--
-- NOTE: this original version never worked against the real credit_ledger schema
-- (references a non-existent `description` column, omits the NOT NULL
-- `entry_type`, and uses `FOR UPDATE` with an aggregate). It was recorded as
-- applied on the remote but the function was effectively absent. The working
-- definition ships in 0042_fix_reserve_credits.sql — do not rely on this file.
CREATE OR REPLACE FUNCTION reserve_credits(
  p_workspace_id UUID,
  p_amount INT,
  p_description TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_balance INT;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM credit_ledger
  WHERE workspace_id = p_workspace_id
  FOR UPDATE;

  IF v_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  INSERT INTO credit_ledger (workspace_id, amount, description)
  VALUES (p_workspace_id, -p_amount, p_description);

  RETURN TRUE;
END;
$$;
