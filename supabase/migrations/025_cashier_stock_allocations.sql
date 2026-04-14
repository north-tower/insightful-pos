-- ============================================================================
-- 025 - Cashier stock allocations per store
-- Managers/Admins assign product quantities to cashiers.
-- Cashier sales consume from assigned quantities.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cashier_stock_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  cashier_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  assigned_qty INT NOT NULL CHECK (assigned_qty >= 0),
  sold_qty INT NOT NULL DEFAULT 0 CHECK (sold_qty >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, cashier_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_cashier_stock_allocations_cashier
  ON public.cashier_stock_allocations(cashier_id, store_id);
CREATE INDEX IF NOT EXISTS idx_cashier_stock_allocations_product
  ON public.cashier_stock_allocations(product_id, store_id);

ALTER TABLE public.cashier_stock_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own cashier allocations" ON public.cashier_stock_allocations;
CREATE POLICY "Users can read own cashier allocations"
  ON public.cashier_stock_allocations FOR SELECT
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND (
      cashier_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.profile_stores ps
        WHERE ps.profile_id = auth.uid()
          AND ps.store_id = cashier_stock_allocations.store_id
          AND ps.role_in_store IN ('admin', 'manager')
      )
    )
  );

DROP POLICY IF EXISTS "Manager admin can manage cashier allocations" ON public.cashier_stock_allocations;
CREATE POLICY "Manager admin can manage cashier allocations"
  ON public.cashier_stock_allocations FOR ALL
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND EXISTS (
      SELECT 1
      FROM public.profile_stores ps
      WHERE ps.profile_id = auth.uid()
        AND ps.store_id = cashier_stock_allocations.store_id
        AND ps.role_in_store IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    public.can_access_store(store_id)
    AND EXISTS (
      SELECT 1
      FROM public.profile_stores ps
      WHERE ps.profile_id = auth.uid()
        AND ps.store_id = cashier_stock_allocations.store_id
        AND ps.role_in_store IN ('admin', 'manager')
    )
  );

CREATE OR REPLACE FUNCTION public.validate_cashier_stock_allocation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_business_mode TEXT;
  v_has_cashier_membership BOOLEAN;
BEGIN
  SELECT p.business_mode
  INTO v_business_mode
  FROM public.products p
  WHERE p.id = NEW.product_id;

  IF v_business_mode IS DISTINCT FROM 'retail' THEN
    RAISE EXCEPTION 'Cashier allocation is only allowed for retail products';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profile_stores ps
    WHERE ps.profile_id = NEW.cashier_id
      AND ps.store_id = NEW.store_id
      AND ps.role_in_store = 'cashier'
  )
  INTO v_has_cashier_membership;

  IF NOT v_has_cashier_membership THEN
    RAISE EXCEPTION 'Selected user is not a cashier in this store';
  END IF;

  IF NEW.sold_qty > NEW.assigned_qty THEN
    RAISE EXCEPTION 'sold_qty cannot exceed assigned_qty';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_cashier_stock_allocation ON public.cashier_stock_allocations;
CREATE TRIGGER trg_validate_cashier_stock_allocation
  BEFORE INSERT OR UPDATE ON public.cashier_stock_allocations
  FOR EACH ROW EXECUTE FUNCTION public.validate_cashier_stock_allocation();

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

  IF v_staff_role <> 'cashier' THEN
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
    RAISE EXCEPTION 'Cashier stock allocation exceeded or missing for product %', NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_cashier_stock_sale ON public.order_items;
CREATE TRIGGER trg_apply_cashier_stock_sale
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.apply_cashier_stock_sale();
