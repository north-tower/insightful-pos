-- ============================================================================
-- 037 - Snapshot unit cost on order lines + gross profit summary RPC
-- ============================================================================

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.order_items.unit_cost IS
  'Product cost at time of sale (COGS per unit).';

-- Backfill historical lines from current product cost where available.
UPDATE public.order_items oi
SET unit_cost = COALESCE(p.cost, 0)
FROM public.products p
WHERE oi.product_id = p.id
  AND (oi.unit_cost IS NULL OR oi.unit_cost = 0);

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
  order_count BIGINT,
  refunded_order_count BIGINT
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
  calc AS (
    SELECT
      sa.gross_sales,
      sa.discounts,
      ra.refunds,
      (sa.gross_sales - ra.refunds) AS net_revenue,
      (cs.amount - cr.amount) AS cogs,
      sa.order_count,
      ra.refunded_order_count
    FROM sales_agg sa
    CROSS JOIN refund_agg ra
    CROSS JOIN cogs_sales cs
    CROSS JOIN cogs_refunds cr
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
    c.order_count,
    c.refunded_order_count
  FROM calc c;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_profit_summary(TIMESTAMPTZ, TIMESTAMPTZ, UUID, TEXT)
  TO authenticated;
