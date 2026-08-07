-- ============================================================================
-- 056 - Isolate branch data to the active branch (current_store_id)
-- Admins may belong to multiple branches in one business; UI/RLS must only
-- expose the active branch's products, orders, stock, etc.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_current_store(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_store_id IS NOT NULL
     AND public.current_store_id() IS NOT NULL
     AND p_store_id = public.current_store_id();
$$;

CREATE OR REPLACE FUNCTION public.drop_all_policies(p_table regclass)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r RECORD;
  v_schema TEXT;
  v_table TEXT;
BEGIN
  SELECT n.nspname, c.relname INTO v_schema, v_table
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.oid = p_table;

  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = v_schema
      AND tablename = v_table
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, v_schema, v_table);
  END LOOP;
END;
$$;

-- ─── CATEGORIES ──────────────────────────────────────────────────────────────
SELECT public.drop_all_policies('public.categories');

CREATE POLICY "Active branch can read categories"
  ON public.categories FOR SELECT TO authenticated
  USING (public.is_current_store(store_id));

CREATE POLICY "Admin manager can insert categories in active branch"
  ON public.categories FOR INSERT TO authenticated
  WITH CHECK (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin manager can update categories in active branch"
  ON public.categories FOR UPDATE TO authenticated
  USING (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin manager can delete categories in active branch"
  ON public.categories FOR DELETE TO authenticated
  USING (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

-- ─── PRODUCTS ────────────────────────────────────────────────────────────────
SELECT public.drop_all_policies('public.products');

CREATE POLICY "Active branch can read products"
  ON public.products FOR SELECT TO authenticated
  USING (public.is_current_store(store_id));

CREATE POLICY "Admin manager can insert products in active branch"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin manager can update products in active branch"
  ON public.products FOR UPDATE TO authenticated
  USING (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin manager can delete products in active branch"
  ON public.products FOR DELETE TO authenticated
  USING (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

-- ─── PRODUCT VARIANTS ────────────────────────────────────────────────────────
SELECT public.drop_all_policies('public.product_variants');

CREATE POLICY "Active branch can read variants"
  ON public.product_variants FOR SELECT TO authenticated
  USING (public.is_current_store(store_id));

CREATE POLICY "Admin manager can insert variants in active branch"
  ON public.product_variants FOR INSERT TO authenticated
  WITH CHECK (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin manager can update variants in active branch"
  ON public.product_variants FOR UPDATE TO authenticated
  USING (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin manager can delete variants in active branch"
  ON public.product_variants FOR DELETE TO authenticated
  USING (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

-- ─── STOCK ADJUSTMENTS ───────────────────────────────────────────────────────
SELECT public.drop_all_policies('public.stock_adjustments');

CREATE POLICY "Active branch can read stock adjustments"
  ON public.stock_adjustments FOR SELECT TO authenticated
  USING (public.is_current_store(store_id));

CREATE POLICY "Staff can insert stock adjustments in active branch"
  ON public.stock_adjustments FOR INSERT TO authenticated
  WITH CHECK (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager', 'cashier')
  );

-- ─── SUPPLIERS ───────────────────────────────────────────────────────────────
SELECT public.drop_all_policies('public.suppliers');

CREATE POLICY "Active branch can read suppliers"
  ON public.suppliers FOR SELECT TO authenticated
  USING (public.is_current_store(store_id));

CREATE POLICY "Admin manager can insert suppliers in active branch"
  ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin manager can update suppliers in active branch"
  ON public.suppliers FOR UPDATE TO authenticated
  USING (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin manager can delete suppliers in active branch"
  ON public.suppliers FOR DELETE TO authenticated
  USING (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

-- ─── PURCHASES ───────────────────────────────────────────────────────────────
SELECT public.drop_all_policies('public.purchases');

CREATE POLICY "Active branch can read purchases"
  ON public.purchases FOR SELECT TO authenticated
  USING (public.is_current_store(store_id));

CREATE POLICY "Admin manager can insert purchases in active branch"
  ON public.purchases FOR INSERT TO authenticated
  WITH CHECK (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin manager can update purchases in active branch"
  ON public.purchases FOR UPDATE TO authenticated
  USING (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin manager can delete purchases in active branch"
  ON public.purchases FOR DELETE TO authenticated
  USING (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

-- ─── PURCHASE ITEMS ──────────────────────────────────────────────────────────
SELECT public.drop_all_policies('public.purchase_items');

CREATE POLICY "Active branch can read purchase items"
  ON public.purchase_items FOR SELECT TO authenticated
  USING (public.is_current_store(store_id));

CREATE POLICY "Admin manager can insert purchase items in active branch"
  ON public.purchase_items FOR INSERT TO authenticated
  WITH CHECK (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin manager can update purchase items in active branch"
  ON public.purchase_items FOR UPDATE TO authenticated
  USING (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin manager can delete purchase items in active branch"
  ON public.purchase_items FOR DELETE TO authenticated
  USING (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

-- ─── CUSTOMERS ───────────────────────────────────────────────────────────────
SELECT public.drop_all_policies('public.customers');

CREATE POLICY "Active branch can read customers"
  ON public.customers FOR SELECT TO authenticated
  USING (public.is_current_store(store_id));

CREATE POLICY "Staff can insert customers in active branch"
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager', 'cashier')
  );

CREATE POLICY "Staff can update customers in active branch"
  ON public.customers FOR UPDATE TO authenticated
  USING (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager', 'cashier')
  )
  WITH CHECK (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager', 'cashier')
  );

CREATE POLICY "Admin manager can delete customers in active branch"
  ON public.customers FOR DELETE TO authenticated
  USING (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

-- ─── ORDERS ──────────────────────────────────────────────────────────────────
SELECT public.drop_all_policies('public.orders');

CREATE POLICY "Active branch can read orders"
  ON public.orders FOR SELECT TO authenticated
  USING (public.is_current_store(store_id));

CREATE POLICY "Staff can insert orders in active branch"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (public.is_current_store(store_id));

CREATE POLICY "Staff can update orders in active branch"
  ON public.orders FOR UPDATE TO authenticated
  USING (public.is_current_store(store_id))
  WITH CHECK (public.is_current_store(store_id));

CREATE POLICY "Admin can delete orders in active branch"
  ON public.orders FOR DELETE TO authenticated
  USING (
    public.is_current_store(store_id)
    AND public.get_my_role() = 'admin'
  );

-- ─── ORDER ITEMS ─────────────────────────────────────────────────────────────
SELECT public.drop_all_policies('public.order_items');

CREATE POLICY "Active branch can read order items"
  ON public.order_items FOR SELECT TO authenticated
  USING (public.is_current_store(store_id));

CREATE POLICY "Staff can insert order items in active branch"
  ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (public.is_current_store(store_id));

CREATE POLICY "Staff can update order items in active branch"
  ON public.order_items FOR UPDATE TO authenticated
  USING (public.is_current_store(store_id))
  WITH CHECK (public.is_current_store(store_id));

CREATE POLICY "Admin can delete order items in active branch"
  ON public.order_items FOR DELETE TO authenticated
  USING (
    public.is_current_store(store_id)
    AND public.get_my_role() = 'admin'
  );

-- ─── PAYMENTS ────────────────────────────────────────────────────────────────
SELECT public.drop_all_policies('public.payments');

CREATE POLICY "Active branch can read payments"
  ON public.payments FOR SELECT TO authenticated
  USING (public.is_current_store(store_id));

CREATE POLICY "Staff can insert payments in active branch"
  ON public.payments FOR INSERT TO authenticated
  WITH CHECK (public.is_current_store(store_id));

CREATE POLICY "Staff can update payments in active branch"
  ON public.payments FOR UPDATE TO authenticated
  USING (public.is_current_store(store_id))
  WITH CHECK (public.is_current_store(store_id));

CREATE POLICY "Admin can delete payments in active branch"
  ON public.payments FOR DELETE TO authenticated
  USING (
    public.is_current_store(store_id)
    AND public.get_my_role() = 'admin'
  );

-- ─── CUSTOMER ACCOUNT PAYMENTS ───────────────────────────────────────────────
SELECT public.drop_all_policies('public.customer_account_payments');

CREATE POLICY "Active branch can read customer account payments"
  ON public.customer_account_payments FOR SELECT TO authenticated
  USING (public.is_current_store(store_id));

CREATE POLICY "Staff can insert customer account payments in active branch"
  ON public.customer_account_payments FOR INSERT TO authenticated
  WITH CHECK (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager', 'cashier')
  );

CREATE POLICY "Admin manager can update customer account payments in active branch"
  ON public.customer_account_payments FOR UPDATE TO authenticated
  USING (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin manager can delete customer account payments in active branch"
  ON public.customer_account_payments FOR DELETE TO authenticated
  USING (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

-- ─── OPERATING EXPENSES ──────────────────────────────────────────────────────
SELECT public.drop_all_policies('public.operating_expenses');

CREATE POLICY "Active branch can read operating expenses"
  ON public.operating_expenses FOR SELECT TO authenticated
  USING (public.is_current_store(store_id));

CREATE POLICY "Admin manager can insert operating expenses in active branch"
  ON public.operating_expenses FOR INSERT TO authenticated
  WITH CHECK (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin manager can update operating expenses in active branch"
  ON public.operating_expenses FOR UPDATE TO authenticated
  USING (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin manager can delete operating expenses in active branch"
  ON public.operating_expenses FOR DELETE TO authenticated
  USING (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

-- ─── SHOP DAY SETTLEMENTS ────────────────────────────────────────────────────
SELECT public.drop_all_policies('public.shop_day_settlements');

CREATE POLICY "Active branch can read shop day settlements"
  ON public.shop_day_settlements FOR SELECT TO authenticated
  USING (public.is_current_store(store_id));

CREATE POLICY "Admin manager can manage shop day settlements in active branch"
  ON public.shop_day_settlements FOR ALL TO authenticated
  USING (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

-- ─── ROUTE SETTLEMENTS ───────────────────────────────────────────────────────
SELECT public.drop_all_policies('public.route_settlements');

CREATE POLICY "Active branch can read route settlements"
  ON public.route_settlements FOR SELECT TO authenticated
  USING (public.is_current_store(store_id));

CREATE POLICY "Admin manager can manage route settlements in active branch"
  ON public.route_settlements FOR ALL TO authenticated
  USING (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    public.is_current_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

-- ─── CASHIER ALLOCATIONS / STAFF ASSIGNMENTS (if present) ────────────────────
DO $$
BEGIN
  IF to_regclass('public.cashier_stock_allocations') IS NOT NULL THEN
    PERFORM public.drop_all_policies('public.cashier_stock_allocations');
    EXECUTE $p$
      CREATE POLICY "Active branch can read cashier allocations"
        ON public.cashier_stock_allocations FOR SELECT TO authenticated
        USING (
          public.is_current_store(store_id)
          AND (
            public.get_my_role() IN ('admin', 'manager')
            OR cashier_id = auth.uid()
          )
        )
    $p$;
    EXECUTE $p$
      CREATE POLICY "Admin manager can manage cashier allocations in active branch"
        ON public.cashier_stock_allocations FOR ALL TO authenticated
        USING (
          public.is_current_store(store_id)
          AND public.get_my_role() IN ('admin', 'manager')
        )
        WITH CHECK (
          public.is_current_store(store_id)
          AND public.get_my_role() IN ('admin', 'manager')
        )
    $p$;
  END IF;

  IF to_regclass('public.staff_inventory_assignments') IS NOT NULL THEN
    PERFORM public.drop_all_policies('public.staff_inventory_assignments');
    EXECUTE $p$
      CREATE POLICY "Active branch can read staff assignments"
        ON public.staff_inventory_assignments FOR SELECT TO authenticated
        USING (
          public.is_current_store(store_id)
          AND (
            public.get_my_role() IN ('admin', 'manager')
            OR cashier_id = auth.uid()
          )
        )
    $p$;
    EXECUTE $p$
      CREATE POLICY "Admin manager can manage staff assignments in active branch"
        ON public.staff_inventory_assignments FOR ALL TO authenticated
        USING (
          public.is_current_store(store_id)
          AND public.get_my_role() IN ('admin', 'manager')
        )
        WITH CHECK (
          public.is_current_store(store_id)
          AND public.get_my_role() IN ('admin', 'manager')
        )
    $p$;
  END IF;
END $$;
