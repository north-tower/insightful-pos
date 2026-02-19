-- ============================================================================
-- 005 – Orders, order items & payments
-- Works for BOTH restaurant and retail business modes.
-- ============================================================================

-- ─── Orders ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number    TEXT NOT NULL UNIQUE,           -- e.g. "F0051" or "R0023"
  business_mode   TEXT NOT NULL DEFAULT 'restaurant',  -- 'restaurant' | 'retail'

  -- Type / source
  order_type      TEXT NOT NULL DEFAULT 'dine-in', -- 'dine-in','takeaway','delivery','pos'
  source          TEXT NOT NULL DEFAULT 'pos',     -- 'pos','qr','kiosk','web'

  -- Customer info (optional)
  customer_name   TEXT,
  customer_email  TEXT,
  customer_phone  TEXT,
  table_number    TEXT,                            -- restaurant only

  -- Financials
  subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_rate        NUMERIC(5,4) NOT NULL DEFAULT 0.05,
  tax_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Status
  status          TEXT NOT NULL DEFAULT 'pending',
    -- 'pending','preparing','ready','completed','cancelled','voided'
  payment_status  TEXT NOT NULL DEFAULT 'unpaid',
    -- 'unpaid','partial','paid','refunded','voided'

  -- Notes
  notes           TEXT,

  -- Staff
  staff_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  staff_name      TEXT,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Orders are viewable by authenticated users."
  ON orders FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "POS staff can create orders."
  ON orders FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins and managers can update orders."
  ON orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND (role = 'admin' OR role = 'manager' OR id = orders.staff_id)
    )
  );

CREATE POLICY "Admins can delete orders."
  ON orders FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );


-- ─── Order Items (line items) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS order_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,

  -- Snapshot at time of sale (prices may change later)
  product_name    TEXT NOT NULL,
  product_image   TEXT,
  unit_price      NUMERIC(10,2) NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  line_total      NUMERIC(10,2) NOT NULL,    -- unit_price * quantity + modifier totals
  discount        NUMERIC(10,2) DEFAULT 0,

  -- Modifiers / customisation  (stored as JSON)
  modifiers       JSONB DEFAULT '[]'::jsonb,
  notes           TEXT,

  -- Retail-specific snapshot
  sku             TEXT,
  barcode         TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order items follow parent order visibility."
  ON order_items FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id)
  );

CREATE POLICY "Authenticated users can create order items."
  ON order_items FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins and managers can update order items."
  ON order_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'manager')
    )
  );

CREATE POLICY "Admins can delete order items."
  ON order_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );


-- ─── Payments ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method          TEXT NOT NULL DEFAULT 'cash',  -- 'cash','card','qr'
  amount          NUMERIC(10,2) NOT NULL,
  reference       TEXT,                          -- transaction ref / receipt #
  paid_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Payments follow parent order visibility."
  ON payments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = payments.order_id)
  );

CREATE POLICY "Authenticated users can create payments."
  ON payments FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');


-- ─── Sequence helper for order numbers ──────────────────────────────────────
-- Restaurant orders: F0001, F0002, …
-- Retail orders:     R0001, R0002, …

CREATE SEQUENCE IF NOT EXISTS restaurant_order_seq START 51;
CREATE SEQUENCE IF NOT EXISTS retail_order_seq     START 1;

-- Convenience function used by the app (or can be called via RPC).
CREATE OR REPLACE FUNCTION generate_order_number(p_business_mode TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_business_mode = 'retail' THEN
    RETURN 'R' || lpad(nextval('retail_order_seq')::text, 4, '0');
  ELSE
    RETURN 'F' || lpad(nextval('restaurant_order_seq')::text, 4, '0');
  END IF;
END;
$$;


-- ─── Stock deduction trigger (retail sales) ─────────────────────────────────
-- Automatically reduces product stock when an order_item is inserted.

CREATE OR REPLACE FUNCTION deduct_stock_on_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only deduct for retail products that have stock tracking
  IF NEW.product_id IS NOT NULL THEN
    UPDATE products
       SET stock = GREATEST(stock - NEW.quantity, 0),
           updated_at = now()
     WHERE id = NEW.product_id
       AND business_mode = 'retail';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_deduct_stock
  AFTER INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION deduct_stock_on_sale();


-- ─── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_orders_business_mode   ON orders(business_mode);
CREATE INDEX IF NOT EXISTS idx_orders_status          ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at      ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_staff_id        ON orders(staff_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id      ON payments(order_id);
