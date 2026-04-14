-- ============================================================================
-- 026 - Allow managers to read store memberships in their own store
-- Fixes manager views (e.g. cashier assignment dropdown) showing only self.
-- ============================================================================

DROP POLICY IF EXISTS "Users can read own store memberships" ON public.profile_stores;

CREATE POLICY "Users can read own store memberships"
  ON public.profile_stores FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR public.get_my_role() = 'admin'
    OR (
      public.get_my_role() IN ('admin', 'manager')
      AND public.user_can_access_store(store_id)
    )
  );
