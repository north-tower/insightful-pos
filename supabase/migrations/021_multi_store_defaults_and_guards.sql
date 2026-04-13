-- ============================================================================
-- 021 - Multi-store defaults and guardrails
-- Adds helper functions for active store selection and trigger-based defaults
-- so inserts are safer even when store_id is omitted by the client.
-- ============================================================================

-- ─── Active/default store helpers ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_store_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT ps.store_id
  FROM public.profile_stores ps
  WHERE ps.profile_id = auth.uid()
    AND ps.is_default_store = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.set_my_default_store(p_store_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.user_can_access_store(p_store_id) THEN
    RAISE EXCEPTION 'Cannot set default: store is not assigned to this user';
  END IF;

  UPDATE public.profile_stores
  SET is_default_store = false
  WHERE profile_id = auth.uid()
    AND is_default_store = true;

  UPDATE public.profile_stores
  SET is_default_store = true
  WHERE profile_id = auth.uid()
    AND store_id = p_store_id;
END;
$$;


-- ─── Generic trigger: fill missing store_id from current store ──────────────

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
    v_store_id := public.current_store_id();
    IF v_store_id IS NULL THEN
      RAISE EXCEPTION 'No default store set for current user';
    END IF;
    NEW.store_id := v_store_id;
  END IF;

  IF NOT public.can_access_store(NEW.store_id) THEN
    RAISE EXCEPTION 'Access denied for store %', NEW.store_id;
  END IF;

  RETURN NEW;
END;
$$;


-- ─── Parent-child consistency trigger functions ─────────────────────────────

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

  IF NOT public.can_access_store(NEW.store_id) THEN
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

  IF NOT public.can_access_store(NEW.store_id) THEN
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

  IF NOT public.can_access_store(NEW.store_id) THEN
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

  IF NOT public.can_access_store(NEW.store_id) THEN
    RAISE EXCEPTION 'Access denied for store %', NEW.store_id;
  END IF;

  RETURN NEW;
END;
$$;


-- ─── Attach triggers ─────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_categories_apply_current_store_id ON public.categories;
CREATE TRIGGER trg_categories_apply_current_store_id
  BEFORE INSERT ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.apply_current_store_id();

DROP TRIGGER IF EXISTS trg_products_apply_current_store_id ON public.products;
CREATE TRIGGER trg_products_apply_current_store_id
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.apply_current_store_id();

DROP TRIGGER IF EXISTS trg_product_variants_apply_current_store_id ON public.product_variants;
CREATE TRIGGER trg_product_variants_apply_current_store_id
  BEFORE INSERT ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.apply_current_store_id();

DROP TRIGGER IF EXISTS trg_stock_adjustments_apply_current_store_id ON public.stock_adjustments;
CREATE TRIGGER trg_stock_adjustments_apply_current_store_id
  BEFORE INSERT ON public.stock_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.apply_current_store_id();

DROP TRIGGER IF EXISTS trg_suppliers_apply_current_store_id ON public.suppliers;
CREATE TRIGGER trg_suppliers_apply_current_store_id
  BEFORE INSERT ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.apply_current_store_id();

DROP TRIGGER IF EXISTS trg_customers_apply_current_store_id ON public.customers;
CREATE TRIGGER trg_customers_apply_current_store_id
  BEFORE INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.apply_current_store_id();

DROP TRIGGER IF EXISTS trg_orders_apply_current_store_id ON public.orders;
CREATE TRIGGER trg_orders_apply_current_store_id
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.apply_current_store_id();

DROP TRIGGER IF EXISTS trg_purchases_apply_current_store_id ON public.purchases;
CREATE TRIGGER trg_purchases_apply_current_store_id
  BEFORE INSERT ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.apply_current_store_id();

DROP TRIGGER IF EXISTS trg_order_items_sync_store_id ON public.order_items;
CREATE TRIGGER trg_order_items_sync_store_id
  BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_order_item_store_id();

DROP TRIGGER IF EXISTS trg_payments_sync_store_id ON public.payments;
CREATE TRIGGER trg_payments_sync_store_id
  BEFORE INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_payment_store_id();

DROP TRIGGER IF EXISTS trg_purchase_items_sync_store_id ON public.purchase_items;
CREATE TRIGGER trg_purchase_items_sync_store_id
  BEFORE INSERT ON public.purchase_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_purchase_item_store_id();

DROP TRIGGER IF EXISTS trg_customer_account_payments_sync_store_id ON public.customer_account_payments;
CREATE TRIGGER trg_customer_account_payments_sync_store_id
  BEFORE INSERT ON public.customer_account_payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_customer_account_payment_store_id();
