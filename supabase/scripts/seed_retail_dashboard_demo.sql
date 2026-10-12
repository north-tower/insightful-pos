-- ============================================================================
-- Retail dashboard demo data (orders only — products must already exist)
--
-- Populates orders, order_items, and payments for one store so the retail
-- Home dashboard shows takings, charts, recent sales, and top sellers.
--
-- Default store: c6ed20f9-3eb0-4961-a247-5a2907ed8280 (Top Ranch / branch catalog)
-- Line items reference product UUIDs from that store (not SKU — many SKUs are null).
--
-- Safe to re-run: deletes prior rows with notes = '__retail_dashboard_demo__'.
--
-- Timestamps use Africa/Nairobi calendar days — the app filters “today” in the
-- browser’s local timezone (EAT). UTC date_trunc('day', now()) often misses today.
--
-- Run in Supabase SQL Editor (service role), or:
--   supabase db execute --file supabase/scripts/seed_retail_dashboard_demo.sql
-- ============================================================================

DO $$
DECLARE
  v_store_id     UUID := 'c6ed20f9-3eb0-4961-a247-5a2907ed8280';
  v_demo_tag     TEXT := '__retail_dashboard_demo__';
  v_tz           TEXT := 'Africa/Nairobi';
  v_tax_rate     NUMERIC(5,4) := 0.05;
  v_seq          INT := 0;
  v_today_count  INT := 0;
  -- Start of today in local TZ, as timestamptz (matches browser startOfDay for EAT)
  v_local_midnight TIMESTAMPTZ;

  -- Finished goods for this store (from products export)
  p_maziwa_1kg   UUID := 'f78b249d-1f97-4aec-9a93-b92bb3141c09';
  p_maziwa_2kg   UUID := '1008e0d9-eba1-4eda-887f-9f8e4fb88ae2';
  p_maziwa_5kg   UUID := '492f8a83-7359-4867-be03-d621c894b181';
  p_maziwa_10kg  UUID := 'e470dd51-a008-4097-ade0-739a1d72160a';
  p_ap_1kg       UUID := 'e9329074-fb17-4be4-9b9d-2b5c044bb5c5';
  p_ap_2kg       UUID := 'e20e60d4-47ef-463b-8693-c5d1d31d1340';
  p_ap_5kg       UUID := '791cbffe-1822-47e0-bd9b-01d2ac9be37b';
  p_ap_10kg      UUID := '7335506c-99e3-447e-847d-7d9a7b84ead3';
  p_ap_20kg      UUID := 'd064c93c-8bbf-4be3-8d37-75b4d8b21f32';
  p_ap_50kg      UUID := 'b8800c27-001c-4031-84ce-bbe902aceadb';
  p_milk_bo_1kg  UUID := 'd5603994-e386-42f1-90ca-0268374c9279';
  p_milk_bo_2kg  UUID := '9ae68c32-7ebf-4a02-8d82-6cdbeac44ca9';
  p_milk_bo_5kg  UUID := '736648fd-f7c7-4f11-9116-ad55228a6540';
  p_joto_1kg     UUID := '70005641-da80-48e6-a3ea-a4206f9b4108';
  p_dry_cow_1kg  UUID := '0dc150cc-78b4-4f67-b392-b44d0d80f498';
  p_poultry_1l   UUID := '4e55ac7c-fc50-4ef9-861e-586c90081fb5';
  p_poultry_500  UUID := '5efee5c6-3eea-46f3-9376-4c9e4bb9f6b5';
  p_top_yield_1l UUID := '1403ca23-cb29-4038-9c4a-beb0d8aca50e';
  p_top_fruit_1l UUID := '9a3b374d-4c06-4c16-97f9-06b59c6e31a2';

  v_chart_product UUID;

  r              RECORD;
  v_order_id     UUID;
  v_subtotal     NUMERIC(10,2);
  v_tax          NUMERIC(10,2);
  v_total        NUMERIC(10,2);
  v_prod_id      UUID;
  v_qty          INT;
  v_i            INT;
  v_prod_name    TEXT;
  v_unit_price   NUMERIC(10,2);
  v_methods      TEXT[] := ARRAY['cash', 'card', 'qr', 'cash', 'card'];
  v_method       TEXT;
