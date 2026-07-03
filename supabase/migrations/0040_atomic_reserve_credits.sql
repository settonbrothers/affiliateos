-- Atomically check balance and debit credits in a single transaction with a
-- row-level lock, eliminating the race condition in the application-layer
-- read-check-insert pattern.
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
