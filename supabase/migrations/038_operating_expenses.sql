-- ============================================================================
-- 038 - Operating expenses + net profit on P&L summary
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.operating_expenses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id       UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  business_mode  TEXT NOT NULL DEFAULT 'retail'
                 CHECK (business_mode IN ('restaurant', 'retail')),
  category       TEXT NOT NULL DEFAULT 'other',
  description    TEXT NOT NULL DEFAULT '',
  amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  expense_date   TIMESTAMPTZ NOT NULL DEFAULT now(),
  reference      TEXT,
  notes          TEXT,
  staff_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  staff_name     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operating_expenses_store_date
  ON public.operating_expenses(store_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_operating_expenses_business_mode
  ON public.operating_expenses(business_mode);

CREATE TRIGGER operating_expenses_updated_at
  BEFORE UPDATE ON public.operating_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.operating_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members can read operating expenses"
  ON public.operating_expenses FOR SELECT
  TO authenticated
  USING (public.can_access_store(store_id));

CREATE POLICY "Admin manager can insert operating expenses"
  ON public.operating_expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin manager can update operating expenses"
  ON public.operating_expenses FOR UPDATE
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

CREATE POLICY "Admin manager can delete operating expenses"
  ON public.operating_expenses FOR DELETE
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

DROP TRIGGER IF EXISTS trg_operating_expenses_apply_current_store_id ON public.operating_expenses;
CREATE TRIGGER trg_operating_expenses_apply_current_store_id
  BEFORE INSERT ON public.operating_expenses
  FOR EACH ROW EXECUTE FUNCTION public.apply_current_store_id();

-- Extend profit summary with operating expenses and net profit.
-- Must drop first: CREATE OR REPLACE cannot change RETURNS TABLE columns.
DROP FUNCTION IF EXISTS public.get_profit_summary(TIMESTAMPTZ, TIMESTAMPTZ, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.get_profit_summary(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_store_id UUID DEFAULT NULL,
  p_business_mode TEXT DEFAULT NULL
)
RETURNS TABLE (
  gross_sales NUMERIC,
  discounts NUMERIC,
  refunds NUMERIC,
  net_revenue NUMERIC,
  cogs NUMERIC,
  gross_profit NUMERIC,
  gross_margin_pct NUMERIC,
  operating_expenses NUMERIC,
  net_profit NUMERIC,
  net_margin_pct NUMERIC,
  order_count BIGINT,
  refunded_order_count BIGINT,
  expense_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_id UUID;
  v_role TEXT;
BEGIN
  v_role := public.get_my_role();
  IF v_role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Access denied: profit report requires admin or manager role';
  END IF;

  IF p_start IS NULL OR p_end IS NULL THEN
    RAISE EXCEPTION 'Start and end dates are required';
  END IF;

  IF p_end < p_start THEN
    RAISE EXCEPTION 'End date must be on or after start date';
  END IF;

  v_store_id := COALESCE(p_store_id, public.current_store_id());
  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'No store selected';
  END IF;

  IF NOT public.can_access_store(v_store_id) THEN
    RAISE EXCEPTION 'Access denied for this store';
  END IF;

  RETURN QUERY
  WITH scoped_orders AS (
    SELECT o.*
    FROM public.orders o
    WHERE o.store_id = v_store_id
      AND o.created_at >= p_start
      AND o.created_at <= p_end
      AND (p_business_mode IS NULL OR o.business_mode = p_business_mode)
  ),
  sales_orders AS (
    SELECT *
    FROM scoped_orders
    WHERE status = 'completed'
      AND payment_status NOT IN ('refunded', 'voided')
  ),
  refund_orders AS (
    SELECT *
    FROM scoped_orders
    WHERE payment_status = 'refunded'
  ),
  sales_agg AS (
    SELECT
      COALESCE(SUM(total), 0)::NUMERIC AS gross_sales,
      COALESCE(SUM(discount_amount), 0)::NUMERIC AS discounts,
      COUNT(*)::BIGINT AS order_count
    FROM sales_orders
  ),
  refund_agg AS (
    SELECT
      COALESCE(SUM(total), 0)::NUMERIC AS refunds,
      COUNT(*)::BIGINT AS refunded_order_count
    FROM refund_orders
  ),
  cogs_sales AS (
    SELECT COALESCE(
      SUM(COALESCE(oi.unit_cost, p.cost, 0) * oi.quantity),
      0
    )::NUMERIC AS amount
    FROM public.order_items oi
    INNER JOIN sales_orders so ON so.id = oi.order_id
    LEFT JOIN public.products p ON p.id = oi.product_id
  ),
  cogs_refunds AS (
    SELECT COALESCE(
      SUM(COALESCE(oi.unit_cost, p.cost, 0) * oi.quantity),
      0
    )::NUMERIC AS amount
    FROM public.order_items oi
    INNER JOIN refund_orders ro ON ro.id = oi.order_id
    LEFT JOIN public.products p ON p.id = oi.product_id
  ),
  expenses_agg AS (
    SELECT
      COALESCE(SUM(e.amount), 0)::NUMERIC AS operating_expenses,
      COUNT(*)::BIGINT AS expense_count
    FROM public.operating_expenses e
    WHERE e.store_id = v_store_id
      AND e.expense_date >= p_start
      AND e.expense_date <= p_end
      AND (p_business_mode IS NULL OR e.business_mode = p_business_mode)
  ),
  calc AS (
    SELECT
      sa.gross_sales,
      sa.discounts,
      ra.refunds,
      (sa.gross_sales - ra.refunds) AS net_revenue,
      (cs.amount - cr.amount) AS cogs,
      sa.order_count,
      ra.refunded_order_count,
      ea.operating_expenses,
      ea.expense_count
    FROM sales_agg sa
    CROSS JOIN refund_agg ra
    CROSS JOIN cogs_sales cs
    CROSS JOIN cogs_refunds cr
    CROSS JOIN expenses_agg ea
  )
  SELECT
    c.gross_sales,
    c.discounts,
    c.refunds,
    c.net_revenue,
    c.cogs,
    (c.net_revenue - c.cogs) AS gross_profit,
    CASE
      WHEN c.net_revenue > 0 THEN ROUND(((c.net_revenue - c.cogs) / c.net_revenue) * 100, 2)
      ELSE 0
    END AS gross_margin_pct,
    c.operating_expenses,
    ((c.net_revenue - c.cogs) - c.operating_expenses) AS net_profit,
    CASE
      WHEN c.net_revenue > 0 THEN
        ROUND((((c.net_revenue - c.cogs) - c.operating_expenses) / c.net_revenue) * 100, 2)
      ELSE 0
    END AS net_margin_pct,
    c.order_count,
    c.refunded_order_count,
    c.expense_count
  FROM calc c;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_profit_summary(TIMESTAMPTZ, TIMESTAMPTZ, UUID, TEXT)
  TO authenticated;
