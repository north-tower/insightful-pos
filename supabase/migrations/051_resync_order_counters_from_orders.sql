-- ============================================================================
-- 051 - Resync order counters from actual orders in DB
--
-- Root cause: between migrations 022 (store-scoped counters) and 050 (atomic order creation),
-- the store_counters for retail_order/restaurant_order might be behind actual max
-- order numbers, causing generate_order_number() to return duplicate values.
--
-- Fix: re-seed order counters (retail_order and restaurant_order) from existing orders.
-- ============================================================================

-- Re-seed retail_order counters
WITH max_retail_order AS (
  SELECT
    o.store_id,
    MAX((substring(o.order_number FROM '^R(\d+)$'))::BIGINT) AS max_value
  FROM public.orders o
  WHERE o.business_mode = 'retail'
    AND o.order_number ~ '^R\d+$'
  GROUP BY o.store_id
)
INSERT INTO public.store_counters (store_id, counter_key, counter_value)
SELECT store_id, 'retail_order', max_value
FROM max_retail_order
WHERE max_value IS NOT NULL
ON CONFLICT (store_id, counter_key) DO UPDATE
SET counter_value = GREATEST(public.store_counters.counter_value, EXCLUDED.counter_value),
    updated_at = now();

-- Re-seed restaurant_order counters
WITH max_restaurant_order AS (
  SELECT
    o.store_id,
    MAX((substring(o.order_number FROM '^F(\d+)$'))::BIGINT) AS max_value
  FROM public.orders o
  WHERE o.business_mode = 'restaurant'
    AND o.order_number ~ '^F\d+$'
  GROUP BY o.store_id
)
INSERT INTO public.store_counters (store_id, counter_key, counter_value)
SELECT store_id, 'restaurant_order', max_value
FROM max_restaurant_order
WHERE max_value IS NOT NULL
ON CONFLICT (store_id, counter_key) DO UPDATE
SET counter_value = GREATEST(public.store_counters.counter_value, EXCLUDED.counter_value),
    updated_at = now();
