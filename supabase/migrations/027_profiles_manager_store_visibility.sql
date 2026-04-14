-- ============================================================================
-- 027 - Let managers read profiles in their own store
-- So assignment UIs can show cashier names/emails instead of UUIDs.
-- ============================================================================

DROP POLICY IF EXISTS "Managers can view store member profiles" ON public.profiles;

CREATE POLICY "Managers can view store member profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1
      FROM public.profile_stores target_ps
      WHERE target_ps.profile_id = profiles.id
        AND public.user_can_access_store(target_ps.store_id)
    )
  );
