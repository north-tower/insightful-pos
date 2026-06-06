-- ============================================================================
-- 043 - Allow Supabase CSV / SQL Editor bulk imports without auth session
--
-- Dashboard CSV import runs without auth.uid(), so store guard triggers fail.
-- When there is no user session:
--   - default missing store_id to the "main" store
--   - skip can_access_store membership checks (postgres/service imports only)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.default_import_store_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    public.current_store_id(),
    (SELECT id FROM public.stores WHERE code = 'main' LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.apply_current_store_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_id UUID;
BEGIN
  IF NEW.store_id IS NULL THEN
    v_store_id := public.default_import_store_id();
    IF v_store_id IS NULL THEN
      RAISE EXCEPTION 'No store available. Create a store with code = main first.';
    END IF;
    NEW.store_id := v_store_id;
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.can_access_store(NEW.store_id) THEN
    RAISE EXCEPTION 'Access denied for store %', NEW.store_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_order_item_store_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_store_id UUID;
BEGIN
  SELECT store_id INTO v_order_store_id
  FROM public.orders
  WHERE id = NEW.order_id;

  IF v_order_store_id IS NULL THEN
    RAISE EXCEPTION 'Order not found for order_item';
  END IF;

  IF NEW.store_id IS NULL THEN
    NEW.store_id := v_order_store_id;
  ELSIF NEW.store_id <> v_order_store_id THEN
    RAISE EXCEPTION 'order_items.store_id must match parent order store';
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.can_access_store(NEW.store_id) THEN
    RAISE EXCEPTION 'Access denied for store %', NEW.store_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_payment_store_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_store_id UUID;
BEGIN
  SELECT store_id INTO v_order_store_id
  FROM public.orders
  WHERE id = NEW.order_id;

  IF v_order_store_id IS NULL THEN
    RAISE EXCEPTION 'Order not found for payment';
  END IF;

  IF NEW.store_id IS NULL THEN
    NEW.store_id := v_order_store_id;
  ELSIF NEW.store_id <> v_order_store_id THEN
    RAISE EXCEPTION 'payments.store_id must match parent order store';
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.can_access_store(NEW.store_id) THEN
    RAISE EXCEPTION 'Access denied for store %', NEW.store_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_purchase_item_store_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_purchase_store_id UUID;
BEGIN
  SELECT store_id INTO v_purchase_store_id
  FROM public.purchases
  WHERE id = NEW.purchase_id;

  IF v_purchase_store_id IS NULL THEN
    RAISE EXCEPTION 'Purchase not found for purchase_item';
  END IF;

  IF NEW.store_id IS NULL THEN
    NEW.store_id := v_purchase_store_id;
  ELSIF NEW.store_id <> v_purchase_store_id THEN
    RAISE EXCEPTION 'purchase_items.store_id must match parent purchase store';
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.can_access_store(NEW.store_id) THEN
    RAISE EXCEPTION 'Access denied for store %', NEW.store_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_customer_account_payment_store_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_customer_store_id UUID;
BEGIN
  SELECT store_id INTO v_customer_store_id
  FROM public.customers
  WHERE id = NEW.customer_id;

  IF v_customer_store_id IS NULL THEN
    RAISE EXCEPTION 'Customer not found for customer_account_payment';
  END IF;

  IF NEW.store_id IS NULL THEN
    NEW.store_id := v_customer_store_id;
  ELSIF NEW.store_id <> v_customer_store_id THEN
    RAISE EXCEPTION 'customer_account_payments.store_id must match customer store';
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.can_access_store(NEW.store_id) THEN
    RAISE EXCEPTION 'Access denied for store %', NEW.store_id;
  END IF;

  RETURN NEW;
END;
$$;
