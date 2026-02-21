-- ============================================================================
-- 010 – Suppliers & Purchase Orders
-- Tracks where products come from and automatically updates stock
-- when a purchase is received.
-- ============================================================================

-- ─── Suppliers ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.suppliers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_mode    TEXT NOT NULL DEFAULT 'retail'
                   CHECK (business_mode IN ('restaurant', 'retail')),

  -- Identity
  name             TEXT NOT NULL,
  contact_person   TEXT,
  email            TEXT,
  phone            TEXT,
  address          TEXT,
  city             TEXT,
  country          TEXT DEFAULT 'USA',

  -- Meta
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'inactive')),
  notes            TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_business_mode ON public.suppliers(business_mode);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON public.suppliers(status);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers(name);

-- RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read suppliers"
  ON public.suppliers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin/Manager can insert suppliers"
  ON public.suppliers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin/Manager can update suppliers"
  ON public.suppliers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin can delete suppliers"
  ON public.suppliers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );


-- ─── Purchases (header) ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.purchases (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_mode    TEXT NOT NULL DEFAULT 'retail'
                   CHECK (business_mode IN ('restaurant', 'retail')),

  -- Reference
  purchase_number  TEXT NOT NULL UNIQUE,          -- PO-2026-0001
  supplier_id      UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,

  -- Status: draft → received → cancelled
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'received', 'cancelled')),

  -- Financials
  subtotal         NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  total            NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Notes / reference
  notes            TEXT,
  reference        TEXT,                          -- supplier invoice # etc.

  -- Staff
  staff_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  staff_name       TEXT,

  -- Dates
  order_date       TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_date    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER purchases_updated_at
  BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_purchases_business_mode ON public.purchases(business_mode);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON public.purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON public.purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON public.purchases(created_at DESC);

-- RLS
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read purchases"
  ON public.purchases FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin/Manager can insert purchases"
  ON public.purchases FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin/Manager can update purchases"
  ON public.purchases FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin can delete purchases"
  ON public.purchases FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );


-- ─── Purchase Items (line items) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.purchase_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id      UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id       UUID REFERENCES public.products(id) ON DELETE SET NULL,

  -- Snapshot
  product_name     TEXT NOT NULL,
  product_sku      TEXT,
  quantity         INTEGER NOT NULL DEFAULT 1,
  unit_cost        NUMERIC(10,2) NOT NULL DEFAULT 0,
  line_total       NUMERIC(12,2) NOT NULL DEFAULT 0,   -- quantity * unit_cost

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON public.purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON public.purchase_items(product_id);

-- RLS
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Purchase items follow parent purchase visibility"
  ON public.purchase_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.purchases WHERE id = purchase_items.purchase_id)
  );

CREATE POLICY "Admin/Manager can insert purchase items"
  ON public.purchase_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin/Manager can update purchase items"
  ON public.purchase_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin/Manager can delete purchase items"
  ON public.purchase_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );


-- ─── Purchase number sequence ───────────────────────────────────────────────
-- Format: PO-2026-0001

CREATE SEQUENCE IF NOT EXISTS purchase_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_purchase_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  yr TEXT;
  seq_val BIGINT;
BEGIN
  yr := to_char(now(), 'YYYY');
  seq_val := nextval('purchase_number_seq');
  RETURN 'PO-' || yr || '-' || lpad(seq_val::text, 4, '0');
END;
$$;


-- ─── Auto-update stock when purchase is received ────────────────────────────
-- When a purchase status changes to 'received', increase product stock
-- for every line item and log stock adjustments.

CREATE OR REPLACE FUNCTION update_stock_on_purchase_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item RECORD;
  prev_stock INT;
BEGIN
  -- Only fire when status transitions TO 'received'
  IF NEW.status = 'received' AND (OLD.status IS DISTINCT FROM 'received') THEN
    FOR item IN
      SELECT product_id, product_name, quantity
      FROM public.purchase_items
      WHERE purchase_id = NEW.id
        AND product_id IS NOT NULL
    LOOP
      -- Get current stock
      SELECT stock INTO prev_stock
      FROM public.products
      WHERE id = item.product_id;

      -- Increase stock
      UPDATE public.products
      SET stock = COALESCE(stock, 0) + item.quantity,
          updated_at = now()
      WHERE id = item.product_id;

      -- Log the stock adjustment
      INSERT INTO public.stock_adjustments
        (product_id, type, quantity, previous_stock, new_stock, note, staff_id)
      VALUES
        (item.product_id, 'restock', item.quantity,
         COALESCE(prev_stock, 0),
         COALESCE(prev_stock, 0) + item.quantity,
         'Purchase ' || NEW.purchase_number,
         NEW.staff_id);
    END LOOP;

    -- Set received_date
    NEW.received_date := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_purchase_stock_update
  BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION update_stock_on_purchase_received();
