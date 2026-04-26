-- ============================================================================
-- 032 - Enforce staff (cashier + manager) allocation-based retail selling
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_cashier_stock_allocation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_business_mode TEXT;
  v_has_staff_membership BOOLEAN;
BEGIN
  SELECT p.business_mode
  INTO v_business_mode
  FROM public.products p
  WHERE p.id = NEW.product_id;

  IF v_business_mode IS DISTINCT FROM 'retail' THEN
    RAISE EXCEPTION 'Allocation is only allowed for retail products';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profile_stores ps
    WHERE ps.profile_id = NEW.cashier_id
      AND ps.store_id = NEW.store_id
      AND ps.role_in_store IN ('cashier', 'manager')
  )
  INTO v_has_staff_membership;

  IF NOT v_has_staff_membership THEN
    RAISE EXCEPTION 'Selected user must be a cashier or manager in this store';
  END IF;

  IF NEW.sold_qty > NEW.assigned_qty THEN
    RAISE EXCEPTION 'sold_qty cannot exceed assigned_qty';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_cashier_stock_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_staff_id UUID;
  v_store_id UUID;
  v_staff_role TEXT;
BEGIN
  SELECT o.staff_id, o.store_id
  INTO v_staff_id, v_store_id
  FROM public.orders o
  WHERE o.id = NEW.order_id;

  IF v_staff_id IS NULL OR v_store_id IS NULL OR NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ps.role_in_store
  INTO v_staff_role
  FROM public.profile_stores ps
  WHERE ps.profile_id = v_staff_id
    AND ps.store_id = v_store_id
  ORDER BY ps.is_default_store DESC
  LIMIT 1;

  IF v_staff_role NOT IN ('cashier', 'manager') THEN
    RETURN NEW;
  END IF;

  UPDATE public.cashier_stock_allocations csa
  SET sold_qty = sold_qty + NEW.quantity,
      updated_at = now()
  WHERE csa.store_id = v_store_id
    AND csa.cashier_id = v_staff_id
    AND csa.product_id = NEW.product_id
    AND csa.is_active = true
    AND (csa.sold_qty + NEW.quantity) <= csa.assigned_qty;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff allocation exceeded or missing for product %', NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$;
