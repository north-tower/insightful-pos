-- ============================================================================
-- 030 - Allow manager/admin to update their accessible store records
-- Used for store-specific business name updates from Settings.
-- ============================================================================

DROP POLICY IF EXISTS "Manager admin can update own stores" ON public.stores;

CREATE POLICY "Manager admin can update own stores"
  ON public.stores FOR UPDATE
  TO authenticated
  USING (
    public.can_access_store(id)
    AND public.get_my_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    public.can_access_store(id)
    AND public.get_my_role() IN ('admin', 'manager')
  );
