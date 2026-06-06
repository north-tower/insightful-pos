-- ============================================================================
-- Verify purchase_items CSV before import
-- Run in Supabase SQL Editor
-- ============================================================================

-- 1) How many purchases exist?
SELECT count(*) AS purchase_count FROM public.purchases;

-- 2) Purchases missing store_id (blocks item import on old trigger)
SELECT id, purchase_number, supplier_id, status, store_id
FROM public.purchases
WHERE store_id IS NULL
ORDER BY created_at DESC
LIMIT 50;

-- 3) Check YOUR purchase_ids from the spreadsheet (paste UUIDs from column B)
--    Rows with found = NULL mean that purchase_id does NOT exist in the DB.
WITH sheet_ids (purchase_id) AS (
  VALUES
    ('42a44266-8772-4a2e-8765-9d978629a73c'::uuid)
    -- add more purchase_id values from your CSV here
)
SELECT
  s.purchase_id,
  p.id AS found_in_db,
  p.purchase_number,
  p.store_id,
  p.status
FROM sheet_ids s
LEFT JOIN public.purchases p ON p.id = s.purchase_id
ORDER BY found_in_db NULLS FIRST;

-- 4) List actual purchase IDs you should use (export from DB)
SELECT id, purchase_number, status, total, order_date::date
FROM public.purchases
ORDER BY order_date DESC
LIMIT 100;
