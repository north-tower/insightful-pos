-- ============================================================================
-- 028 - Fix cashier allocation RLS for manager/admin assignment
-- ============================================================================

DROP POLICY IF EXISTS "Users can read own cashier allocations" ON public.cashier_stock_allocations;
CREATE POLICY "Users can read own cashier allocations"
  ON public.cashier_stock_allocations FOR SELECT
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND (
      cashier_id = auth.uid()
      OR public.get_my_role() IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Manager admin can manage cashier allocations" ON public.cashier_stock_allocations;
CREATE POLICY "Manager admin can manage cashier allocations"
  ON public.cashier_stock_allocations FOR ALL
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );
