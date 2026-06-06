-- ============================================================================
-- 042 - Staff assignments deduct main stock; returns restore unsold units
-- ============================================================================

ALTER TABLE public.stock_adjustments
  DROP CONSTRAINT IF EXISTS stock_adjustments_type_check;

ALTER TABLE public.stock_adjustments
  ADD CONSTRAINT stock_adjustments_type_check
  CHECK (type IN (
    'restock', 'damaged', 'returned', 'sold', 'adjustment',
    'production_in', 'production_out',
    'staff_assign_out', 'staff_assign_return'
  ));

CREATE OR REPLACE FUNCTION public.apply_staff_allocation_stock_out()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_prev_stock NUMERIC;
  v_new_stock NUMERIC;
  v_route_name TEXT;
  v_assignment_date DATE;
  v_note TEXT;
BEGIN
  IF NEW.is_active IS NOT TRUE OR NEW.assigned_qty <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.stock, 0)
  INTO v_prev_stock
  FROM public.products p
  WHERE p.id = NEW.product_id
  FOR UPDATE;

  IF v_prev_stock < NEW.assigned_qty THEN
    RAISE EXCEPTION
      'Insufficient main stock for this assignment. Available: %, requested: %',
      v_prev_stock,
      NEW.assigned_qty;
  END IF;

  v_new_stock := v_prev_stock - NEW.assigned_qty;

  UPDATE public.products
  SET stock = v_new_stock,
      updated_at = now()
  WHERE id = NEW.product_id;

  IF NEW.assignment_id IS NOT NULL THEN
    SELECT sia.route_name, sia.assignment_date
    INTO v_route_name, v_assignment_date
    FROM public.staff_inventory_assignments sia
    WHERE sia.id = NEW.assignment_id;
  END IF;

  v_note := 'Staff assignment out';
  IF v_route_name IS NOT NULL THEN
    v_note := v_note || ': ' || v_route_name;
  END IF;
  IF v_assignment_date IS NOT NULL THEN
    v_note := v_note || ' (' || v_assignment_date::TEXT || ')';
  END IF;

  INSERT INTO public.stock_adjustments (
    product_id,
    store_id,
    type,
    quantity,
    previous_stock,
    new_stock,
    note,
    staff_id
  )
  VALUES (
    NEW.product_id,
    NEW.store_id,
    'staff_assign_out',
    -NEW.assigned_qty,
    v_prev_stock,
    v_new_stock,
    v_note,
    COALESCE(NEW.assigned_by, auth.uid())
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_staff_allocation_stock_return()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_remaining NUMERIC;
  v_prev_stock NUMERIC;
  v_new_stock NUMERIC;
  v_route_name TEXT;
  v_assignment_date DATE;
  v_note TEXT;
BEGIN
  IF OLD.is_active IS NOT TRUE OR NEW.is_active IS NOT FALSE THEN
    RETURN NEW;
  END IF;

  v_remaining := GREATEST(OLD.assigned_qty - OLD.sold_qty, 0);
  IF v_remaining <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.stock, 0)
  INTO v_prev_stock
  FROM public.products p
  WHERE p.id = OLD.product_id
  FOR UPDATE;

  v_new_stock := v_prev_stock + v_remaining;

  UPDATE public.products
  SET stock = v_new_stock,
      updated_at = now()
  WHERE id = OLD.product_id;

  IF OLD.assignment_id IS NOT NULL THEN
    SELECT sia.route_name, sia.assignment_date
    INTO v_route_name, v_assignment_date
    FROM public.staff_inventory_assignments sia
    WHERE sia.id = OLD.assignment_id;
  END IF;

  v_note := 'Staff assignment return — ' || v_remaining::TEXT || ' unsold unit(s)';
  IF v_route_name IS NOT NULL THEN
    v_note := v_note || ': ' || v_route_name;
  END IF;
  IF v_assignment_date IS NOT NULL THEN
    v_note := v_note || ' (' || v_assignment_date::TEXT || ')';
  END IF;

  INSERT INTO public.stock_adjustments (
    product_id,
    store_id,
    type,
    quantity,
    previous_stock,
    new_stock,
    note,
    staff_id
  )
  VALUES (
    OLD.product_id,
    OLD.store_id,
    'staff_assign_return',
    v_remaining,
    v_prev_stock,
    v_new_stock,
    v_note,
    auth.uid()
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_staff_allocation_stock_out ON public.cashier_stock_allocations;
CREATE TRIGGER trg_staff_allocation_stock_out
  AFTER INSERT ON public.cashier_stock_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_staff_allocation_stock_out();

DROP TRIGGER IF EXISTS trg_staff_allocation_stock_return ON public.cashier_stock_allocations;
CREATE TRIGGER trg_staff_allocation_stock_return
  AFTER UPDATE OF is_active ON public.cashier_stock_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_staff_allocation_stock_return();
