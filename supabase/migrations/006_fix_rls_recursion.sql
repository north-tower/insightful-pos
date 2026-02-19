-- ============================================================================
-- 006 – Fix infinite recursion in RLS policies
--
-- Problem: The "Admins can view all profiles" policy on `profiles` does
--   SELECT FROM profiles — which triggers the same policy again → recursion.
--   Any other table's policy that also checks profiles (products, orders, etc.)
--   hits the same loop.
--
-- Fix: Create a SECURITY DEFINER helper function that reads the current
-- user's role WITHOUT going through RLS.  Then rewrite every policy that
-- referenced profiles to use this helper instead.
-- ============================================================================

-- ─── 1. Helper function (bypasses RLS) ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;


-- ─── 2. Fix profiles policies ───────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING ( public.get_my_role() = 'admin' );

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING ( public.get_my_role() = 'admin' );


-- ─── 3. Fix categories policies (from 003) ─────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can create categories." ON categories;
CREATE POLICY "Authenticated users can create categories."
  ON categories FOR INSERT
  WITH CHECK ( auth.role() = 'authenticated' );

DROP POLICY IF EXISTS "Admins and managers can update categories." ON categories;
CREATE POLICY "Admins and managers can update categories."
  ON categories FOR UPDATE
  USING ( public.get_my_role() IN ('admin', 'manager') );

DROP POLICY IF EXISTS "Admins and managers can delete categories." ON categories;
CREATE POLICY "Admins and managers can delete categories."
  ON categories FOR DELETE
  USING ( public.get_my_role() IN ('admin', 'manager') );


-- ─── 4. Fix products policies (from 003) ────────────────────────────────────

DROP POLICY IF EXISTS "Admins and managers can create products." ON products;
CREATE POLICY "Admins and managers can create products."
  ON products FOR INSERT
  WITH CHECK ( public.get_my_role() IN ('admin', 'manager') );

DROP POLICY IF EXISTS "Admins and managers can update products." ON products;
CREATE POLICY "Admins and managers can update products."
  ON products FOR UPDATE
  USING ( public.get_my_role() IN ('admin', 'manager') );

DROP POLICY IF EXISTS "Admins and managers can delete products." ON products;
CREATE POLICY "Admins and managers can delete products."
  ON products FOR DELETE
  USING ( public.get_my_role() IN ('admin', 'manager') );


-- ─── 5. Fix product_variants policies (from 003) ───────────────────────────

DROP POLICY IF EXISTS "Admins and managers can create product variants." ON product_variants;
CREATE POLICY "Admins and managers can create product variants."
  ON product_variants FOR INSERT
  WITH CHECK ( public.get_my_role() IN ('admin', 'manager') );

DROP POLICY IF EXISTS "Admins and managers can update product variants." ON product_variants;
CREATE POLICY "Admins and managers can update product variants."
  ON product_variants FOR UPDATE
  USING ( public.get_my_role() IN ('admin', 'manager') );

DROP POLICY IF EXISTS "Admins and managers can delete product variants." ON product_variants;
CREATE POLICY "Admins and managers can delete product variants."
  ON product_variants FOR DELETE
  USING ( public.get_my_role() IN ('admin', 'manager') );


-- ─── 6. Fix stock_adjustments policies (from 003) ──────────────────────────

DROP POLICY IF EXISTS "Stock adjustments are viewable by admins and managers." ON stock_adjustments;
CREATE POLICY "Stock adjustments are viewable by admins and managers."
  ON stock_adjustments FOR SELECT
  USING ( public.get_my_role() IN ('admin', 'manager') );

DROP POLICY IF EXISTS "Stock adjustments can be created by admins and managers." ON stock_adjustments;
CREATE POLICY "Stock adjustments can be created by admins and managers."
  ON stock_adjustments FOR INSERT
  WITH CHECK ( public.get_my_role() IN ('admin', 'manager') );


-- ─── 7. Fix orders policies (from 005) ──────────────────────────────────────

DROP POLICY IF EXISTS "Admins and managers can update orders." ON orders;
CREATE POLICY "Admins and managers can update orders."
  ON orders FOR UPDATE
  USING (
    public.get_my_role() IN ('admin', 'manager')
    OR staff_id = auth.uid()
  );

DROP POLICY IF EXISTS "Admins can delete orders." ON orders;
CREATE POLICY "Admins can delete orders."
  ON orders FOR DELETE
  USING ( public.get_my_role() = 'admin' );


-- ─── 8. Fix order_items policies (from 005) ─────────────────────────────────

DROP POLICY IF EXISTS "Admins and managers can update order items." ON order_items;
CREATE POLICY "Admins and managers can update order items."
  ON order_items FOR UPDATE
  USING ( public.get_my_role() IN ('admin', 'manager') );

DROP POLICY IF EXISTS "Admins can delete order items." ON order_items;
CREATE POLICY "Admins can delete order items."
  ON order_items FOR DELETE
  USING ( public.get_my_role() = 'admin' );


-- ─── 9. Make stock-deduction trigger SECURITY DEFINER ───────────────────────
-- The trigger updates products.stock on behalf of any user making a sale,
-- so it needs to bypass the "admins and managers only" UPDATE policy.

CREATE OR REPLACE FUNCTION deduct_stock_on_sale()
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
       AND business_mode = 'retail';
  END IF;
  RETURN NEW;
END;
$$;
