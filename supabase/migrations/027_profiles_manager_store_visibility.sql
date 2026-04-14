-- ============================================================================
-- 027 - Let managers read profiles in their own store
-- So assignment UIs can show cashier names/emails instead of UUIDs.
-- ============================================================================

DROP POLICY IF EXISTS "Managers can view store member profiles" ON public.profiles;

CREATE POLICY "Managers can view store member profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profile_stores target_ps
      JOIN public.profile_stores actor_ps
        ON actor_ps.store_id = target_ps.store_id
      WHERE target_ps.profile_id = profiles.id
        AND actor_ps.profile_id = auth.uid()
        AND actor_ps.role_in_store IN ('admin', 'manager')
    )
  );
