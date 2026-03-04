-- ============================================================================
-- 015 - Customer account payments ledger
-- Stores payments applied directly to customer credit balance (not invoice-level).
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_account_payments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  method      TEXT NOT NULL DEFAULT 'cash', -- 'cash' | 'card' | 'qr'
  amount      NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  reference   TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE customer_account_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customer account payments are viewable by authenticated users."
  ON customer_account_payments FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create customer account payments."
  ON customer_account_payments FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins and managers can update customer account payments."
  ON customer_account_payments FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'manager', 'cashier'));

CREATE POLICY "Admins can delete customer account payments."
  ON customer_account_payments FOR DELETE
  USING (public.get_my_role() = 'admin');

CREATE INDEX IF NOT EXISTS idx_customer_account_payments_customer
  ON customer_account_payments(customer_id, created_at DESC);

-- Atomic helper: record payment + reduce customer balance.
CREATE OR REPLACE FUNCTION record_customer_account_payment(
  p_customer_id UUID,
  p_amount NUMERIC,
  p_method TEXT DEFAULT 'cash',
  p_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
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
    customer_id, method, amount, reference, notes
  )
  VALUES (
    p_customer_id, COALESCE(NULLIF(trim(p_method), ''), 'cash'), v_applied, p_reference, p_notes
  )
  RETURNING id INTO v_payment_id;

  UPDATE customers
  SET credit_balance = v_after,
      updated_at = now()
  WHERE id = p_customer_id;

  RETURN QUERY SELECT v_payment_id, v_before, v_applied, v_after;
END;
$$;
