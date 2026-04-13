-- ============================================================================
-- 019 - Multi-store foundation (backfill-safe)
-- Adds store entities, maps users to stores, and scopes existing business data
-- to a default store without losing any rows.
-- ============================================================================

-- ─── Stores ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.stores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'inactive')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS stores_updated_at ON public.stores;
CREATE TRIGGER stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read stores" ON public.stores;
CREATE POLICY "Authenticated users can read stores"
  ON public.stores FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage stores" ON public.stores;
CREATE POLICY "Admins can manage stores"
  ON public.stores FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');


-- ─── User ↔ store membership ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profile_stores (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id         UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  role_in_store    TEXT NOT NULL DEFAULT 'cashier'
                   CHECK (role_in_store IN ('admin', 'manager', 'cashier')),
  is_default_store BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, store_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_stores_default_per_profile
  ON public.profile_stores(profile_id)
  WHERE is_default_store;

CREATE INDEX IF NOT EXISTS idx_profile_stores_store_id
  ON public.profile_stores(store_id);

ALTER TABLE public.profile_stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own store memberships" ON public.profile_stores;
CREATE POLICY "Users can read own store memberships"
  ON public.profile_stores FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid() OR public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "Admins can manage store memberships" ON public.profile_stores;
CREATE POLICY "Admins can manage store memberships"
  ON public.profile_stores FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');


-- ─── Helper function used by RLS and app logic ──────────────────────────────

CREATE OR REPLACE FUNCTION public.user_can_access_store(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profile_stores ps
    WHERE ps.profile_id = auth.uid()
      AND ps.store_id = p_store_id
  );
$$;


-- ─── Create default store and backfill existing users ───────────────────────

INSERT INTO public.stores (code, name)
VALUES ('main', 'Main Store')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.profile_stores (profile_id, store_id, role_in_store, is_default_store)
SELECT
  p.id,
  s.id,
  p.role,
  true
FROM public.profiles p
CROSS JOIN public.stores s
WHERE s.code = 'main'
ON CONFLICT (profile_id, store_id) DO NOTHING;


-- ─── Add store_id to existing tables (nullable first) ───────────────────────

ALTER TABLE public.categories                ADD COLUMN IF NOT EXISTS store_id UUID;
ALTER TABLE public.products                  ADD COLUMN IF NOT EXISTS store_id UUID;
ALTER TABLE public.product_variants          ADD COLUMN IF NOT EXISTS store_id UUID;
ALTER TABLE public.stock_adjustments         ADD COLUMN IF NOT EXISTS store_id UUID;
ALTER TABLE public.suppliers                 ADD COLUMN IF NOT EXISTS store_id UUID;
ALTER TABLE public.purchases                 ADD COLUMN IF NOT EXISTS store_id UUID;
ALTER TABLE public.purchase_items            ADD COLUMN IF NOT EXISTS store_id UUID;
ALTER TABLE public.customers                 ADD COLUMN IF NOT EXISTS store_id UUID;
ALTER TABLE public.orders                    ADD COLUMN IF NOT EXISTS store_id UUID;
ALTER TABLE public.order_items               ADD COLUMN IF NOT EXISTS store_id UUID;
ALTER TABLE public.payments                  ADD COLUMN IF NOT EXISTS store_id UUID;
ALTER TABLE public.customer_account_payments ADD COLUMN IF NOT EXISTS store_id UUID;


-- ─── Backfill store_id with default store for existing rows ─────────────────

WITH default_store AS (
  SELECT id FROM public.stores WHERE code = 'main' LIMIT 1
)
UPDATE public.categories c
SET store_id = ds.id
FROM default_store ds
WHERE c.store_id IS NULL;

WITH default_store AS (
  SELECT id FROM public.stores WHERE code = 'main' LIMIT 1
)
UPDATE public.products p
SET store_id = ds.id
FROM default_store ds
WHERE p.store_id IS NULL;

UPDATE public.product_variants pv
SET store_id = p.store_id
FROM public.products p
WHERE pv.product_id = p.id
  AND pv.store_id IS NULL;

UPDATE public.stock_adjustments sa
SET store_id = p.store_id
FROM public.products p
WHERE sa.product_id = p.id
  AND sa.store_id IS NULL;

WITH default_store AS (
  SELECT id FROM public.stores WHERE code = 'main' LIMIT 1
)
UPDATE public.suppliers s
SET store_id = ds.id
FROM default_store ds
WHERE s.store_id IS NULL;

WITH default_store AS (
  SELECT id FROM public.stores WHERE code = 'main' LIMIT 1
)
UPDATE public.customers c
SET store_id = ds.id
FROM default_store ds
WHERE c.store_id IS NULL;

WITH default_store AS (
  SELECT id FROM public.stores WHERE code = 'main' LIMIT 1
)
UPDATE public.purchases p
SET store_id = ds.id
FROM default_store ds
WHERE p.store_id IS NULL;

UPDATE public.purchase_items pi
SET store_id = p.store_id
FROM public.purchases p
WHERE pi.purchase_id = p.id
  AND pi.store_id IS NULL;

WITH default_store AS (
  SELECT id FROM public.stores WHERE code = 'main' LIMIT 1
)
UPDATE public.orders o
SET store_id = ds.id
FROM default_store ds
WHERE o.store_id IS NULL;

UPDATE public.order_items oi
SET store_id = o.store_id
FROM public.orders o
WHERE oi.order_id = o.id
  AND oi.store_id IS NULL;

UPDATE public.payments py
SET store_id = o.store_id
FROM public.orders o
WHERE py.order_id = o.id
  AND py.store_id IS NULL;

UPDATE public.customer_account_payments cap
SET store_id = c.store_id
FROM public.customers c
WHERE cap.customer_id = c.id
  AND cap.store_id IS NULL;


-- ─── Enforce FK + not-null after backfill ───────────────────────────────────

ALTER TABLE public.categories
  ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE public.products
  ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE public.product_variants
  ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE public.stock_adjustments
  ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE public.suppliers
  ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE public.purchases
  ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE public.purchase_items
  ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE public.customers
  ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE public.orders
  ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE public.order_items
  ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE public.payments
  ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE public.customer_account_payments
  ALTER COLUMN store_id SET NOT NULL;

ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_store_id_fkey,
  ADD CONSTRAINT categories_store_id_fkey
    FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE RESTRICT;
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_store_id_fkey,
  ADD CONSTRAINT products_store_id_fkey
    FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE RESTRICT;
ALTER TABLE public.product_variants
  DROP CONSTRAINT IF EXISTS product_variants_store_id_fkey,
  ADD CONSTRAINT product_variants_store_id_fkey
    FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE RESTRICT;
ALTER TABLE public.stock_adjustments
  DROP CONSTRAINT IF EXISTS stock_adjustments_store_id_fkey,
  ADD CONSTRAINT stock_adjustments_store_id_fkey
    FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE RESTRICT;
ALTER TABLE public.suppliers
  DROP CONSTRAINT IF EXISTS suppliers_store_id_fkey,
  ADD CONSTRAINT suppliers_store_id_fkey
    FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE RESTRICT;
ALTER TABLE public.purchases
  DROP CONSTRAINT IF EXISTS purchases_store_id_fkey,
  ADD CONSTRAINT purchases_store_id_fkey
    FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE RESTRICT;
ALTER TABLE public.purchase_items
  DROP CONSTRAINT IF EXISTS purchase_items_store_id_fkey,
  ADD CONSTRAINT purchase_items_store_id_fkey
    FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE RESTRICT;
ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_store_id_fkey,
  ADD CONSTRAINT customers_store_id_fkey
    FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE RESTRICT;
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_store_id_fkey,
  ADD CONSTRAINT orders_store_id_fkey
    FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE RESTRICT;
ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_store_id_fkey,
  ADD CONSTRAINT order_items_store_id_fkey
    FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE RESTRICT;
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_store_id_fkey,
  ADD CONSTRAINT payments_store_id_fkey
    FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE RESTRICT;
ALTER TABLE public.customer_account_payments
  DROP CONSTRAINT IF EXISTS customer_account_payments_store_id_fkey,
  ADD CONSTRAINT customer_account_payments_store_id_fkey
    FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE RESTRICT;


-- ─── Scoped uniqueness (per store) ───────────────────────────────────────────
-- Drop global uniqueness and replace with per-store unique constraints.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_number_key;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_store_id_order_number_key UNIQUE (store_id, order_number);

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_invoice_number_key;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_store_id_invoice_number_key UNIQUE (store_id, invoice_number);

ALTER TABLE public.purchases DROP CONSTRAINT IF EXISTS purchases_purchase_number_key;
ALTER TABLE public.purchases
  ADD CONSTRAINT purchases_store_id_purchase_number_key UNIQUE (store_id, purchase_number);


-- ─── Performance indexes ─────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_categories_store_id ON public.categories(store_id);
CREATE INDEX IF NOT EXISTS idx_products_store_id ON public.products(store_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_store_id ON public.product_variants(store_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_store_id ON public.stock_adjustments(store_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_store_id ON public.suppliers(store_id);
CREATE INDEX IF NOT EXISTS idx_purchases_store_id ON public.purchases(store_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_store_id ON public.purchase_items(store_id);
CREATE INDEX IF NOT EXISTS idx_customers_store_id ON public.customers(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON public.orders(store_id);
CREATE INDEX IF NOT EXISTS idx_order_items_store_id ON public.order_items(store_id);
CREATE INDEX IF NOT EXISTS idx_payments_store_id ON public.payments(store_id);
CREATE INDEX IF NOT EXISTS idx_customer_account_payments_store_id
  ON public.customer_account_payments(store_id);
