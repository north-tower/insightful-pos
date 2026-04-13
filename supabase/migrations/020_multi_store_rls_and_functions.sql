-- ============================================================================
-- 020 - Multi-store RLS hardening + store-safe business functions
-- Enforces store isolation in policies and prevents cross-store side effects
-- in triggers/functions.
-- ============================================================================

-- ─── Store-scoped read helper ────────────────────────────────────────────────
-- Uses authenticated user's memberships established in profile_stores.

CREATE OR REPLACE FUNCTION public.can_access_store(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.user_can_access_store(p_store_id);
$$;


-- ─── Categories policies ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can read categories" ON public.categories;
DROP POLICY IF EXISTS "Admin/Manager can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Admin/Manager can update categories" ON public.categories;
DROP POLICY IF EXISTS "Admin/Manager can delete categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can create categories." ON public.categories;
DROP POLICY IF EXISTS "Admins and managers can update categories." ON public.categories;
DROP POLICY IF EXISTS "Admins and managers can delete categories." ON public.categories;

CREATE POLICY "Store members can read categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (public.can_access_store(store_id));

CREATE POLICY "Admin manager can insert categories in own store"
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin manager can update categories in own store"
  ON public.categories FOR UPDATE
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin manager can delete categories in own store"
  ON public.categories FOR DELETE
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );


-- ─── Products policies ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can read products" ON public.products;
DROP POLICY IF EXISTS "Admin/Manager can insert products" ON public.products;
DROP POLICY IF EXISTS "Admin/Manager can update products" ON public.products;
DROP POLICY IF EXISTS "Admin/Manager can delete products" ON public.products;
DROP POLICY IF EXISTS "Admins and managers can create products." ON public.products;
DROP POLICY IF EXISTS "Admins and managers can update products." ON public.products;
DROP POLICY IF EXISTS "Admins and managers can delete products." ON public.products;

CREATE POLICY "Store members can read products"
  ON public.products FOR SELECT
  TO authenticated
  USING (public.can_access_store(store_id));

CREATE POLICY "Admin manager can insert products in own store"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin manager can update products in own store"
  ON public.products FOR UPDATE
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin manager can delete products in own store"
  ON public.products FOR DELETE
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );


-- ─── Product variants policies ───────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can read variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admin/Manager can insert variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admin/Manager can update variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admin/Manager can delete variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admins and managers can create product variants." ON public.product_variants;
DROP POLICY IF EXISTS "Admins and managers can update product variants." ON public.product_variants;
DROP POLICY IF EXISTS "Admins and managers can delete product variants." ON public.product_variants;

CREATE POLICY "Store members can read variants"
  ON public.product_variants FOR SELECT
  TO authenticated
  USING (public.can_access_store(store_id));

CREATE POLICY "Admin manager can insert variants in own store"
  ON public.product_variants FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin manager can update variants in own store"
  ON public.product_variants FOR UPDATE
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin manager can delete variants in own store"
  ON public.product_variants FOR DELETE
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );


-- ─── Stock adjustments policies ──────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can read stock adjustments" ON public.stock_adjustments;
DROP POLICY IF EXISTS "Admin/Manager can insert stock adjustments" ON public.stock_adjustments;
DROP POLICY IF EXISTS "Stock adjustments are viewable by admins and managers." ON public.stock_adjustments;
DROP POLICY IF EXISTS "Stock adjustments can be created by admins and managers." ON public.stock_adjustments;

CREATE POLICY "Store members can read stock adjustments"
  ON public.stock_adjustments FOR SELECT
  TO authenticated
  USING (public.can_access_store(store_id));

CREATE POLICY "Admin manager can insert stock adjustments in own store"
  ON public.stock_adjustments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );


-- ─── Suppliers policies ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can read suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admin/Manager can insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admin/Manager can update suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admin can delete suppliers" ON public.suppliers;

CREATE POLICY "Store members can read suppliers"
  ON public.suppliers FOR SELECT
  TO authenticated
  USING (public.can_access_store(store_id));

CREATE POLICY "Admin manager can insert suppliers in own store"
  ON public.suppliers FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin manager can update suppliers in own store"
  ON public.suppliers FOR UPDATE
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin can delete suppliers in own store"
  ON public.suppliers FOR DELETE
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND public.get_my_role() = 'admin'
  );


-- ─── Purchases and purchase items policies ──────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can read purchases" ON public.purchases;
DROP POLICY IF EXISTS "Admin/Manager can insert purchases" ON public.purchases;
DROP POLICY IF EXISTS "Admin/Manager can update purchases" ON public.purchases;
DROP POLICY IF EXISTS "Admin can delete purchases" ON public.purchases;

