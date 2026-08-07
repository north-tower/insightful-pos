-- ============================================================================
-- 057 - Fallback active branch when no default is set
-- Managers/cashiers with a membership but is_default_store=false saw empty stock
-- because current_store_id() returned null and RLS hid all branch data.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_store_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT ps.store_id
      FROM public.profile_stores ps
      INNER JOIN public.stores s ON s.id = ps.store_id
      WHERE ps.profile_id = auth.uid()
        AND ps.is_default_store = true
        AND s.status = 'active'
      LIMIT 1
    ),
    (
      SELECT ps.store_id
      FROM public.profile_stores ps
      INNER JOIN public.stores s ON s.id = ps.store_id
      WHERE ps.profile_id = auth.uid()
        AND s.status = 'active'
      ORDER BY s.is_headquarters DESC, s.name ASC
      LIMIT 1
    )
  );
$$;

-- If the user has memberships but none marked default, promote one.
CREATE OR REPLACE FUNCTION public.ensure_default_store()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT ps.store_id INTO v_store_id
  FROM public.profile_stores ps
  INNER JOIN public.stores s ON s.id = ps.store_id
  WHERE ps.profile_id = auth.uid()
    AND ps.is_default_store = true
    AND s.status = 'active'
  LIMIT 1;

  IF v_store_id IS NOT NULL THEN
    RETURN v_store_id;
  END IF;

  SELECT ps.store_id INTO v_store_id
  FROM public.profile_stores ps
  INNER JOIN public.stores s ON s.id = ps.store_id
  WHERE ps.profile_id = auth.uid()
    AND s.status = 'active'
  ORDER BY s.is_headquarters DESC, s.name ASC
  LIMIT 1;

  IF v_store_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.profile_stores
  SET is_default_store = false
  WHERE profile_id = auth.uid()
    AND is_default_store = true;

  UPDATE public.profile_stores
  SET is_default_store = true
  WHERE profile_id = auth.uid()
    AND store_id = v_store_id;

  RETURN v_store_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_default_store() TO authenticated;
