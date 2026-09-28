-- ============================================================================
-- 059 - WhatsApp staff ops (Insightful POS ↔ whatsapp3)
-- Staff phone allowlist + store-scoped sale / account payment RPCs for the
-- whatsapp-ops Edge Function (service role + API key at the HTTP layer).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_staff_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT NOT NULL,
  profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id    UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_staff_links_phone_unique UNIQUE (phone)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_staff_links_profile
  ON public.whatsapp_staff_links(profile_id);

ALTER TABLE public.whatsapp_staff_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage whatsapp staff links"
  ON public.whatsapp_staff_links
  FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

CREATE TABLE IF NOT EXISTS public.whatsapp_ops_idempotency (
  idempotency_key TEXT PRIMARY KEY,
  store_id        UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  result_type     TEXT NOT NULL,
  result_json     JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allow create_order_atomic to target a branch when called server-side (WhatsApp).
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
  p_completed_at        TIMESTAMPTZ DEFAULT NULL,
  p_store_id            UUID DEFAULT NULL
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
  v_store_id := COALESCE(p_store_id, public.current_store_id());
  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'No store set for order';
  END IF;

  v_order_number := public.generate_order_number(p_business_mode, v_store_id);
  v_invoice_num := public.generate_invoice_number(v_store_id);

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

CREATE OR REPLACE FUNCTION public.whatsapp_resolve_staff(p_phone TEXT)
RETURNS TABLE (
  profile_id    UUID,
  store_id      UUID,
  staff_name    TEXT,
  staff_role    TEXT,
  business_mode TEXT,
  store_name    TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_phone TEXT;
BEGIN
  v_phone := trim(COALESCE(p_phone, ''));
  IF v_phone = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    l.profile_id,
    l.store_id,
    p.full_name,
    p.role,
    p.business_mode,
    s.name
  FROM public.whatsapp_staff_links l
  JOIN public.profiles p ON p.id = l.profile_id
  JOIN public.stores s ON s.id = l.store_id
  WHERE l.enabled = true
    AND l.phone = v_phone
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_create_sale(
  p_staff_phone      TEXT,
  p_idempotency_key  TEXT,
  p_sale_type        TEXT,
  p_items            JSONB,
  p_customer_id      UUID DEFAULT NULL,
  p_payments         JSONB DEFAULT '[]'::jsonb,
  p_notes            TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_staff RECORD;
  v_existing JSONB;
  v_item JSONB;
  v_pay JSONB;
  v_subtotal NUMERIC(12,2) := 0;
  v_total NUMERIC(12,2) := 0;
  v_total_paid NUMERIC(12,2) := 0;
  v_payment_status TEXT;
  v_order_id UUID;
  v_order_number TEXT;
  v_invoice_number TEXT;
  v_store_id UUID;
  v_product_id UUID;
  v_qty NUMERIC;
  v_unit_price NUMERIC;
  v_unit_cost NUMERIC;
  v_line_total NUMERIC;
  v_product_name TEXT;
  v_result JSONB;
BEGIN
  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'idempotency_key is required';
  END IF;

  SELECT result_json INTO v_existing
  FROM public.whatsapp_ops_idempotency
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  SELECT * INTO v_staff
  FROM public.whatsapp_resolve_staff(p_staff_phone)
  LIMIT 1;

  IF v_staff IS NULL THEN
    RAISE EXCEPTION 'Staff phone not authorised';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := COALESCE((v_item->>'quantity')::numeric, 0);
    v_unit_price := COALESCE((v_item->>'unit_price')::numeric, 0);
    IF v_qty <= 0 OR v_unit_price < 0 THEN
      RAISE EXCEPTION 'Invalid line item quantity or price';
    END IF;
    v_subtotal := v_subtotal + (v_qty * v_unit_price);
  END LOOP;

  v_total := v_subtotal;

  FOR v_pay IN SELECT * FROM jsonb_array_elements(COALESCE(p_payments, '[]'::jsonb))
  LOOP
    v_total_paid := v_total_paid + COALESCE((v_pay->>'amount')::numeric, 0);
  END LOOP;

  IF COALESCE(p_sale_type, 'cash') = 'credit' THEN
    IF p_customer_id IS NULL THEN
      RAISE EXCEPTION 'Credit sale requires a customer';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = p_customer_id AND c.store_id = v_staff.store_id
    ) THEN
      RAISE EXCEPTION 'Customer not found in this store';
    END IF;
    v_payment_status := CASE
      WHEN v_total_paid >= v_total THEN 'paid'
      WHEN v_total_paid > 0 THEN 'partial'
      ELSE 'unpaid'
    END;
  ELSE
    v_payment_status := CASE
      WHEN v_total_paid >= v_total THEN 'paid'
      WHEN v_total_paid > 0 THEN 'partial'
      ELSE 'unpaid'
    END;
  END IF;

  SELECT o.order_id, o.order_number, o.invoice_number, o.store_id
  INTO v_order_id, v_order_number, v_invoice_number, v_store_id
  FROM public.create_order_atomic(
    v_staff.business_mode,
    'pos',
    'whatsapp',
    COALESCE(p_sale_type, 'cash'),
    p_customer_id,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    v_subtotal,
    0,
    0,
    0,
    v_total,
    'completed',
    v_payment_status,
    p_notes,
    v_staff.profile_id,
    v_staff.staff_name,
    NULL,
    now(),
    now(),
    v_staff.store_id
  ) o;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::uuid;
    v_product_name := COALESCE(v_item->>'product_name', 'Item');
    v_qty := COALESCE((v_item->>'quantity')::numeric, 0);
    v_unit_price := COALESCE((v_item->>'unit_price')::numeric, 0);
    v_unit_cost := COALESCE((v_item->>'unit_cost')::numeric, 0);
    v_line_total := v_qty * v_unit_price;

    IF v_product_id IS NOT NULL THEN
      SELECT COALESCE(p.cost, 0) INTO v_unit_cost
      FROM public.products p
      WHERE p.id = v_product_id AND p.store_id = v_staff.store_id;
    END IF;

    INSERT INTO public.order_items (
      order_id,
      store_id,
      product_id,
      product_name,
      unit_price,
      unit_cost,
      quantity,
      line_total,
      discount,
      modifiers,
      notes
    )
    VALUES (
      v_order_id,
      v_staff.store_id,
      v_product_id,
      v_product_name,
      v_unit_price,
      v_unit_cost,
      v_qty,
      v_line_total,
      0,
      '[]'::jsonb,
      NULL
    );
  END LOOP;

  FOR v_pay IN SELECT * FROM jsonb_array_elements(COALESCE(p_payments, '[]'::jsonb))
  LOOP
    INSERT INTO public.payments (
      order_id,
      store_id,
      method,
      amount,
      reference,
      description,
      paid_at
    )
    VALUES (
      v_order_id,
      v_staff.store_id,
      COALESCE(v_pay->>'method', 'cash'),
      COALESCE((v_pay->>'amount')::numeric, 0),
      NULLIF(v_pay->>'reference', ''),
      NULLIF(v_pay->>'description', ''),
      now()
    );
  END LOOP;

  v_result := jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'invoice_number', v_invoice_number,
    'total', v_total,
    'store_id', v_store_id
  );

  INSERT INTO public.whatsapp_ops_idempotency (
    idempotency_key,
    store_id,
    result_type,
    result_json
  )
  VALUES (
    p_idempotency_key,
    v_staff.store_id,
    'sale',
    v_result
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_record_account_payment(
  p_staff_phone     TEXT,
  p_customer_id     UUID,
  p_amount          NUMERIC,
  p_method          TEXT DEFAULT 'cash',
  p_reference       TEXT DEFAULT NULL,
  p_notes           TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_staff RECORD;
  v_existing JSONB;
  v_before NUMERIC(12,2);
  v_applied NUMERIC(12,2);
  v_after NUMERIC(12,2);
  v_payment_id UUID;
  v_store_id UUID;
  v_result JSONB;
BEGIN
  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    SELECT result_json INTO v_existing
    FROM public.whatsapp_ops_idempotency
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN v_existing;
    END IF;
  END IF;

  SELECT * INTO v_staff
  FROM public.whatsapp_resolve_staff(p_staff_phone)
  LIMIT 1;

  IF v_staff IS NULL THEN
    RAISE EXCEPTION 'Staff phone not authorised';
  END IF;

  SELECT c.store_id, c.credit_balance
  INTO v_store_id, v_before
  FROM public.customers c
  WHERE c.id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  IF v_store_id <> v_staff.store_id THEN
    RAISE EXCEPTION 'Customer not in staff store';
  END IF;

  IF COALESCE(p_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  v_applied := LEAST(v_before, p_amount);
  IF v_applied <= 0 THEN
    RAISE EXCEPTION 'Customer has no outstanding balance';
  END IF;

  v_after := GREATEST(v_before - v_applied, 0);

  INSERT INTO public.customer_account_payments (
    customer_id,
    store_id,
    method,
    amount,
    reference,
    notes,
    created_at
  )
  VALUES (
    p_customer_id,
    v_store_id,
    COALESCE(p_method, 'cash'),
    v_applied,
    p_reference,
    p_notes,
    now()
  )
  RETURNING id INTO v_payment_id;

  UPDATE public.customers
  SET credit_balance = v_after,
      updated_at = now()
  WHERE id = p_customer_id;

  v_result := jsonb_build_object(
    'payment_id', v_payment_id,
    'balance_before', v_before,
    'applied_amount', v_applied,
    'balance_after', v_after
  );

  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    INSERT INTO public.whatsapp_ops_idempotency (
      idempotency_key,
      store_id,
      result_type,
      result_json
    )
    VALUES (
      p_idempotency_key,
      v_staff.store_id,
      'account_payment',
      v_result
    );
  END IF;

  RETURN v_result;
END;
$$;
