-- ============================================================================
-- 053 - Businesses (parent) + stores as branches
-- Existing stores become headquarters branches under a matching business.
-- ============================================================================

-- ─── Businesses (parent company) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.businesses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'inactive')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS businesses_updated_at ON public.businesses;
CREATE TRIGGER businesses_updated_at
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read businesses" ON public.businesses;
CREATE POLICY "Authenticated users can read businesses"
  ON public.businesses FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage businesses" ON public.businesses;
CREATE POLICY "Admins can manage businesses"
  ON public.businesses FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ─── Link stores (branches) to businesses ────────────────────────────────────

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE RESTRICT;

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS is_headquarters BOOLEAN NOT NULL DEFAULT false;

-- One business per existing store (today's "parent businesses"), store becomes HQ branch
INSERT INTO public.businesses (code, name, status)
SELECT s.code, s.name, s.status
FROM public.stores s
WHERE NOT EXISTS (
  SELECT 1 FROM public.businesses b WHERE b.code = s.code
);

UPDATE public.stores s
SET
  business_id = b.id,
  is_headquarters = true
FROM public.businesses b
WHERE b.code = s.code
  AND s.business_id IS NULL;

-- Ensure every store has a business (fallback)
DO $$
DECLARE
  v_business_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM public.stores WHERE business_id IS NULL) THEN
    INSERT INTO public.businesses (code, name)
    VALUES ('default', 'Default Business')
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_business_id;

    IF v_business_id IS NULL THEN
      SELECT id INTO v_business_id FROM public.businesses WHERE code = 'default';
    END IF;

    UPDATE public.stores
    SET business_id = v_business_id, is_headquarters = COALESCE(is_headquarters, true)
    WHERE business_id IS NULL;
  END IF;
END $$;

ALTER TABLE public.stores
  ALTER COLUMN business_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stores_business_id ON public.stores(business_id);

-- Only one headquarters branch per business
CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_one_hq_per_business
  ON public.stores(business_id)
  WHERE is_headquarters = true;

-- ─── Inter-branch stock transfers ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.branch_stock_transfers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  from_store_id     UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  to_store_id       UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  to_product_id     UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity          NUMERIC(12,4) NOT NULL CHECK (quantity > 0),
  note              TEXT,
  transferred_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  transferred_by_name TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_store_id <> to_store_id)
);

