-- ============================================================================
-- 063 - Customer statement paper trail (ledger + soft payment reversals)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customer_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (
    entry_type IN (
      'order_payment_reversed',
      'account_payment_reversed',
      'invoice_cancelled'
    )
  ),
  debit NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  reference TEXT,
  description TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  related_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer_created
  ON public.customer_ledger_entries (customer_id, created_at);

CREATE INDEX IF NOT EXISTS idx_customer_ledger_store
  ON public.customer_ledger_entries (store_id);

ALTER TABLE public.customer_ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members can read customer ledger entries"
  ON public.customer_ledger_entries FOR SELECT TO authenticated
  USING (public.can_access_store(store_id));

-- ─── Soft reversal columns ───────────────────────────────────────────────────

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES auth.users(id);

ALTER TABLE public.customer_account_payments
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_payments_reversed_at ON public.payments (reversed_at);
CREATE INDEX IF NOT EXISTS idx_cap_reversed_at ON public.customer_account_payments (reversed_at);

-- ─── Recalculate order payment_status (active payments only) ─────────────────

CREATE OR REPLACE FUNCTION public.recalculate_order_payment_status(
  p_order_id UUID,
  p_store_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  total_paid NUMERIC(12, 2);
  order_total NUMERIC(12, 2);
BEGIN
  SELECT COALESCE(SUM(p.amount), 0), MAX(o.total)
  INTO total_paid, order_total
  FROM public.payments p
  INNER JOIN public.orders o ON o.id = p.order_id AND o.store_id = p.store_id
  WHERE p.order_id = p_order_id
    AND p.store_id = p_store_id
    AND p.reversed_at IS NULL;

  IF order_total IS NULL THEN
    RETURN;
  END IF;

  IF total_paid >= order_total THEN
    UPDATE public.orders
    SET payment_status = 'paid'
    WHERE id = p_order_id
      AND store_id = p_store_id;
  ELSIF total_paid > 0 THEN
    UPDATE public.orders
    SET payment_status = 'partial'
    WHERE id = p_order_id
      AND store_id = p_store_id;
  ELSE
    UPDATE public.orders
    SET payment_status = 'unpaid'
    WHERE id = p_order_id
      AND store_id = p_store_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_order_payment_status(UUID, UUID) TO authenticated;

-- ─── Payment insert: ignore reversed rows; sum active payments only ──────────

CREATE OR REPLACE FUNCTION public.update_customer_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order RECORD;
BEGIN
  IF NEW.reversed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT sale_type, customer_id, store_id, total
  INTO v_order
  FROM public.orders
  WHERE id = NEW.order_id;

  IF v_order.sale_type = 'credit'
     AND v_order.customer_id IS NOT NULL
     AND v_order.store_id = NEW.store_id THEN
    UPDATE public.customers
    SET credit_balance = GREATEST(credit_balance - NEW.amount, 0),
        updated_at = now()
    WHERE id = v_order.customer_id
      AND store_id = NEW.store_id;
  END IF;

  IF v_order.store_id = NEW.store_id THEN
    PERFORM public.recalculate_order_payment_status(NEW.order_id, NEW.store_id);
  END IF;

  RETURN NEW;
END;
$$;

-- ─── Order payment reversal (soft) ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.apply_order_payment_reversal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order RECORD;
  v_ref TEXT;
BEGIN
  IF NOT (OLD.reversed_at IS NULL AND NEW.reversed_at IS NOT NULL) THEN
    RETURN NEW;
  END IF;

  SELECT o.sale_type, o.customer_id, o.store_id, o.order_number, o.invoice_number
  INTO v_order
  FROM public.orders o
  WHERE o.id = NEW.order_id;

  v_ref := COALESCE(v_order.invoice_number, v_order.order_number, NEW.order_id::text);

  IF v_order.sale_type = 'credit'
     AND v_order.customer_id IS NOT NULL
     AND v_order.store_id = NEW.store_id THEN
    UPDATE public.customers
    SET credit_balance = credit_balance + NEW.amount,
        updated_at = now()
    WHERE id = v_order.customer_id
      AND store_id = NEW.store_id;

    INSERT INTO public.customer_ledger_entries (
      store_id,
      customer_id,
      entry_type,
      debit,
      credit,
      reference,
      description,
      order_id,
      related_id,
      created_by
    )
    VALUES (
      NEW.store_id,
      v_order.customer_id,
      'order_payment_reversed',
      NEW.amount,
      0,
      v_ref,
      'Payment reversed — invoice #' || v_ref,
      NEW.order_id,
      NEW.id,
      COALESCE(NEW.reversed_by, auth.uid())
    );
  END IF;

  PERFORM public.recalculate_order_payment_status(NEW.order_id, NEW.store_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_order_payment_reversal ON public.payments;
CREATE TRIGGER trg_apply_order_payment_reversal
  AFTER UPDATE OF reversed_at ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_order_payment_reversal();

-- ─── Payment DELETE (legacy): still log ledger if hard-deleted ───────────────

CREATE OR REPLACE FUNCTION public.update_customer_on_payment_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order RECORD;
  v_ref TEXT;
BEGIN
  SELECT o.sale_type, o.customer_id, o.store_id, o.order_number, o.invoice_number
  INTO v_order
  FROM public.orders o
  WHERE o.id = OLD.order_id;

  IF v_order.sale_type = 'credit'
     AND v_order.customer_id IS NOT NULL
     AND v_order.store_id = OLD.store_id THEN
    UPDATE public.customers
    SET credit_balance = credit_balance + OLD.amount,
        updated_at = now()
    WHERE id = v_order.customer_id
      AND store_id = OLD.store_id;

    v_ref := COALESCE(v_order.invoice_number, v_order.order_number, OLD.order_id::text);

    INSERT INTO public.customer_ledger_entries (
      store_id,
      customer_id,
      entry_type,
      debit,
      credit,
      reference,
      description,
      order_id,
      related_id,
      created_by
    )
    VALUES (
      OLD.store_id,
      v_order.customer_id,
      'order_payment_reversed',
      OLD.amount,
      0,
      v_ref,
      'Payment reversed — invoice #' || v_ref,
      OLD.order_id,
      OLD.id,
      auth.uid()
    );
  END IF;

  PERFORM public.recalculate_order_payment_status(OLD.order_id, OLD.store_id);

  RETURN OLD;
END;
$$;

-- ─── Account payment reversal (soft) + ledger ────────────────────────────────

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
  v_ref TEXT;
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
    AND cap.reversed_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account payment not found or already reversed';
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
  v_ref := 'APAY-' || upper(substring(p_payment_id::text, 1, 8));

  UPDATE public.customers
  SET credit_balance = v_after,
      updated_at = now()
  WHERE id = v_customer_id
    AND store_id = v_store_id;

  INSERT INTO public.customer_ledger_entries (
    store_id,
    customer_id,
    entry_type,
    debit,
    credit,
    reference,
    description,
    related_id,
    created_by
  )
  VALUES (
    v_store_id,
    v_customer_id,
    'account_payment_reversed',
    v_amount,
    0,
    v_ref,
    'Account payment reversed',
    p_payment_id,
    auth.uid()
  );

  UPDATE public.customer_account_payments
  SET reversed_at = now(),
      reversed_by = auth.uid()
  WHERE id = p_payment_id;

  RETURN QUERY SELECT v_before, v_after, v_amount;
END;
$$;

-- ─── Cancel credit invoice: ledger entry for remaining balance ───────────────

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
  v_ref TEXT;
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
    AND p.store_id = v_order.store_id
    AND p.reversed_at IS NULL;

  v_balance_due := GREATEST(v_order.total - v_total_paid, 0);

  IF v_balance_due <= 0 THEN
    RAISE EXCEPTION 'Invoice is fully paid; use Refund instead';
  END IF;

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
  v_ref := COALESCE(v_order.invoice_number, v_order.order_number, p_order_id::text);

  INSERT INTO public.customer_ledger_entries (
    store_id,
    customer_id,
    entry_type,
    debit,
    credit,
    reference,
    description,
    order_id,
    created_by
  )
  VALUES (
    v_order.store_id,
    v_order.customer_id,
    'invoice_cancelled',
    0,
    v_balance_due,
    v_ref,
    'Invoice cancelled — #' || v_ref,
    p_order_id,
    auth.uid()
  );

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

-- ─── Payment amount updates: sum active payments only ────────────────────────

CREATE OR REPLACE FUNCTION public.update_customer_on_payment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order RECORD;
  v_diff NUMERIC(12, 2);
BEGIN
  IF OLD.reversed_at IS DISTINCT FROM NEW.reversed_at THEN
    RETURN NEW;
  END IF;

  SELECT sale_type, customer_id, store_id, total
  INTO v_order
  FROM public.orders
  WHERE id = NEW.order_id;

  v_diff := NEW.amount - OLD.amount;

  IF v_order.sale_type = 'credit'
     AND v_order.customer_id IS NOT NULL
     AND v_diff != 0
     AND NEW.store_id = v_order.store_id THEN
    UPDATE public.customers
    SET credit_balance = GREATEST(credit_balance - v_diff, 0),
        updated_at = now()
    WHERE id = v_order.customer_id
      AND store_id = v_order.store_id;
  END IF;

  IF NEW.store_id = v_order.store_id THEN
    PERFORM public.recalculate_order_payment_status(NEW.order_id, NEW.store_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_update_balance ON public.payments;
CREATE TRIGGER trg_payment_update_balance
  AFTER UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_on_payment_update();
