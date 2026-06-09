-- ============================================================================
-- 046 - Link orders and expenses to staff route assignments (daily sales report)
-- ============================================================================

ALTER TABLE public.operating_expenses
  ADD COLUMN IF NOT EXISTS assignment_id UUID
    REFERENCES public.staff_inventory_assignments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_operating_expenses_assignment
  ON public.operating_expenses(assignment_id)
  WHERE assignment_id IS NOT NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS assignment_id UUID
    REFERENCES public.staff_inventory_assignments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_assignment
  ON public.orders(assignment_id)
  WHERE assignment_id IS NOT NULL;
