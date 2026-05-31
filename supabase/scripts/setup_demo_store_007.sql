-- ============================================================================
-- Setup: demo login that shows Store 007 data without writing to the database
--
-- Prerequisites:
--   1. Migration 040_demo_accounts.sql applied
--   2. A store with code '007' exists (adjust code below if yours differs)
--   3. Create the auth user in Supabase Dashboard → Authentication → Users
--      Email:    demo@yourcompany.com  (or your choice)
--      Password: (strong demo password)
--      Copy the user's UUID
--
-- Then run this script in SQL Editor, replacing :demo_user_id and emails as needed.
-- ============================================================================

-- ─── 1. Resolve store 007 ───────────────────────────────────────────────────

DO $$
DECLARE
  v_store_id UUID;
  v_demo_user_id UUID := '00000000-0000-0000-0000-000000000000'; -- ← REPLACE with auth.users.id
  v_demo_email TEXT := 'demo@insightfulpos.com';                    -- ← REPLACE
  v_demo_name TEXT := 'Top Ranch Demo';
BEGIN
  SELECT id INTO v_store_id
  FROM public.stores
  WHERE lower(code) = '007'
  LIMIT 1;

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'No store with code 007 found. Check stores.code or create the store first.';
  END IF;

  IF v_demo_user_id = '00000000-0000-0000-0000-000000000000'::UUID THEN
    RAISE EXCEPTION 'Set v_demo_user_id to the Supabase Auth user UUID before running this script.';
  END IF;

  -- Profile (retail manager so all demo screens are visible)
  INSERT INTO public.profiles (
    id, email, full_name, role, business_mode, is_demo
  ) VALUES (
    v_demo_user_id,
    v_demo_email,
    v_demo_name,
    'manager',
    'retail',
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = 'manager',
    business_mode = 'retail',
    is_demo = true,
    updated_at = now();

  -- Single store membership: 007 only
  UPDATE public.profile_stores
  SET is_default_store = false
  WHERE profile_id = v_demo_user_id;

  INSERT INTO public.profile_stores (
    profile_id, store_id, role_in_store, is_default_store
  ) VALUES (
    v_demo_user_id, v_store_id, 'manager', true
  )
  ON CONFLICT (profile_id, store_id) DO UPDATE SET
    role_in_store = 'manager',
    is_default_store = true;

  RAISE NOTICE 'Demo user % linked to store 007 (id %). is_demo=true.', v_demo_email, v_store_id;
END;
$$;

-- Verify
-- SELECT p.email, p.is_demo, s.code, s.name, ps.is_default_store
-- FROM public.profiles p
-- JOIN public.profile_stores ps ON ps.profile_id = p.id
-- JOIN public.stores s ON s.id = ps.store_id
-- WHERE p.is_demo = true;
