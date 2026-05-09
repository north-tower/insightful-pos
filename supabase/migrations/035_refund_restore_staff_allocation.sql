-- Refund retail orders:
-- - Cashier/manager allocation sales: reverse ONLY cashier_stock_allocations.sold_qty (units go back on
--   that staff member's assignment). Main products.stock is NOT increased — store inventory stays as-is
--   until stock is formally returned to the main location (separate process).
-- - Admin / no-allocation sales, or a line with no active allocation row: restore main products.stock
--   and log stock_adjustments as before.

CREATE OR REPLACE FUNCTION public.refund_order_and_restore_stock(p_order_id UUID)
RETURNS VOID
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
BEGIN
  SELECT id, order_number, business_mode, store_id, status, payment_status, staff_id
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF NOT public.can_access_store(v_order.store_id) THEN
    RAISE EXCEPTION 'Access denied for this store';
  END IF;

  IF v_order.business_mode IS DISTINCT FROM 'retail' THEN
    UPDATE public.orders
    SET payment_status = 'refunded',
        status = 'cancelled'
    WHERE id = p_order_id;
    RETURN;
  END IF;

  IF v_order.payment_status = 'refunded' OR v_order.status IN ('cancelled', 'voided') THEN
    RETURN;
  END IF;

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
      -- No allocation reversal (e.g. admin sale, or missing allocation row): restore main shelf stock.
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
          'Order refund ' || v_order.order_number,
          COALESCE(auth.uid(), v_order.staff_id)
        );
    END IF;
    -- When v_alloc_rows > 0, only assignment sold_qty was reduced; main products.stock unchanged.
  END LOOP;

  UPDATE public.orders
  SET payment_status = 'refunded',
      status = 'cancelled'
  WHERE id = p_order_id;
END;
$$;
