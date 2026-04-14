-- ============================================================================
-- 024 - Audit profile_stores mutations
-- Helps diagnose unexpected automatic store assignments for newly created users.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profile_stores_audit (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  profile_id UUID,
  store_id UUID,
  role_in_store TEXT,
  is_default_store BOOLEAN,
  actor_uid UUID,
  actor_role TEXT,
  actor_email TEXT,
  request_jwt_sub TEXT,
  request_jwt_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.audit_profile_stores()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_id UUID;
  v_store_id UUID;
  v_role_in_store TEXT;
  v_is_default_store BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_profile_id := OLD.profile_id;
    v_store_id := OLD.store_id;
    v_role_in_store := OLD.role_in_store;
    v_is_default_store := OLD.is_default_store;
  ELSE
    v_profile_id := NEW.profile_id;
    v_store_id := NEW.store_id;
    v_role_in_store := NEW.role_in_store;
    v_is_default_store := NEW.is_default_store;
  END IF;

  INSERT INTO public.profile_stores_audit (
    action,
    profile_id,
    store_id,
    role_in_store,
    is_default_store,
    actor_uid,
    actor_role,
    actor_email,
    request_jwt_sub,
    request_jwt_role
  )
  VALUES (
    TG_OP,
    v_profile_id,
    v_store_id,
    v_role_in_store,
    v_is_default_store,
    auth.uid(),
    auth.role(),
    auth.email(),
    current_setting('request.jwt.claim.sub', true),
    current_setting('request.jwt.claim.role', true)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_stores_audit ON public.profile_stores;
CREATE TRIGGER trg_profile_stores_audit
AFTER INSERT OR UPDATE OR DELETE ON public.profile_stores
FOR EACH ROW EXECUTE FUNCTION public.audit_profile_stores();
