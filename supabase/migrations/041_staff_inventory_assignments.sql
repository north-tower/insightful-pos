-- ============================================================================
-- 041 - Staff inventory assignment batches (date + route + products)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.staff_inventory_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  cashier_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assignment_date DATE NOT NULL,
  route_name TEXT NOT NULL CHECK (char_length(trim(route_name)) > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_inventory_assignments_store_cashier
  ON public.staff_inventory_assignments(store_id, cashier_id, assignment_date DESC);

ALTER TABLE public.cashier_stock_allocations
  ADD COLUMN IF NOT EXISTS assignment_id UUID
    REFERENCES public.staff_inventory_assignments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cashier_stock_allocations_assignment
  ON public.cashier_stock_allocations(assignment_id);

ALTER TABLE public.staff_inventory_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read staff inventory assignments" ON public.staff_inventory_assignments;
CREATE POLICY "Users can read staff inventory assignments"
  ON public.staff_inventory_assignments FOR SELECT
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND (
      cashier_id = auth.uid()
      OR public.get_my_role() IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Manager admin can manage staff inventory assignments" ON public.staff_inventory_assignments;
CREATE POLICY "Manager admin can manage staff inventory assignments"
  ON public.staff_inventory_assignments FOR ALL
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE OR REPLACE FUNCTION public.validate_staff_inventory_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_has_staff_membership BOOLEAN;
BEGIN
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

  NEW.route_name := trim(NEW.route_name);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_staff_inventory_assignment ON public.staff_inventory_assignments;
CREATE TRIGGER trg_validate_staff_inventory_assignment
  BEFORE INSERT OR UPDATE ON public.staff_inventory_assignments
  FOR EACH ROW EXECUTE FUNCTION public.validate_staff_inventory_assignment();
