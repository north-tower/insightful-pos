-- ============================================================================
-- 050 - Atomic order creation RPC
--
-- Problem: generate_invoice_number() and the orders INSERT are separate
-- round trips. When multiple useOrders() hook instances mount simultaneously
-- (RetailPOS, OrderHistory, AccountsReceivable, CustomerDetailDialog all call
-- syncQueuedOrders on mount), two concurrent calls can both call
-- generate_invoice_number() before either has committed, receiving the same
-- counter value and then colliding on the unique constraint.
--
-- Fix: wrap number generation + order insert in a single plpgsql function
-- that runs in one transaction. The counter UPDATE is atomic within the
-- transaction, so concurrent calls are safely serialized.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_order_atomic(
  p_business_mode       TEXT,
  p_order_type          TEXT,
  p_source              TEXT DEFAULT 'pos',
  p_sale_type           TEXT DEFAULT 'cash',
  p_customer_id         UUID DEFAULT NULL,
  p_customer_name       TEXT DEFAULT NULL,
  p_customer_email      TEXT DEFAULT NULL,
  p_customer_phone      TEXT DEFAULT NULL,
  p_customer_address    TEXT DEFAULT NULL,
  p_table_number        TEXT DEFAULT NULL,
  p_due_date            TIMESTAMPTZ DEFAULT NULL,
  p_consignment_info    TEXT DEFAULT NULL,
  p_subtotal            NUMERIC DEFAULT 0,
  p_tax_rate            NUMERIC DEFAULT 0,
  p_tax_amount          NUMERIC DEFAULT 0,
  p_discount_amount     NUMERIC DEFAULT 0,
  p_total               NUMERIC DEFAULT 0,
  p_status              TEXT DEFAULT 'completed',
  p_payment_status      TEXT DEFAULT 'unpaid',
  p_notes               TEXT DEFAULT NULL,
  p_staff_id            UUID DEFAULT NULL,
  p_staff_name          TEXT DEFAULT NULL,
  p_assignment_id       UUID DEFAULT NULL,
  p_created_at          TIMESTAMPTZ DEFAULT now(),
  p_completed_at        TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  order_id       UUID,
  order_number   TEXT,
  invoice_number TEXT,
  store_id       UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_id     UUID;
  v_order_number TEXT;
  v_invoice_num  TEXT;
  v_order_id     UUID;
BEGIN
  -- Resolve current store
  v_store_id := public.current_store_id();
  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'No default store set for current user';
  END IF;

  -- Generate order number (atomically increments the counter)
  v_order_number := public.generate_order_number(p_business_mode, v_store_id);

  -- Generate invoice number (atomically increments the counter)
  v_invoice_num := public.generate_invoice_number(v_store_id);

  -- Insert the order — same transaction, no race window
  INSERT INTO public.orders (
    order_number,
    invoice_number,
    store_id,
    business_mode,
    order_type,
    source,
    sale_type,
    customer_id,
    customer_name,
    customer_email,
    customer_phone,
    customer_address,
    table_number,
    due_date,
    consignment_info,
    subtotal,
    tax_rate,
    tax_amount,
    discount_amount,
    total,
    status,
    payment_status,
    notes,
    staff_id,
    staff_name,
    assignment_id,
    created_at,
    completed_at
  )
  VALUES (
    v_order_number,
    v_invoice_num,
    v_store_id,
    p_business_mode,
    p_order_type,
    p_source,
    p_sale_type,
    p_customer_id,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_customer_address,
    p_table_number,
    p_due_date,
    p_consignment_info,
    p_subtotal,
    p_tax_rate,
    p_tax_amount,
    p_discount_amount,
    p_total,
    p_status,
    p_payment_status,
    p_notes,
    p_staff_id,
    p_staff_name,
    p_assignment_id,
    p_created_at,
    p_completed_at
  )
  RETURNING id INTO v_order_id;

  RETURN QUERY SELECT v_order_id, v_order_number, v_invoice_num, v_store_id;
END;
$$;
