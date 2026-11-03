-- ============================================================================
-- 061 - Reverse customer account payments + allow managers to reverse order payments
-- ============================================================================

-- Undo a customer account payment: restore credit_balance and remove ledger row.
CREATE OR REPLACE FUNCTION public.reverse_customer_account_payment(p_payment_id UUID)
RETURNS TABLE (
  balance_before NUMERIC,
  balance_after NUMERIC,
  reversed_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_customer_id UUID;
  v_store_id UUID;
  v_amount NUMERIC(12,2);
  v_before NUMERIC(12,2);
  v_after NUMERIC(12,2);
BEGIN
  IF p_payment_id IS NULL THEN
    RAISE EXCEPTION 'Payment id is required';
  END IF;

  IF public.get_my_role() NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Only admins and managers can reverse account payments';
  END IF;

  SELECT cap.customer_id, cap.store_id, cap.amount
  INTO v_customer_id, v_store_id, v_amount
  FROM public.customer_account_payments cap
  WHERE cap.id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account payment not found';
  END IF;

  IF NOT public.can_access_store(v_store_id) THEN
    RAISE EXCEPTION 'Access denied for this store';
  END IF;

  SELECT credit_balance
  INTO v_before
  FROM public.customers
  WHERE id = v_customer_id
    AND store_id = v_store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  v_after := v_before + v_amount;

  UPDATE public.customers
  SET credit_balance = v_after,
      updated_at = now()
  WHERE id = v_customer_id
    AND store_id = v_store_id;

  DELETE FROM public.customer_account_payments
  WHERE id = p_payment_id;

  RETURN QUERY SELECT v_before, v_after, v_amount;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reverse_customer_account_payment(UUID) TO authenticated;

-- Managers can reverse order-level payments (same as customer account payments).
DROP POLICY IF EXISTS "Admin can delete payments in active branch" ON public.payments;

CREATE POLICY "Admin manager can delete payments in active branch"
  ON public.payments FOR DELETE TO authenticated
  USING (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );
