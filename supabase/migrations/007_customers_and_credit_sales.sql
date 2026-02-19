-- ============================================================================
-- 007 – Customers table + Credit sales support
-- Adds a proper customers table with credit balance tracking,
-- and extends orders to support cash vs credit sale types.
-- ============================================================================

-- ─── Customers ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customers (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_mode    TEXT NOT NULL DEFAULT 'restaurant',

  -- Identity
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  email            TEXT,
  phone            TEXT,

  -- Address
  address          TEXT,
  city             TEXT,
  postal_code      TEXT,
  country          TEXT DEFAULT 'USA',

  -- Financial
  credit_balance   NUMERIC(12,2) NOT NULL DEFAULT 0,  -- running unpaid balance
  credit_limit     NUMERIC(12,2) NOT NULL DEFAULT 0,  -- 0 = no limit enforced
  total_spent      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_orders     INTEGER NOT NULL DEFAULT 0,

  -- Loyalty
  loyalty_points   INTEGER NOT NULL DEFAULT 0,

  -- Meta
  status           TEXT NOT NULL DEFAULT 'active',  -- 'active','inactive','vip','suspended'
  notes            TEXT,
  tags             TEXT[] DEFAULT '{}',

  -- Timestamps
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers are viewable by authenticated users."
  ON customers FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create customers."
  ON customers FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins and managers can update customers."
  ON customers FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'manager', 'cashier'));

CREATE POLICY "Admins can delete customers."
  ON customers FOR DELETE
  USING (public.get_my_role() = 'admin');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customers_business_mode ON customers(business_mode);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);


-- ─── Extend orders table ───────────────────────────────────────────────────

-- Sale type: 'cash' (paid immediately) or 'credit' (on customer account)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sale_type TEXT NOT NULL DEFAULT 'cash';
  -- 'cash' | 'credit'

-- Link to customer (for credit sales and tracking)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

-- Invoice number (separate from order_number for formal invoicing)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number TEXT UNIQUE;

-- Due date for credit sales
ALTER TABLE orders ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;

-- Index
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_sale_type ON orders(sale_type);
CREATE INDEX IF NOT EXISTS idx_orders_invoice_number ON orders(invoice_number);


-- ─── Invoice number sequence ───────────────────────────────────────────────
-- Format: INV-2026-0001

CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  yr TEXT;
  seq_val BIGINT;
BEGIN
  yr := to_char(now(), 'YYYY');
  seq_val := nextval('invoice_number_seq');
  RETURN 'INV-' || yr || '-' || lpad(seq_val::text, 4, '0');
END;
$$;


-- ─── Update customer balance on credit sale ────────────────────────────────

CREATE OR REPLACE FUNCTION update_customer_balance_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only process credit sales with a linked customer
  IF NEW.sale_type = 'credit' AND NEW.customer_id IS NOT NULL THEN
    -- On INSERT: increase the customer's credit balance
    IF TG_OP = 'INSERT' THEN
      UPDATE customers
      SET credit_balance = credit_balance + NEW.total,
          total_spent = total_spent + NEW.total,
          total_orders = total_orders + 1,
          updated_at = now()
      WHERE id = NEW.customer_id;
    END IF;

    -- On UPDATE: if payment_status changed to 'paid', decrease balance
    IF TG_OP = 'UPDATE' AND OLD.payment_status != 'paid' AND NEW.payment_status = 'paid' THEN
      UPDATE customers
      SET credit_balance = GREATEST(credit_balance - NEW.total, 0),
          updated_at = now()
      WHERE id = NEW.customer_id;
    END IF;

    -- On UPDATE: if voided, reverse the balance
    IF TG_OP = 'UPDATE' AND OLD.status != 'voided' AND NEW.status = 'voided' THEN
      UPDATE customers
      SET credit_balance = GREATEST(credit_balance - NEW.total, 0),
          total_spent = GREATEST(total_spent - NEW.total, 0),
          total_orders = GREATEST(total_orders - 1, 0),
          updated_at = now()
      WHERE id = NEW.customer_id;
    END IF;
  END IF;

  -- For cash sales, still update total_spent and total_orders
  IF NEW.sale_type = 'cash' AND NEW.customer_id IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE customers
      SET total_spent = total_spent + NEW.total,
          total_orders = total_orders + 1,
          updated_at = now()
      WHERE id = NEW.customer_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_customer_balance
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_customer_balance_on_order();


-- ─── Record payment against customer balance ──────────────────────────────
-- When a payment is made against a credit order, reduce customer balance