BEGIN
  v_local_midnight := (
    date_trunc('day', timezone(v_tz, now()))
  ) AT TIME ZONE v_tz;

  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = v_store_id) THEN
    RAISE EXCEPTION 'Store % not found.', v_store_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.products
    WHERE store_id = v_store_id AND business_mode = 'retail'
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'No retail products for store %. Import products first.', v_store_id;
  END IF;

  SELECT id INTO v_chart_product
  FROM public.products
  WHERE store_id = v_store_id
    AND business_mode = 'retail'
    AND is_active
    AND price > 0
  ORDER BY price DESC
  LIMIT 1;

  DELETE FROM public.orders
  WHERE store_id = v_store_id
    AND notes = v_demo_tag;

  CREATE TEMP TABLE tmp_demo_sales (
    sold_at        TIMESTAMPTZ NOT NULL,
    customer_name  TEXT,
    product_ids    UUID[] NOT NULL,
    qtys           INT[] NOT NULL
  ) ON COMMIT DROP;

  -- ── Today (local calendar) ────────────────────────────────────────────────
  INSERT INTO tmp_demo_sales (sold_at, customer_name, product_ids, qtys) VALUES
    (v_local_midnight + interval '8 hours 5 minutes',   'Walk-in',       ARRAY[p_maziwa_1kg, p_ap_1kg],        ARRAY[3, 2]),
    (v_local_midnight + interval '9 hours 18 minutes',  'Jane Mwangi',   ARRAY[p_maziwa_5kg],                  ARRAY[1]),
    (v_local_midnight + interval '9 hours 52 minutes',  'Walk-in',       ARRAY[p_milk_bo_2kg, p_joto_1kg],     ARRAY[1, 2]),
    (v_local_midnight + interval '10 hours 30 minutes', 'Peter Ochieng', ARRAY[p_ap_10kg, p_maziwa_2kg],       ARRAY[1, 2]),
    (v_local_midnight + interval '11 hours 10 minutes', 'Grace Wanjiku', ARRAY[p_top_yield_1l, p_poultry_500], ARRAY[1, 2]),
    (v_local_midnight + interval '12 hours 3 minutes',  'Walk-in',       ARRAY[p_ap_5kg, p_maziwa_1kg],        ARRAY[2, 4]),
    (v_local_midnight + interval '13 hours 25 minutes', 'David Kamau',   ARRAY[p_maziwa_10kg],                 ARRAY[1]),
    (v_local_midnight + interval '14 hours 40 minutes', 'Walk-in',       ARRAY[p_maziwa_1kg],                  ARRAY[6]),
    (v_local_midnight + interval '15 hours 15 minutes', 'Lucy Akinyi',   ARRAY[p_milk_bo_5kg, p_dry_cow_1kg],  ARRAY[1, 1]),
    (v_local_midnight + interval '16 hours 8 minutes',  'Walk-in',       ARRAY[p_top_fruit_1l],                ARRAY[1]),
    (v_local_midnight + interval '17 hours 22 minutes', 'Brian Otieno',  ARRAY[p_ap_20kg, p_poultry_1l],       ARRAY[1, 1]),
    (v_local_midnight + interval '18 hours 45 minutes', 'Walk-in',       ARRAY[p_ap_1kg, p_maziwa_2kg],        ARRAY[5, 2]),
    -- Always falls in the app’s “today” window when you re-run the script
    (now() - interval '20 minutes',                    'Walk-in',       ARRAY[p_maziwa_1kg, p_ap_1kg],        ARRAY[1, 1]);

  -- ── Yesterday (lower volume → positive “vs yesterday”) ────────────────────
  INSERT INTO tmp_demo_sales (sold_at, customer_name, product_ids, qtys) VALUES
    (v_local_midnight - interval '1 day' + interval '10 hours',  'Walk-in',     ARRAY[p_ap_1kg],       ARRAY[2]),
    (v_local_midnight - interval '1 day' + interval '12 hours', 'Mary Njeri',  ARRAY[p_milk_bo_1kg],  ARRAY[1]),
    (v_local_midnight - interval '1 day' + interval '14 hours', 'Walk-in',     ARRAY[p_maziwa_2kg],   ARRAY[1]),
    (v_local_midnight - interval '1 day' + interval '15 hours', 'James Mutua', ARRAY[p_joto_1kg],     ARRAY[2]),
    (v_local_midnight - interval '1 day' + interval '16 hours', 'Walk-in',     ARRAY[p_ap_5kg],       ARRAY[1]),
    (v_local_midnight - interval '1 day' + interval '17 hours 30 minutes', 'Walk-in', ARRAY[p_maziwa_1kg], ARRAY[2]);

  -- ── Days 2–6: weekly chart ────────────────────────────────────────────────
  INSERT INTO tmp_demo_sales (sold_at, customer_name, product_ids, qtys) VALUES
    (v_local_midnight - interval '2 days' + interval '10 hours', 'Walk-in',       ARRAY[p_maziwa_1kg, p_ap_1kg], ARRAY[2, 1]),
    (v_local_midnight - interval '2 days' + interval '15 hours', 'Demo Customer', ARRAY[p_maziwa_5kg],           ARRAY[1]),
    (v_local_midnight - interval '3 days' + interval '11 hours', 'Walk-in',       ARRAY[p_ap_2kg, p_milk_bo_2kg], ARRAY[2, 1]),
    (v_local_midnight - interval '3 days' + interval '16 hours', 'Demo Customer', ARRAY[p_poultry_1l],           ARRAY[1]),
    (v_local_midnight - interval '4 days' + interval '9 hours',  'Walk-in',       ARRAY[p_maziwa_1kg],           ARRAY[4]),
    (v_local_midnight - interval '4 days' + interval '14 hours', 'Demo Customer', ARRAY[p_ap_50kg],              ARRAY[1]),
    (v_local_midnight - interval '5 days' + interval '12 hours', 'Walk-in',       ARRAY[p_ap_5kg],               ARRAY[1]),
    (v_local_midnight - interval '5 days' + interval '17 hours', 'Demo Customer', ARRAY[p_top_yield_1l],         ARRAY[1]),
    (v_local_midnight - interval '6 days' + interval '10 hours', 'Walk-in',       ARRAY[p_maziwa_2kg, p_ap_1kg], ARRAY[2, 3]),
    (v_local_midnight - interval '6 days' + interval '15 hours', 'Demo Customer', ARRAY[p_maziwa_1kg],           ARRAY[3]);

  -- ── Days 7–28: monthly chart ──────────────────────────────────────────────
  INSERT INTO tmp_demo_sales (sold_at, customer_name, product_ids, qtys)
  SELECT
    v_local_midnight - (d || ' days')::interval + interval '11 hours',
    'Walk-in',
    ARRAY[v_chart_product],
    ARRAY[1 + (d % 4)]
  FROM generate_series(7, 28, 2) AS d;

  INSERT INTO tmp_demo_sales (sold_at, customer_name, product_ids, qtys)
  SELECT
    v_local_midnight - (d || ' days')::interval + interval '16 hours',
    'Walk-in',
    ARRAY[p_maziwa_1kg],
    ARRAY[1 + ((d + 1) % 3)]
  FROM generate_series(8, 27, 3) AS d;

  FOR r IN SELECT * FROM tmp_demo_sales ORDER BY sold_at LOOP
    v_seq := v_seq + 1;
    v_order_id := gen_random_uuid();
    v_subtotal := 0;
    v_method := v_methods[1 + ((v_seq - 1) % array_length(v_methods, 1))];

    FOR v_i IN 1 .. coalesce(array_length(r.product_ids, 1), 0) LOOP
      v_prod_id := r.product_ids[v_i];
      v_qty := r.qtys[v_i];
      SELECT p.id, p.name, p.price
      INTO v_prod_id, v_prod_name, v_unit_price
      FROM public.products p
      WHERE p.id = r.product_ids[v_i]
        AND p.store_id = v_store_id
        AND p.business_mode = 'retail';

      IF NOT FOUND OR v_unit_price IS NULL OR v_unit_price <= 0 THEN
        RAISE WARNING 'Skipping product % (missing or zero price) for demo sale at %',
          r.product_ids[v_i], r.sold_at;
        CONTINUE;
      END IF;

      v_subtotal := v_subtotal + (v_unit_price * v_qty);
    END LOOP;

    IF v_subtotal <= 0 THEN
      CONTINUE;
    END IF;

    v_tax := round(v_subtotal * v_tax_rate, 2);
    v_total := v_subtotal + v_tax;

    INSERT INTO public.orders (
      id, order_number, invoice_number, store_id, business_mode,
      order_type, source, sale_type, customer_name,
      subtotal, tax_rate, tax_amount, discount_amount, total,
      status, payment_status, notes, staff_id, created_at, completed_at
    ) VALUES (
      v_order_id,
      'DEMO-R-' || lpad(v_seq::text, 5, '0'),
      'DEMO-INV-' || to_char(r.sold_at, 'YYYY') || '-' || lpad(v_seq::text, 5, '0'),
      v_store_id, 'retail', 'pos', 'pos', 'cash', r.customer_name,
      v_subtotal, v_tax_rate, v_tax, 0, v_total,
      'completed', 'paid', v_demo_tag, NULL,
      r.sold_at, r.sold_at + interval '2 minutes'
    );

    FOR v_i IN 1 .. coalesce(array_length(r.product_ids, 1), 0) LOOP
      v_prod_id := r.product_ids[v_i];
      v_qty := r.qtys[v_i];
      SELECT p.id, p.name, p.price
      INTO v_prod_id, v_prod_name, v_unit_price
      FROM public.products p
      WHERE p.id = r.product_ids[v_i]
        AND p.store_id = v_store_id
        AND p.business_mode = 'retail';

      IF NOT FOUND OR v_unit_price IS NULL OR v_unit_price <= 0 THEN
        CONTINUE;
      END IF;

      INSERT INTO public.order_items (
        order_id, store_id, product_id, product_name, unit_price, quantity, line_total
      ) VALUES (
        v_order_id, v_store_id, v_prod_id, v_prod_name, v_unit_price, v_qty,
        round(v_unit_price * v_qty, 2)
      );
    END LOOP;

    INSERT INTO public.payments (order_id, store_id, method, amount, paid_at)
    VALUES (v_order_id, v_store_id, v_method, v_total, r.sold_at);

    IF r.sold_at >= v_local_midnight AND r.sold_at < v_local_midnight + interval '1 day' THEN
      v_today_count := v_today_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Retail dashboard demo: % orders inserted (% dated today in %). Store %.',
    v_seq, v_today_count, v_tz, v_store_id;
  RAISE NOTICE 'Local midnight anchor: % — hard-refresh app dashboard (Refresh button).',
    v_local_midnight;

  IF v_today_count = 0 THEN
    RAISE WARNING 'No today orders created — check product IDs exist for this store with price > 0.';
  END IF;
END;
$$;

-- Verify (SQL editor): demo orders dated today in Nairobi
-- SELECT count(*), min(created_at), max(created_at)
-- FROM public.orders
-- WHERE notes = '__retail_dashboard_demo__'
--   AND store_id = 'c6ed20f9-3eb0-4961-a247-5a2907ed8280'
--   AND created_at >= (date_trunc('day', timezone('Africa/Nairobi', now())) AT TIME ZONE 'Africa/Nairobi');