CREATE POLICY "Store members can read purchases"
  ON public.purchases FOR SELECT
  TO authenticated
  USING (public.can_access_store(store_id));

CREATE POLICY "Admin manager can insert purchases in own store"
  ON public.purchases FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin manager can update purchases in own store"
  ON public.purchases FOR UPDATE
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin can delete purchases in own store"
  ON public.purchases FOR DELETE
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND public.get_my_role() = 'admin'
  );

DROP POLICY IF EXISTS "Purchase items follow parent purchase visibility" ON public.purchase_items;
DROP POLICY IF EXISTS "Admin/Manager can insert purchase items" ON public.purchase_items;
DROP POLICY IF EXISTS "Admin/Manager can update purchase items" ON public.purchase_items;
DROP POLICY IF EXISTS "Admin/Manager can delete purchase items" ON public.purchase_items;

CREATE POLICY "Store members can read purchase items"
  ON public.purchase_items FOR SELECT
  TO authenticated
  USING (public.can_access_store(store_id));

CREATE POLICY "Admin manager can insert purchase items in own store"
  ON public.purchase_items FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin manager can update purchase items in own store"
  ON public.purchase_items FOR UPDATE
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin manager can delete purchase items in own store"
  ON public.purchase_items FOR DELETE
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );


-- ─── Customers policies ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Customers are viewable by authenticated users." ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can create customers." ON public.customers;
DROP POLICY IF EXISTS "Admins and managers can update customers." ON public.customers;
DROP POLICY IF EXISTS "Admins can delete customers." ON public.customers;

CREATE POLICY "Store members can read customers"
  ON public.customers FOR SELECT
  TO authenticated
  USING (public.can_access_store(store_id));

CREATE POLICY "Store members can create customers"
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_store(store_id));

CREATE POLICY "Store staff can update customers"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager', 'cashier')
  )
  WITH CHECK (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager', 'cashier')
  );

CREATE POLICY "Store admin can delete customers"
  ON public.customers FOR DELETE
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND public.get_my_role() = 'admin'
  );


-- ─── Orders, order_items, payments policies ─────────────────────────────────

DROP POLICY IF EXISTS "Orders are viewable by authenticated users." ON public.orders;
DROP POLICY IF EXISTS "POS staff can create orders." ON public.orders;
DROP POLICY IF EXISTS "Admins and managers can update orders." ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders." ON public.orders;

CREATE POLICY "Store members can read orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (public.can_access_store(store_id));

CREATE POLICY "Store members can create orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_access_store(store_id)
    AND (staff_id IS NULL OR staff_id = auth.uid() OR public.get_my_role() IN ('admin', 'manager'))
  );

CREATE POLICY "Store staff can update own orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND (
      public.get_my_role() IN ('admin', 'manager')
      OR staff_id = auth.uid()
    )
  )
  WITH CHECK (
    public.can_access_store(store_id)
    AND (
      public.get_my_role() IN ('admin', 'manager')
      OR staff_id = auth.uid()
    )
  );

CREATE POLICY "Store admin can delete orders"
  ON public.orders FOR DELETE
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND public.get_my_role() = 'admin'
  );

DROP POLICY IF EXISTS "Order items follow parent order visibility." ON public.order_items;
DROP POLICY IF EXISTS "Authenticated users can create order items." ON public.order_items;
DROP POLICY IF EXISTS "Admins and managers can update order items." ON public.order_items;
DROP POLICY IF EXISTS "Admins can delete order items." ON public.order_items;

CREATE POLICY "Store members can read order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (public.can_access_store(store_id));

CREATE POLICY "Store members can create order items"
  ON public.order_items FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_store(store_id));

CREATE POLICY "Store managers can update order items"
  ON public.order_items FOR UPDATE
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Store admin can delete order items"
  ON public.order_items FOR DELETE
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND public.get_my_role() = 'admin'
  );

DROP POLICY IF EXISTS "Payments follow parent order visibility." ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can create payments." ON public.payments;

CREATE POLICY "Store members can read payments"
  ON public.payments FOR SELECT
  TO authenticated
  USING (public.can_access_store(store_id));

CREATE POLICY "Store members can create payments"
  ON public.payments FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_store(store_id));


-- ─── Customer account payments policies ─────────────────────────────────────

