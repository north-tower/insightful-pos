-- ============================================================================
-- 055 - Scope admin branch access to their parent business(es) only
-- Admins switch among Top Ranch branches, not every business in the system.
-- ============================================================================

-- Access: membership, OR admin of a business that owns this store.
CREATE OR REPLACE FUNCTION public.user_can_access_store(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.profile_stores ps
      WHERE ps.profile_id = auth.uid()
        AND ps.store_id = p_store_id
    )
    OR (
      public.get_my_role() = 'admin'
      AND EXISTS (
        SELECT 1
        FROM public.stores target
        WHERE target.id = p_store_id
          AND target.business_id IN (
            SELECT s.business_id
            FROM public.profile_stores ps
            INNER JOIN public.stores s ON s.id = ps.store_id
            WHERE ps.profile_id = auth.uid()
          )
      )
    );
$$;

-- Admins: all active branches under businesses they belong to.
-- Others: only explicitly assigned branches.
CREATE OR REPLACE FUNCTION public.my_branch_stores()
RETURNS TABLE (
  id UUID,
  code TEXT,
  name TEXT,
  business_id UUID,
  business_name TEXT,
  is_headquarters BOOLEAN,
  is_default_store BOOLEAN,
  role_in_store TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := public.get_my_role();

  IF v_role = 'admin' THEN
    RETURN QUERY
    SELECT
      s.id,
      s.code,
      s.name,
      s.business_id,
      b.name AS business_name,
      s.is_headquarters,
      COALESCE(ps.is_default_store, false) AS is_default_store,
      COALESCE(ps.role_in_store, 'admin') AS role_in_store
    FROM public.stores s
    INNER JOIN public.businesses b ON b.id = s.business_id
    LEFT JOIN public.profile_stores ps
      ON ps.store_id = s.id
     AND ps.profile_id = auth.uid()
    WHERE s.status = 'active'
      AND s.business_id IN (
        SELECT mem_store.business_id
        FROM public.profile_stores mem
        INNER JOIN public.stores mem_store ON mem_store.id = mem.store_id
        WHERE mem.profile_id = auth.uid()
      )
    ORDER BY b.name, s.is_headquarters DESC, s.name;
  ELSE
    RETURN QUERY
    SELECT
      s.id,
      s.code,
      s.name,
      s.business_id,
      b.name AS business_name,
      s.is_headquarters,
      COALESCE(ps.is_default_store, false) AS is_default_store,
      ps.role_in_store
    FROM public.profile_stores ps
    INNER JOIN public.stores s ON s.id = ps.store_id
    INNER JOIN public.businesses b ON b.id = s.business_id
    WHERE ps.profile_id = auth.uid()
      AND s.status = 'active'
    ORDER BY b.name, s.is_headquarters DESC, s.name;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.my_branch_stores() TO authenticated;

-- Admins may switch to any branch under their business(es); membership is created if missing.
CREATE OR REPLACE FUNCTION public.set_my_default_store(p_store_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT;
  v_has_membership BOOLEAN;
  v_same_business BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = p_store_id AND s.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Branch not found or inactive';
  END IF;

  v_role := public.get_my_role();
  v_has_membership := EXISTS (
    SELECT 1
    FROM public.profile_stores ps
    WHERE ps.profile_id = auth.uid()
      AND ps.store_id = p_store_id
  );

  v_same_business := EXISTS (
    SELECT 1
    FROM public.stores target
    WHERE target.id = p_store_id
      AND target.business_id IN (
        SELECT s.business_id
        FROM public.profile_stores ps
        INNER JOIN public.stores s ON s.id = ps.store_id
        WHERE ps.profile_id = auth.uid()
      )
  );

  IF NOT v_has_membership THEN
    IF v_role = 'admin' AND v_same_business THEN
      INSERT INTO public.profile_stores (profile_id, store_id, role_in_store, is_default_store)
      VALUES (auth.uid(), p_store_id, 'admin', false)
      ON CONFLICT (profile_id, store_id) DO NOTHING;
    ELSE
      RAISE EXCEPTION 'Cannot set default: store is not assigned to this user';
    END IF;
  END IF;

  UPDATE public.profile_stores
  SET is_default_store = false
  WHERE profile_id = auth.uid()
    AND is_default_store = true;

  UPDATE public.profile_stores
  SET is_default_store = true
  WHERE profile_id = auth.uid()
    AND store_id = p_store_id;

  IF NOT FOUND THEN
    INSERT INTO public.profile_stores (profile_id, store_id, role_in_store, is_default_store)
    VALUES (auth.uid(), p_store_id, COALESCE(v_role, 'cashier'), true)
    ON CONFLICT (profile_id, store_id) DO UPDATE
      SET is_default_store = true;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_my_default_store(UUID) TO authenticated;