CREATE INDEX IF NOT EXISTS idx_branch_transfers_business
  ON public.branch_stock_transfers(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_branch_transfers_from
  ON public.branch_stock_transfers(from_store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_branch_transfers_to
  ON public.branch_stock_transfers(to_store_id, created_at DESC);

ALTER TABLE public.branch_stock_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store members can read branch transfers" ON public.branch_stock_transfers;
CREATE POLICY "Store members can read branch transfers"
  ON public.branch_stock_transfers FOR SELECT
  TO authenticated
  USING (
    public.can_access_store(from_store_id)
    OR public.can_access_store(to_store_id)
  );

DROP POLICY IF EXISTS "Admin manager can create branch transfers" ON public.branch_stock_transfers;
CREATE POLICY "Admin manager can create branch transfers"
  ON public.branch_stock_transfers FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_my_role() IN ('admin', 'manager')
    AND public.can_access_store(from_store_id)
    AND public.can_access_store(to_store_id)
  );

-- Atomic transfer: deduct at source, upsert/add at destination (match by sku then name)
CREATE OR REPLACE FUNCTION public.transfer_stock_between_branches(
  p_from_store_id UUID,
  p_to_store_id UUID,
  p_product_id UUID,
  p_quantity NUMERIC,
  p_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT;
  v_business_id UUID;
  v_to_business_id UUID;
  v_src public.products%ROWTYPE;
  v_dest_id UUID;
  v_prev NUMERIC;
  v_new NUMERIC;
  v_dest_prev NUMERIC;
  v_dest_new NUMERIC;
  v_transfer_id UUID;
  v_user_id UUID;
  v_user_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_role := public.get_my_role();
  IF v_role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Only admin or manager can transfer stock between branches';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Transfer quantity must be greater than zero';
  END IF;

  IF p_from_store_id = p_to_store_id THEN
    RAISE EXCEPTION 'Source and destination branches must be different';
  END IF;

  IF NOT public.can_access_store(p_from_store_id) OR NOT public.can_access_store(p_to_store_id) THEN
    RAISE EXCEPTION 'Access denied for one or both branches';
  END IF;

  SELECT business_id INTO v_business_id FROM public.stores WHERE id = p_from_store_id;
  SELECT business_id INTO v_to_business_id FROM public.stores WHERE id = p_to_store_id;

  IF v_business_id IS NULL OR v_to_business_id IS NULL OR v_business_id <> v_to_business_id THEN
    RAISE EXCEPTION 'Both branches must belong to the same business';
  END IF;

  SELECT * INTO v_src
  FROM public.products
  WHERE id = p_product_id
    AND store_id = p_from_store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found at source branch';
  END IF;

  IF COALESCE(v_src.stock, 0) < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock at source branch (have %, need %)', v_src.stock, p_quantity;
  END IF;

  -- Prefer match by SKU within destination branch, else by exact name
  IF v_src.sku IS NOT NULL AND btrim(v_src.sku) <> '' THEN
    SELECT id INTO v_dest_id
    FROM public.products
    WHERE store_id = p_to_store_id
      AND lower(btrim(sku)) = lower(btrim(v_src.sku))
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_dest_id IS NULL THEN
    SELECT id INTO v_dest_id
    FROM public.products
    WHERE store_id = p_to_store_id
      AND lower(btrim(name)) = lower(btrim(v_src.name))
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_dest_id IS NULL THEN
    INSERT INTO public.products (
      name, description, price, category_id, image_url, business_mode, is_active,
      discount, sku, barcode, cost, stock, low_stock_threshold, unit, brand,
      store_id, product_type
    )
    VALUES (
      v_src.name, v_src.description, v_src.price, NULL, v_src.image_url,
      v_src.business_mode, true, COALESCE(v_src.discount, 0), v_src.sku, v_src.barcode,
      COALESCE(v_src.cost, 0), 0, COALESCE(v_src.low_stock_threshold, 5),
      COALESCE(v_src.unit, 'pcs'), v_src.brand, p_to_store_id,
      COALESCE(v_src.product_type, 'finished')
    )
    RETURNING id INTO v_dest_id;
  END IF;

  v_prev := COALESCE(v_src.stock, 0);
  v_new := v_prev - p_quantity;
  UPDATE public.products SET stock = v_new WHERE id = v_src.id;

  SELECT COALESCE(stock, 0) INTO v_dest_prev FROM public.products WHERE id = v_dest_id FOR UPDATE;
  v_dest_new := v_dest_prev + p_quantity;
  UPDATE public.products SET stock = v_dest_new WHERE id = v_dest_id;

  INSERT INTO public.stock_adjustments (
    product_id, type, quantity, previous_stock, new_stock, note, staff_id, store_id
  ) VALUES (
    v_src.id, 'adjustment', -p_quantity, v_prev, v_new,
    COALESCE(p_note, 'Transfer to another branch'), auth.uid(), p_from_store_id
  );

  INSERT INTO public.stock_adjustments (
    product_id, type, quantity, previous_stock, new_stock, note, staff_id, store_id
  ) VALUES (
    v_dest_id, 'restock', p_quantity, v_dest_prev, v_dest_new,
    COALESCE(p_note, 'Transfer from another branch'), auth.uid(), p_to_store_id
  );

  SELECT id, full_name INTO v_user_id, v_user_name
  FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.branch_stock_transfers (
    business_id, from_store_id, to_store_id, product_id, to_product_id,
    quantity, note, transferred_by, transferred_by_name
  ) VALUES (
    v_business_id, p_from_store_id, p_to_store_id, v_src.id, v_dest_id,
    p_quantity, p_note, v_user_id, v_user_name
  )
  RETURNING id INTO v_transfer_id;

  RETURN v_transfer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_stock_between_branches(UUID, UUID, UUID, NUMERIC, TEXT)
  TO authenticated;

-- Helper: branches available to current user for the active business
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.my_branch_stores() TO authenticated;