DROP POLICY IF EXISTS "Customer account payments are viewable by authenticated users." ON public.customer_account_payments;
DROP POLICY IF EXISTS "Authenticated users can create customer account payments." ON public.customer_account_payments;
DROP POLICY IF EXISTS "Admins and managers can update customer account payments." ON public.customer_account_payments;
DROP POLICY IF EXISTS "Admins can delete customer account payments." ON public.customer_account_payments;

CREATE POLICY "Store members can read customer account payments"
  ON public.customer_account_payments FOR SELECT
  TO authenticated
  USING (public.can_access_store(store_id));

CREATE POLICY "Store members can create customer account payments"
  ON public.customer_account_payments FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_store(store_id));

CREATE POLICY "Store staff can update customer account payments"
  ON public.customer_account_payments FOR UPDATE
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager', 'cashier')
  )
  WITH CHECK (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager', 'cashier')
  );

CREATE POLICY "Store admin can delete customer account payments"
  ON public.customer_account_payments FOR DELETE
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND public.get_my_role() = 'admin'
  );


-- ─── Store-safe stock trigger functions ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.deduct_stock_on_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE public.products
       SET stock = GREATEST(stock - NEW.quantity, 0),
           updated_at = now()
     WHERE id = NEW.product_id
       AND business_mode = 'retail'
       AND store_id = NEW.store_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_stock_on_purchase_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  item RECORD;
  prev_stock INT;
BEGIN
  IF NEW.status = 'received' AND (OLD.status IS DISTINCT FROM 'received') THEN
    FOR item IN
      SELECT product_id, product_name, quantity, store_id
      FROM public.purchase_items
      WHERE purchase_id = NEW.id
        AND product_id IS NOT NULL
        AND store_id = NEW.store_id
    LOOP
      SELECT stock INTO prev_stock
      FROM public.products
      WHERE id = item.product_id
        AND store_id = NEW.store_id;

      UPDATE public.products
      SET stock = COALESCE(stock, 0) + item.quantity,
          updated_at = now()
      WHERE id = item.product_id
        AND store_id = NEW.store_id;

      INSERT INTO public.stock_adjustments
        (product_id, store_id, type, quantity, previous_stock, new_stock, note, staff_id)
      VALUES
        (item.product_id, NEW.store_id, 'restock', item.quantity,
         COALESCE(prev_stock, 0),
         COALESCE(prev_stock, 0) + item.quantity,
         'Purchase ' || NEW.purchase_number,
         NEW.staff_id);
    END LOOP;

    NEW.received_date := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_stock_on_purchase_item_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_purchase RECORD;
  prev_stock INT;
