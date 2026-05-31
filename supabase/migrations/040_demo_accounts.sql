-- ============================================================================
-- 040 - Demo accounts (read-only: see live store data, no DB writes)
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_is_demo ON public.profiles(is_demo)
  WHERE is_demo = true;

CREATE OR REPLACE FUNCTION public.is_demo_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT is_demo FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.assert_not_demo_user()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.is_demo_user() THEN
    RAISE EXCEPTION 'Demo account: changes are not saved to the database'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_demo_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_not_demo_user();
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Block counter increments (order / invoice / purchase / batch numbers)
CREATE OR REPLACE FUNCTION public.next_store_counter_value(
  p_store_id UUID,
  p_counter_key TEXT,
  p_start_value BIGINT DEFAULT 1
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_next BIGINT;
BEGIN
  PERFORM public.assert_not_demo_user();

  LOOP
    UPDATE public.store_counters
    SET counter_value = counter_value + 1
    WHERE store_id = p_store_id
      AND counter_key = p_counter_key
    RETURNING counter_value INTO v_next;

    IF FOUND THEN
      RETURN v_next;
    END IF;

    BEGIN
      INSERT INTO public.store_counters (store_id, counter_key, counter_value)
      VALUES (p_store_id, p_counter_key, GREATEST(p_start_value, 1))
      RETURNING counter_value INTO v_next;
      RETURN v_next;
    EXCEPTION
      WHEN unique_violation THEN
        NULL;
    END;
  END LOOP;
END;
$$;

-- ─── Triggers on mutable tables ─────────────────────────────────────────────

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'orders',
    'order_items',
    'payments',
    'products',
    'categories',
    'product_variants',
    'stock_adjustments',
    'purchases',
    'purchase_items',
    'suppliers',
    'customers',
    'customer_account_payments',
    'operating_expenses',
    'production_batches',
    'production_batch_consumption',
    'product_recipe_lines',
    'cashier_stock_allocations',
    'business_settings'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_reject_demo_%I ON public.%I',
      t, t
    );
    EXECUTE format(
      'CREATE TRIGGER trg_reject_demo_%I
       BEFORE INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.reject_demo_mutation()',
      t, t
    );
  END LOOP;
END;
$$;
