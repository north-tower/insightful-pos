-- ============================================================================
-- 049 - Resync invoice counter from actual orders in DB
--
-- Root cause: between migrations 022 (store-scoped counters) and 045 (drop
-- legacy no-args generate_invoice_number), some orders may have been created
-- using the old global invoice_number_seq. Migration 023 backfilled counters
-- from existing orders, but if new orders were inserted with the old generator
-- after 023 ran, or if the counters were backfilled before those orders
-- existed, the store_counters.invoice value can be behind the actual max,
-- causing generate_invoice_number() to return a number that already exists.
--
-- Fix: re-run the backfill from 023 unconditionally, ensuring the counter
-- is always >= the actual maximum invoice suffix in the orders table.
-- ============================================================================

-- Re-seed invoice counters from the actual data, taking the greater of the
-- current counter value and the real max from the orders table.
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
