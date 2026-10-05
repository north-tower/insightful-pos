-- ============================================================================
-- 060 - Resolve PostgREST overload ambiguity on create_order_atomic
--
-- Migration 059 added p_store_id for WhatsApp ops but did not drop the
-- 050 signature. RPC calls without p_store_id hit PGRST203 (two candidates).
-- Also re-assert ensure_default_store (057) for projects that skipped it.
-- ============================================================================

DROP FUNCTION IF EXISTS public.create_order_atomic(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TEXT,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  TEXT,
  TEXT,
  TEXT,
  UUID,
  TEXT,
  UUID,
  TIMESTAMPTZ,
  TIMESTAMPTZ
);

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
