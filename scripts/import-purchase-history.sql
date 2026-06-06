-- ============================================================================
-- Import historical purchases from spreadsheet (Supabase SQL Editor)
--
-- How to use:
-- 1. Apply migration 043_bulk_import_store_bypass.sql first (fixes CSV import errors)
-- 2. Open Supabase → SQL Editor
-- 3. Paste your rows into the INSERT section below (add one row per line)
-- 4. Run the whole script
--
-- Supabase Table CSV import: omit store_id column; migration 043 is required.
--
-- Notes:
-- - Groups rows into one purchase order per: supplier + delivery date
-- - Creates suppliers and products if they don't exist (retail / main store)
-- - Marks purchases as "received" and updates stock for linked products
-- - Decimal quantities are rounded to whole units (purchase_items uses INTEGER)
-- - Bank / KRA fields are stored in supplier notes when present
-- ============================================================================

BEGIN;

-- ─── 1) Staging: paste your spreadsheet rows here ─────────────────────────────

CREATE TEMP TABLE purchase_import_staging (
  supplier_name   TEXT NOT NULL,
  contact_person  TEXT,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  city            TEXT,
  product_name    TEXT NOT NULL,
  category        TEXT,
  quantity        NUMERIC(12, 4) NOT NULL,
  unit_price      NUMERIC(12, 2) NOT NULL,
  delivery_date   DATE NOT NULL,
  bank_name       TEXT,
  account_number  TEXT,
  kra_pin         TEXT
) ON COMMIT DROP;

INSERT INTO purchase_import_staging (
  supplier_name, contact_person, phone, email, address, city,
  product_name, category, quantity, unit_price, delivery_date,
  bank_name, account_number, kra_pin
) VALUES
  -- Example rows from your sheet — add the rest in the same format:
  ('AHMED SALT ENTERPRISES', NULL, '722604422', NULL, 'NKS', 'NAKURU', 'SALT', NULL, 10, 500, '2025-10-30', NULL, NULL, NULL),
  ('ASHUT PLASTIC LTD', 'BEATRICE', '737552222', 'SALES@ashutplastics.com', 'LOKITAUNG', 'NAIROBI', 'BUCKETS 2KG', 'MATERIAL', 144, 35.2, '2025-12-19', NULL, NULL, 'PO518971227'),
  ('ASHUT PLASTIC LTD', 'BEATRICE', '737552222', 'SALES@ashutplastics.com', 'LOKITAUNG', 'NAIROBI', 'HANGER', 'MATERIAL', 200, 7, '2025-12-19', NULL, NULL, NULL),
  ('BENABO ANIMAL FEEDS', NULL, '719519366', NULL, 'O HARVEST RD BEHIND', 'NAKURU', 'POWDER', 'LIME', 158, 270, '2025-05-15', NULL, NULL, NULL),
  ('CONNECT SUPPLIERS', 'EDWIN', '0705689568', NULL, NULL, 'NAKURU', 'VANILLA SPECIAL +600VAT', 'MATERIAL', 2.5, 1600, '2025-08-20', NULL, NULL, NULL);

-- ─── 2) Resolve main store ──────────────────────────────────────────────────

CREATE TEMP TABLE _import_ctx AS
SELECT id AS store_id
FROM public.stores
WHERE code = '007'
LIMIT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _import_ctx) THEN
    RAISE EXCEPTION 'No store with code = main found. Create a store first.';
  END IF;
END $$;

-- ─── 3) Upsert suppliers ────────────────────────────────────────────────────

WITH store AS (SELECT store_id FROM _import_ctx),
supplier_src AS (
  SELECT DISTINCT ON (upper(trim(supplier_name)))
    upper(trim(s.supplier_name)) AS key_name,
    trim(s.supplier_name) AS name,
    nullif(trim(s.contact_person), '') AS contact_person,
    nullif(trim(s.phone), '') AS phone,
    nullif(trim(s.email), '') AS email,
    nullif(trim(s.address), '') AS address,
    nullif(trim(s.city), '') AS city,
    trim(concat_ws(E'\n',
      CASE WHEN nullif(trim(s.bank_name), '') IS NOT NULL AND trim(s.bank_name) <> '0'
        THEN 'Bank: ' || trim(s.bank_name) END,
      CASE WHEN nullif(trim(s.account_number), '') IS NOT NULL AND trim(s.account_number) <> '0'
        THEN 'Account: ' || trim(s.account_number) END,
      CASE WHEN nullif(trim(s.kra_pin), '') IS NOT NULL AND trim(s.kra_pin) <> '0'
        THEN 'KRA PIN: ' || trim(s.kra_pin) END
    )) AS notes
  FROM purchase_import_staging s
  ORDER BY upper(trim(s.supplier_name)), s.delivery_date DESC
)
INSERT INTO public.suppliers (
  business_mode, store_id, name, contact_person, phone, email, address, city, country, notes, status
)
SELECT
  'retail',
  store.store_id,
  supplier_src.name,
  supplier_src.contact_person,
  supplier_src.phone,
  supplier_src.email,
  supplier_src.address,
  supplier_src.city,
  'Kenya',
  nullif(supplier_src.notes, ''),
  'active'
FROM supplier_src
CROSS JOIN store
WHERE NOT EXISTS (
  SELECT 1
  FROM public.suppliers existing
  WHERE existing.store_id = store.store_id
    AND upper(trim(existing.name)) = supplier_src.key_name
);

