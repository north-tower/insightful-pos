-- ============================================================================
-- 022 - Store-scoped document numbering
-- Replaces global sequences with per-store counters for order, invoice,
-- and purchase numbers.
-- ============================================================================

-- ─── Per-store counters ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.store_counters (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  counter_key  TEXT NOT NULL, -- restaurant_order | retail_order | invoice | purchase
  counter_value BIGINT NOT NULL DEFAULT 0 CHECK (counter_value >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, counter_key)
);

DROP TRIGGER IF EXISTS store_counters_updated_at ON public.store_counters;
CREATE TRIGGER store_counters_updated_at
  BEFORE UPDATE ON public.store_counters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.store_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store members can read store counters" ON public.store_counters;
CREATE POLICY "Store members can read store counters"
  ON public.store_counters FOR SELECT
  TO authenticated
  USING (public.can_access_store(store_id));

DROP POLICY IF EXISTS "Store admins can manage counters" ON public.store_counters;
CREATE POLICY "Store admins can manage counters"
  ON public.store_counters FOR ALL
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );


-- ─── Atomic helper: get next counter value by store/key ─────────────────────

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
        -- Another concurrent transaction inserted this row first.
    END;
  END LOOP;
END;
$$;


-- ─── Store-scoped generators (backwards compatible names) ───────────────────

CREATE OR REPLACE FUNCTION public.generate_order_number(
  p_business_mode TEXT,
  p_store_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_id UUID;
  v_seq BIGINT;
  v_key TEXT;
  v_start BIGINT;
BEGIN
  v_store_id := COALESCE(p_store_id, public.current_store_id());
  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Store is required to generate order number';
  END IF;

  IF p_business_mode = 'retail' THEN
    v_key := 'retail_order';
    v_start := 1;
    v_seq := public.next_store_counter_value(v_store_id, v_key, v_start);
    RETURN 'R' || lpad(v_seq::text, 4, '0');
  ELSE
    v_key := 'restaurant_order';
    v_start := 51;
    v_seq := public.next_store_counter_value(v_store_id, v_key, v_start);
    RETURN 'F' || lpad(v_seq::text, 4, '0');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_invoice_number(
  p_store_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_id UUID;
  v_seq BIGINT;
  v_year TEXT;
BEGIN
  v_store_id := COALESCE(p_store_id, public.current_store_id());
  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Store is required to generate invoice number';
  END IF;

  v_seq := public.next_store_counter_value(v_store_id, 'invoice', 1);
  v_year := to_char(now(), 'YYYY');
  RETURN 'INV-' || v_year || '-' || lpad(v_seq::text, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_purchase_number(
  p_store_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_id UUID;
  v_seq BIGINT;
  v_year TEXT;
BEGIN
  v_store_id := COALESCE(p_store_id, public.current_store_id());
  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Store is required to generate purchase number';
  END IF;

  v_seq := public.next_store_counter_value(v_store_id, 'purchase', 1);
  v_year := to_char(now(), 'YYYY');
  RETURN 'PO-' || v_year || '-' || lpad(v_seq::text, 4, '0');
END;
$$;
