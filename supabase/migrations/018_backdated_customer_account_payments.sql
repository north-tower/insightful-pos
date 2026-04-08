-- ============================================================================
-- 018 - Allow explicit backdated timestamps for customer account payments
-- ============================================================================

CREATE OR REPLACE FUNCTION record_customer_account_payment(
  p_customer_id UUID,
  p_amount NUMERIC,
  p_method TEXT DEFAULT 'cash',
  p_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_created_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  payment_id UUID,
  balance_before NUMERIC,
  applied_amount NUMERIC,
  balance_after NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_before NUMERIC(12,2);
  v_amount NUMERIC(12,2);
  v_applied NUMERIC(12,2);
  v_after NUMERIC(12,2);
  v_payment_id UUID;
BEGIN
  SELECT credit_balance
  INTO v_before
  FROM customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  v_amount := GREATEST(COALESCE(p_amount, 0), 0);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  v_applied := LEAST(v_before, v_amount);
  IF v_applied <= 0 THEN
    RAISE EXCEPTION 'Customer has no outstanding balance';
  END IF;

  v_after := GREATEST(v_before - v_applied, 0);

  INSERT INTO customer_account_payments (
    customer_id, method, amount, reference, notes, created_at
  )
  VALUES (
    p_customer_id,
    COALESCE(NULLIF(trim(p_method), ''), 'cash'),
    v_applied,
    p_reference,
    p_notes,
    COALESCE(p_created_at, now())
  )
  RETURNING id INTO v_payment_id;

  UPDATE customers
  SET credit_balance = v_after,
      updated_at = now()
  WHERE id = p_customer_id;

  RETURN QUERY SELECT v_payment_id, v_before, v_applied, v_after;
END;
$$;
