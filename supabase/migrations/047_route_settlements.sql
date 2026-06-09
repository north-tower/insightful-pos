-- ============================================================================
-- 047 - Route settlements (cash remittance at end of assignment)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.route_settlements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id            UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  assignment_id       UUID NOT NULL UNIQUE
                        REFERENCES public.staff_inventory_assignments(id) ON DELETE CASCADE,
  expected_remittance NUMERIC(12,2) NOT NULL DEFAULT 0,
  cash_submitted      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cash_submitted >= 0),
  mpesa_submitted     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (mpesa_submitted >= 0),
  bank_submitted      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (bank_submitted >= 0),
  variance            NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes               TEXT,
  is_finalized        BOOLEAN NOT NULL DEFAULT false,
  finalized_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  finalized_by_name   TEXT,
  finalized_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_route_settlements_store
  ON public.route_settlements(store_id);

CREATE TRIGGER route_settlements_updated_at
  BEFORE UPDATE ON public.route_settlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.route_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members can read route settlements"
  ON public.route_settlements FOR SELECT
  TO authenticated
  USING (public.can_access_store(store_id));

CREATE POLICY "Admin manager can manage route settlements"
  ON public.route_settlements FOR ALL
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

DROP TRIGGER IF EXISTS trg_route_settlements_apply_current_store_id ON public.route_settlements;
CREATE TRIGGER trg_route_settlements_apply_current_store_id
  BEFORE INSERT ON public.route_settlements
  FOR EACH ROW EXECUTE FUNCTION public.apply_current_store_id();
