-- ============================================================================
-- 062 - Cancel open credit invoice (restore stock, fix customer balance)
-- ============================================================================
-- For credit sales with balance still due. Fully settled invoices use refund.

CREATE OR REPLACE FUNCTION public.cancel_credit_invoice(p_order_id UUID)
RETURNS TABLE (
  balance_before NUMERIC,
  balance_after NUMERIC,
  amount_removed NUMERIC,
  total_paid NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order RECORD;
  v_line RECORD;
  v_prev_stock INT;
  v_staff_uses_allocation BOOLEAN := false;
  v_alloc_rows INT;
  v_total_paid NUMERIC(12,2) := 0;
  v_balance_due NUMERIC(12,2);
  v_before NUMERIC(12,2);
  v_after NUMERIC(12,2);
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Order id is required';
  END IF;

  IF public.get_my_role() NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Only admins and managers can cancel credit invoices';
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF NOT public.can_access_store(v_order.store_id) THEN
    RAISE EXCEPTION 'Access denied for this store';
  END IF;

  IF v_order.sale_type IS DISTINCT FROM 'credit' THEN
    RAISE EXCEPTION 'Only credit sales can be cancelled as invoices';
  END IF;

  IF v_order.customer_id IS NULL THEN
    RAISE EXCEPTION 'Credit invoice has no linked customer';
  END IF;

  IF v_order.payment_status = 'refunded'
     OR v_order.payment_status = 'voided'
     OR v_order.status IN ('cancelled', 'voided') THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(p.amount), 0)
  INTO v_total_paid
  FROM public.payments p
  WHERE p.order_id = p_order_id
    AND p.store_id = v_order.store_id;

  v_balance_due := GREATEST(v_order.total - v_total_paid, 0);

  IF v_balance_due <= 0 THEN
    RAISE EXCEPTION 'Invoice is fully paid; use Refund instead';
  END IF;

  -- Restore stock for retail orders (same rules as refund_order_and_restore_stock).
  IF v_order.business_mode = 'retail' THEN
    IF v_order.staff_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.profile_stores ps
        WHERE ps.profile_id = v_order.staff_id
          AND ps.store_id = v_order.store_id
          AND ps.role_in_store IN ('cashier', 'manager')
      )
      INTO v_staff_uses_allocation;
    END IF;

    FOR v_line IN
      SELECT oi.product_id, SUM(oi.quantity)::INT AS qty
      FROM public.order_items oi
      WHERE oi.order_id = p_order_id
        AND oi.product_id IS NOT NULL
      GROUP BY oi.product_id
    LOOP
      v_alloc_rows := 0;

      IF v_staff_uses_allocation AND v_order.staff_id IS NOT NULL THEN
        UPDATE public.cashier_stock_allocations csa
        SET sold_qty = GREATEST(csa.sold_qty - v_line.qty, 0),
            updated_at = now()
        WHERE csa.store_id = v_order.store_id
          AND csa.cashier_id = v_order.staff_id
          AND csa.product_id = v_line.product_id
          AND csa.is_active = true;

        GET DIAGNOSTICS v_alloc_rows = ROW_COUNT;
      END IF;

      IF v_alloc_rows = 0 THEN
        SELECT COALESCE(p.stock, 0)
        INTO v_prev_stock
        FROM public.products p
        WHERE p.id = v_line.product_id
          AND p.store_id = v_order.store_id;

        UPDATE public.products
        SET stock = COALESCE(stock, 0) + v_line.qty,
            updated_at = now()
        WHERE id = v_line.product_id
          AND store_id = v_order.store_id;

        INSERT INTO public.stock_adjustments
          (product_id, store_id, type, quantity, previous_stock, new_stock, note, staff_id)
        VALUES
          (
            v_line.product_id,
            v_order.store_id,
            'returned',
            v_line.qty,
            v_prev_stock,
            v_prev_stock + v_line.qty,
            'Credit invoice cancelled ' || v_order.order_number,
            COALESCE(auth.uid(), v_order.staff_id)
          );
      END IF;
    END LOOP;
  END IF;

  SELECT c.credit_balance
  INTO v_before
  FROM public.customers c
  WHERE c.id = v_order.customer_id
    AND c.store_id = v_order.store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  v_after := GREATEST(v_before - v_balance_due, 0);

  UPDATE public.customers
  SET credit_balance = v_after,
      total_spent = GREATEST(total_spent - v_order.total, 0),
      total_orders = GREATEST(total_orders - 1, 0),
      updated_at = now()
  WHERE id = v_order.customer_id
    AND store_id = v_order.store_id;

  UPDATE public.orders
  SET status = 'cancelled',
      payment_status = 'voided',
      updated_at = now()
  WHERE id = p_order_id;

  RETURN QUERY
  SELECT v_before, v_after, v_balance_due, v_total_paid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_credit_invoice(UUID) TO authenticated;