BEGIN
  SELECT status, purchase_number, staff_id, store_id
  INTO v_purchase
  FROM public.purchases
  WHERE id = NEW.purchase_id;

  IF v_purchase.status = 'received'
     AND NEW.product_id IS NOT NULL
     AND NEW.store_id = v_purchase.store_id THEN
    SELECT COALESCE(stock, 0) INTO prev_stock
    FROM public.products
    WHERE id = NEW.product_id
      AND store_id = NEW.store_id;

    UPDATE public.products
    SET stock = prev_stock + NEW.quantity,
        updated_at = now()
    WHERE id = NEW.product_id
      AND store_id = NEW.store_id;

    INSERT INTO public.stock_adjustments
      (product_id, store_id, type, quantity, previous_stock, new_stock, note, staff_id)
    VALUES
      (NEW.product_id, NEW.store_id, 'restock', NEW.quantity,
       prev_stock, prev_stock + NEW.quantity,
       'Purchase ' || v_purchase.purchase_number || ' (edit)',
       v_purchase.staff_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_stock_on_purchase_item_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_purchase RECORD;
  prev_stock INT;
BEGIN
  SELECT status, purchase_number, staff_id, store_id
  INTO v_purchase
  FROM public.purchases
  WHERE id = OLD.purchase_id;

  IF v_purchase.status = 'received'
     AND OLD.product_id IS NOT NULL
     AND OLD.store_id = v_purchase.store_id THEN
    SELECT COALESCE(stock, 0) INTO prev_stock
    FROM public.products
    WHERE id = OLD.product_id
      AND store_id = OLD.store_id;

    UPDATE public.products
    SET stock = GREATEST(prev_stock - OLD.quantity, 0),
        updated_at = now()
    WHERE id = OLD.product_id
      AND store_id = OLD.store_id;

    INSERT INTO public.stock_adjustments
      (product_id, store_id, type, quantity, previous_stock, new_stock, note, staff_id)
    VALUES
      (OLD.product_id, OLD.store_id, 'adjustment', -OLD.quantity,
       prev_stock, GREATEST(prev_stock - OLD.quantity, 0),
       'Purchase ' || v_purchase.purchase_number || ' (edit - item removed)',
       v_purchase.staff_id);
  END IF;

  RETURN OLD;
END;
$$;


-- ─── Store-safe customer/order/payment logic ────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_customer_balance_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.sale_type = 'credit' AND NEW.customer_id IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.customers
      SET credit_balance = credit_balance + NEW.total,
          total_spent = total_spent + NEW.total,
          total_orders = total_orders + 1,
          updated_at = now()
      WHERE id = NEW.customer_id
        AND store_id = NEW.store_id;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.payment_status != 'paid' AND NEW.payment_status = 'paid' THEN
      UPDATE public.customers
      SET credit_balance = GREATEST(credit_balance - NEW.total, 0),
          updated_at = now()
      WHERE id = NEW.customer_id
        AND store_id = NEW.store_id;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.status != 'voided' AND NEW.status = 'voided' THEN
      UPDATE public.customers
      SET credit_balance = GREATEST(credit_balance - NEW.total, 0),
          total_spent = GREATEST(total_spent - NEW.total, 0),
          total_orders = GREATEST(total_orders - 1, 0),
          updated_at = now()
      WHERE id = NEW.customer_id
        AND store_id = NEW.store_id;
    END IF;
  END IF;

  IF NEW.sale_type = 'cash' AND NEW.customer_id IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.customers
      SET total_spent = total_spent + NEW.total,
          total_orders = total_orders + 1,
          updated_at = now()
      WHERE id = NEW.customer_id
        AND store_id = NEW.store_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_customer_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order RECORD;
  total_paid NUMERIC;
  order_total NUMERIC;
BEGIN
  SELECT sale_type, customer_id, store_id INTO v_order
  FROM public.orders
  WHERE id = NEW.order_id;

  IF v_order.sale_type = 'credit'
     AND v_order.customer_id IS NOT NULL
     AND v_order.store_id = NEW.store_id THEN
    UPDATE public.customers
    SET credit_balance = GREATEST(credit_balance - NEW.amount, 0),
        updated_at = now()
    WHERE id = v_order.customer_id
      AND store_id = NEW.store_id;

    SELECT COALESCE(SUM(amount), 0) INTO total_paid
    FROM public.payments
    WHERE order_id = NEW.order_id
      AND store_id = NEW.store_id;

    SELECT total INTO order_total
    FROM public.orders
    WHERE id = NEW.order_id
      AND store_id = NEW.store_id;

    IF total_paid >= order_total THEN
      UPDATE public.orders
      SET payment_status = 'paid'
      WHERE id = NEW.order_id
        AND store_id = NEW.store_id;
    ELSIF total_paid > 0 THEN
      UPDATE public.orders
      SET payment_status = 'partial'
      WHERE id = NEW.order_id
        AND store_id = NEW.store_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_customer_account_payment(
  p_customer_id UUID,
  p_amount NUMERIC,
  p_method TEXT DEFAULT 'cash',
  p_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_created_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  payment_id UUID,
  balance_before NUMERIC,
  applied_amount NUMERIC,
  balance_after NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_before NUMERIC(12,2);
  v_amount NUMERIC(12,2);
  v_applied NUMERIC(12,2);
  v_after NUMERIC(12,2);
  v_payment_id UUID;
  v_store_id UUID;
BEGIN
  SELECT store_id, credit_balance
  INTO v_store_id, v_before
  FROM public.customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  IF NOT public.can_access_store(v_store_id) THEN
    RAISE EXCEPTION 'Access denied for this store';
  END IF;

  v_amount := GREATEST(COALESCE(p_amount, 0), 0);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  v_applied := LEAST(v_before, v_amount);
  IF v_applied <= 0 THEN
    RAISE EXCEPTION 'Customer has no outstanding balance';
  END IF;

  v_after := GREATEST(v_before - v_applied, 0);

  INSERT INTO public.customer_account_payments (
    customer_id, store_id, method, amount, reference, notes, created_at
  )
  VALUES (
    p_customer_id,
    v_store_id,
    COALESCE(NULLIF(trim(p_method), ''), 'cash'),
    v_applied,
    p_reference,
    p_notes,
    COALESCE(p_created_at, now())
  )
  RETURNING id INTO v_payment_id;

  UPDATE public.customers
  SET credit_balance = v_after,
      updated_at = now()
  WHERE id = p_customer_id
    AND store_id = v_store_id;

  RETURN QUERY SELECT v_payment_id, v_before, v_applied, v_after;
END;
$$;
