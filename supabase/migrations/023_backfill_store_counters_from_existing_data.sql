-- ============================================================================
-- 023 - Backfill store counters from existing data
-- Seeds store_counters using current max document numbers per store so the
-- new store-scoped generators continue safely from production values.
-- ============================================================================

-- ─── Orders: restaurant (F####) ──────────────────────────────────────────────

WITH max_restaurant AS (
  SELECT
    o.store_id,
    MAX((substring(o.order_number FROM '([0-9]+)$'))::BIGINT) AS max_value
  FROM public.orders o
  WHERE o.order_number ~ '^F[0-9]+$'
  GROUP BY o.store_id
)
INSERT INTO public.store_counters (store_id, counter_key, counter_value)
SELECT store_id, 'restaurant_order', max_value
FROM max_restaurant
WHERE max_value IS NOT NULL
ON CONFLICT (store_id, counter_key) DO UPDATE
SET counter_value = GREATEST(public.store_counters.counter_value, EXCLUDED.counter_value),
    updated_at = now();


-- ─── Orders: retail (R####) ─────────────────────────────────────────────────

WITH max_retail AS (
  SELECT
    o.store_id,
    MAX((substring(o.order_number FROM '([0-9]+)$'))::BIGINT) AS max_value
  FROM public.orders o
  WHERE o.order_number ~ '^R[0-9]+$'
  GROUP BY o.store_id
)
INSERT INTO public.store_counters (store_id, counter_key, counter_value)
SELECT store_id, 'retail_order', max_value
FROM max_retail
WHERE max_value IS NOT NULL
ON CONFLICT (store_id, counter_key) DO UPDATE
SET counter_value = GREATEST(public.store_counters.counter_value, EXCLUDED.counter_value),
    updated_at = now();


-- ─── Invoices: INV-YYYY-#### ────────────────────────────────────────────────

WITH max_invoice AS (
  SELECT
    o.store_id,
    MAX((substring(o.invoice_number FROM '([0-9]+)$'))::BIGINT) AS max_value
  FROM public.orders o
  WHERE o.invoice_number IS NOT NULL
    AND o.invoice_number ~ '^INV-[0-9]{4}-[0-9]+$'
  GROUP BY o.store_id
)
INSERT INTO public.store_counters (store_id, counter_key, counter_value)
SELECT store_id, 'invoice', max_value
FROM max_invoice
WHERE max_value IS NOT NULL
ON CONFLICT (store_id, counter_key) DO UPDATE
SET counter_value = GREATEST(public.store_counters.counter_value, EXCLUDED.counter_value),
    updated_at = now();


-- ─── Purchases: PO-YYYY-#### ────────────────────────────────────────────────

WITH max_purchase AS (
  SELECT
    p.store_id,
    MAX((substring(p.purchase_number FROM '([0-9]+)$'))::BIGINT) AS max_value
  FROM public.purchases p
  WHERE p.purchase_number ~ '^PO-[0-9]{4}-[0-9]+$'
  GROUP BY p.store_id
)
INSERT INTO public.store_counters (store_id, counter_key, counter_value)
SELECT store_id, 'purchase', max_value
FROM max_purchase
WHERE max_value IS NOT NULL
ON CONFLICT (store_id, counter_key) DO UPDATE
SET counter_value = GREATEST(public.store_counters.counter_value, EXCLUDED.counter_value),
    updated_at = now();