-- ─── 4) Upsert categories + products ────────────────────────────────────────

WITH store AS (SELECT store_id FROM _import_ctx),
category_src AS (
  SELECT DISTINCT upper(trim(category)) AS key_name, trim(category) AS name
  FROM purchase_import_staging
  WHERE nullif(trim(category), '') IS NOT NULL
)
INSERT INTO public.categories (name, business_mode, store_id, sort_order, is_active)
SELECT category_src.name, 'retail', store.store_id, 0, true
FROM category_src
CROSS JOIN store
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories c
  WHERE c.store_id = store.store_id
    AND upper(trim(c.name)) = category_src.key_name
);

WITH store AS (SELECT store_id FROM _import_ctx),
product_src AS (
  SELECT DISTINCT ON (upper(trim(s.product_name)))
    upper(trim(s.product_name)) AS key_name,
    trim(s.product_name) AS name,
    s.unit_price,
    nullif(trim(s.category), '') AS category_name
  FROM purchase_import_staging s
  ORDER BY upper(trim(s.product_name)), s.delivery_date DESC
)
INSERT INTO public.products (
  name, business_mode, store_id, category_id, price, cost, stock, unit, is_active
)
SELECT
  product_src.name,
  'retail',
  store.store_id,
  c.id,
  product_src.unit_price,
  product_src.unit_price,
  0,
  'pcs',
  true
FROM product_src
CROSS JOIN store
LEFT JOIN public.categories c
  ON c.store_id = store.store_id
 AND upper(trim(c.name)) = upper(trim(product_src.category_name))
WHERE NOT EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.store_id = store.store_id
    AND upper(trim(p.name)) = product_src.key_name
);

-- ─── 5) Create purchase headers (grouped by supplier + delivery date) ─────────

CREATE TEMP TABLE _import_purchase_map (
  purchase_id UUID PRIMARY KEY,
  supplier_key TEXT NOT NULL,
  delivery_date DATE NOT NULL
) ON COMMIT DROP;

WITH store AS (SELECT store_id FROM _import_ctx),
groups AS (
  SELECT DISTINCT
    upper(trim(s.supplier_name)) AS supplier_key,
    s.delivery_date
  FROM purchase_import_staging s
),
inserted AS (
  INSERT INTO public.purchases (
    purchase_number,
    business_mode,
    store_id,
    supplier_id,
    status,
    subtotal,
    tax_amount,
    total,
    order_date,
    notes
  )
  SELECT
    public.generate_purchase_number(store.store_id),
    'retail',
    store.store_id,
    sup.id,
    'draft',
    0,
    0,
    0,
    g.delivery_date::timestamptz,
    'Imported from spreadsheet'
  FROM groups g
  CROSS JOIN store
  JOIN public.suppliers sup
    ON sup.store_id = store.store_id
   AND upper(trim(sup.name)) = g.supplier_key
  RETURNING id, supplier_id, order_date
)
INSERT INTO _import_purchase_map (purchase_id, supplier_key, delivery_date)
SELECT
  i.id,
  upper(trim(sup.name)),
  i.order_date::date
FROM inserted i
JOIN public.suppliers sup ON sup.id = i.supplier_id;

-- ─── 6) Insert purchase line items ──────────────────────────────────────────

WITH store AS (SELECT store_id FROM _import_ctx)
INSERT INTO public.purchase_items (
  purchase_id,
  store_id,
  product_id,
  product_name,
  quantity,
  unit_cost,
  line_total
)
SELECT
  m.purchase_id,
  store.store_id,
  p.id,
  trim(s.product_name),
  GREATEST(1, ceil(s.quantity)::int),
  s.unit_price,
  round(s.quantity * s.unit_price, 2)
FROM purchase_import_staging s
JOIN _import_purchase_map m
  ON m.supplier_key = upper(trim(s.supplier_name))
 AND m.delivery_date = s.delivery_date
CROSS JOIN store
LEFT JOIN public.products p
  ON p.store_id = store.store_id
 AND upper(trim(p.name)) = upper(trim(s.product_name));

-- ─── 7) Recalculate purchase totals ─────────────────────────────────────────

UPDATE public.purchases po
SET
  subtotal = x.subtotal,
  total = x.subtotal,
  tax_amount = 0,
  updated_at = now()
FROM (
  SELECT purchase_id, COALESCE(sum(line_total), 0) AS subtotal
  FROM public.purchase_items
  GROUP BY purchase_id
) x
WHERE po.id = x.purchase_id
  AND po.id IN (SELECT purchase_id FROM _import_purchase_map);

-- ─── 8) Mark received (updates stock via trigger) + set historical dates ────

UPDATE public.purchases po
SET
  status = 'received',
  received_date = m.delivery_date::timestamptz,
  order_date = m.delivery_date::timestamptz,
  updated_at = now()
FROM _import_purchase_map m
WHERE po.id = m.purchase_id;

COMMIT;

-- ─── 9) Quick verification ────────────────────────────────────────────────────

SELECT
  po.purchase_number,
  sup.name AS supplier,
  po.order_date::date AS delivery_date,
  po.status,
  po.total,
  count(pi.id) AS line_count
FROM public.purchases po
JOIN public.suppliers sup ON sup.id = po.supplier_id
LEFT JOIN public.purchase_items pi ON pi.purchase_id = po.id
WHERE po.notes = 'Imported from spreadsheet'
GROUP BY po.id, sup.name
ORDER BY po.order_date DESC;
