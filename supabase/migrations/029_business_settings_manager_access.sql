-- ============================================================================
-- 029 - Allow manager/admin to manage business settings
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert own business settings" ON public.business_settings;
CREATE POLICY "Users can insert own business settings"
  ON public.business_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR public.get_my_role() IN ('admin', 'manager')
  );

DROP POLICY IF EXISTS "Users can update own business settings" ON public.business_settings;
CREATE POLICY "Users can update own business settings"
  ON public.business_settings FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.get_my_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    auth.uid() = user_id
    OR public.get_my_role() IN ('admin', 'manager')
  );