CREATE OR REPLACE FUNCTION update_customer_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT sale_type, customer_id INTO v_order
  FROM orders WHERE id = NEW.order_id;

  IF v_order.sale_type = 'credit' AND v_order.customer_id IS NOT NULL THEN
    -- Reduce customer balance by payment amount
    UPDATE customers
    SET credit_balance = GREATEST(credit_balance - NEW.amount, 0),
        updated_at = now()
    WHERE id = v_order.customer_id;

    -- Check if order is fully paid now
    DECLARE
      total_paid NUMERIC;
      order_total NUMERIC;
    BEGIN
      SELECT COALESCE(SUM(amount), 0) INTO total_paid
      FROM payments WHERE order_id = NEW.order_id;

      SELECT total INTO order_total FROM orders WHERE id = NEW.order_id;

      IF total_paid >= order_total THEN
        UPDATE orders SET payment_status = 'paid' WHERE id = NEW.order_id;
      ELSIF total_paid > 0 THEN
        UPDATE orders SET payment_status = 'partial' WHERE id = NEW.order_id;
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_customer_balance
  AFTER INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION update_customer_on_payment();


-- ─── Seed demo customers ──────────────────────────────────────────────────

INSERT INTO customers (first_name, last_name, email, phone, address, city, postal_code, country, credit_balance, credit_limit, total_spent, total_orders, loyalty_points, status, notes, tags, business_mode) VALUES
  ('John', 'Doe', 'john.doe@example.com', '+1 (555) 123-4567', '123 Main Street', 'New York', '10001', 'USA', 0, 5000, 3420.50, 28, 1250, 'vip', 'Prefers window seating. Regular customer.', ARRAY['regular', 'vip', 'preferred'], 'restaurant'),
  ('Jane', 'Smith', 'jane.smith@example.com', '+1 (555) 234-5678', '456 Oak Avenue', 'Los Angeles', '90001', 'USA', 250.00, 2000, 1890.25, 15, 850, 'active', 'Vegetarian. Orders frequently for delivery.', ARRAY['vegetarian', 'delivery'], 'restaurant'),
  ('Michael', 'Johnson', 'michael.j@example.com', '+1 (555) 345-6789', '789 Pine Road', 'Chicago', '60601', 'USA', 0, 1000, 980.75, 12, 420, 'active', NULL, ARRAY['regular'], 'restaurant'),
  ('Sarah', 'Williams', 'sarah.w@example.com', '+1 (555) 456-7890', '321 Elm Street', 'Houston', '77001', 'USA', 150.75, 3000, 5420.00, 45, 2100, 'vip', 'VIP member. Prefers table 12. Wine enthusiast.', ARRAY['vip', 'wine', 'preferred'], 'restaurant'),
  ('David', 'Brown', 'david.brown@example.com', '+1 (555) 567-8901', '654 Maple Drive', 'Phoenix', '85001', 'USA', 0, 0, 450.00, 6, 180, 'active', NULL, ARRAY[]::text[], 'restaurant'),
  -- Retail customers
  ('Acme Corp', 'Ltd', 'procurement@acmecorp.com', '+1 (555) 111-2222', '100 Business Blvd', 'San Francisco', '94101', 'USA', 1250.00, 10000, 15800.00, 42, 0, 'vip', 'Regular bulk orders. Net-30 terms.', ARRAY['corporate', 'bulk', 'net-30'], 'retail'),
  ('Maria', 'Garcia', 'maria.g@example.com', '+1 (555) 333-4444', '52 Central Ave', 'Miami', '33101', 'USA', 0, 500, 890.50, 8, 200, 'active', NULL, ARRAY['regular'], 'retail'),
  ('Tech Solutions', 'Inc', 'orders@techsolutions.com', '+1 (555) 555-6666', '200 Innovation Dr', 'Austin', '78701', 'USA', 3200.00, 15000, 28500.75, 65, 0, 'vip', 'IT supplies. Weekly orders.', ARRAY['corporate', 'weekly', 'net-15'], 'retail'),
  ('Robert', 'Chen', 'robert.chen@example.com', '+1 (555) 777-8888', '88 Harbor St', 'Seattle', '98101', 'USA', 75.25, 1000, 2100.00, 15, 350, 'active', NULL, ARRAY['regular'], 'retail'),
  ('Emily', 'Davis', 'emily.davis@example.com', '+1 (555) 999-0000', '987 Cedar Lane', 'Philadelphia', '19101', 'USA', 0, 0, 0, 0, 0, 'inactive', 'Registered but no orders yet.', ARRAY['new'], 'retail')
ON CONFLICT DO NOTHING;
