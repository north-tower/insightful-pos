-- ============================================================================
-- 039 - Retail production Phase 1
-- Product types (raw/finished), fixed recipes, production batches, cost roll-up
-- ============================================================================

-- ─── Product type + fractional stock for raw materials ─────────────────────

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'finished'
  CHECK (product_type IN ('finished', 'raw'));

UPDATE public.products
SET product_type = 'finished'
WHERE product_type IS NULL;

ALTER TABLE public.products
  ALTER COLUMN stock TYPE NUMERIC(12,4)
  USING COALESCE(stock, 0)::NUMERIC(12,4);

ALTER TABLE public.stock_adjustments
  ALTER COLUMN quantity TYPE NUMERIC(12,4) USING quantity::NUMERIC(12,4),
  ALTER COLUMN previous_stock TYPE NUMERIC(12,4) USING previous_stock::NUMERIC(12,4),
  ALTER COLUMN new_stock TYPE NUMERIC(12,4) USING new_stock::NUMERIC(12,4);

ALTER TABLE public.stock_adjustments
  DROP CONSTRAINT IF EXISTS stock_adjustments_type_check;

ALTER TABLE public.stock_adjustments
  ADD CONSTRAINT stock_adjustments_type_check
  CHECK (type IN (
    'restock', 'damaged', 'returned', 'sold', 'adjustment',
    'production_in', 'production_out'
  ));

-- ─── Recipe (BOM) lines ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.product_recipe_lines (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id             UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  finished_product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ingredient_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity_per_unit    NUMERIC(12,4) NOT NULL CHECK (quantity_per_unit > 0),
  sort_order           INT NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (finished_product_id, ingredient_product_id),
  CHECK (finished_product_id <> ingredient_product_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_lines_finished
  ON public.product_recipe_lines(finished_product_id);

CREATE INDEX IF NOT EXISTS idx_recipe_lines_store
  ON public.product_recipe_lines(store_id);

DROP TRIGGER IF EXISTS product_recipe_lines_updated_at ON public.product_recipe_lines;
CREATE TRIGGER product_recipe_lines_updated_at
  BEFORE UPDATE ON public.product_recipe_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_recipe_lines_apply_current_store_id ON public.product_recipe_lines;
CREATE TRIGGER trg_recipe_lines_apply_current_store_id
  BEFORE INSERT ON public.product_recipe_lines
  FOR EACH ROW EXECUTE FUNCTION public.apply_current_store_id();

ALTER TABLE public.product_recipe_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members can read recipe lines"
  ON public.product_recipe_lines FOR SELECT
  TO authenticated
  USING (public.can_access_store(store_id));

CREATE POLICY "Admin manager can manage recipe lines"
  ON public.product_recipe_lines FOR ALL
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

-- ─── Production batches ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.production_batches (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id             UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  batch_number         TEXT NOT NULL,
  finished_product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  planned_qty          NUMERIC(12,4) NOT NULL CHECK (planned_qty > 0),
  actual_qty           NUMERIC(12,4) NOT NULL CHECK (actual_qty > 0),
  status               TEXT NOT NULL DEFAULT 'completed'
                       CHECK (status IN ('draft', 'completed', 'cancelled')),
  material_cost_total  NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_cost            NUMERIC(12,4) NOT NULL DEFAULT 0,
  produced_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at           TIMESTAMPTZ,
  notes                TEXT,
  staff_id             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  staff_name           TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_production_batches_store_date
  ON public.production_batches(store_id, produced_at DESC);

CREATE INDEX IF NOT EXISTS idx_production_batches_product
  ON public.production_batches(finished_product_id);

DROP TRIGGER IF EXISTS production_batches_updated_at ON public.production_batches;
CREATE TRIGGER production_batches_updated_at
  BEFORE UPDATE ON public.production_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_production_batches_apply_current_store_id ON public.production_batches;
CREATE TRIGGER trg_production_batches_apply_current_store_id
  BEFORE INSERT ON public.production_batches
  FOR EACH ROW EXECUTE FUNCTION public.apply_current_store_id();

ALTER TABLE public.production_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members can read production batches"
  ON public.production_batches FOR SELECT
  TO authenticated
  USING (public.can_access_store(store_id));

CREATE POLICY "Admin manager can insert production batches"
  ON public.production_batches FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

-- ─── Batch consumption snapshot ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.production_batch_consumption (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id               UUID NOT NULL REFERENCES public.production_batches(id) ON DELETE CASCADE,
  store_id               UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  ingredient_product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  ingredient_name        TEXT NOT NULL DEFAULT '',
  quantity_consumed      NUMERIC(12,4) NOT NULL CHECK (quantity_consumed > 0),
  unit                   TEXT NOT NULL DEFAULT 'pcs',
  unit_cost              NUMERIC(12,4) NOT NULL DEFAULT 0,
  line_cost              NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_batch_consumption_batch
  ON public.production_batch_consumption(batch_id);

ALTER TABLE public.production_batch_consumption ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members can read batch consumption"
  ON public.production_batch_consumption FOR SELECT
  TO authenticated
  USING (public.can_access_store(store_id));

CREATE POLICY "Admin manager can insert batch consumption"
  ON public.production_batch_consumption FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

-- ─── Batch number generator ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_production_batch_number(
  p_store_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_id UUID;
  v_seq BIGINT;
  v_date TEXT;
BEGIN
  v_store_id := COALESCE(p_store_id, public.current_store_id());
  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'No store selected';
  END IF;

  IF NOT public.can_access_store(v_store_id) THEN
    RAISE EXCEPTION 'Access denied for this store';
  END IF;

  v_date := to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD');
  v_seq := public.next_store_counter_value(v_store_id, 'production_batch', 1);

  RETURN 'PRD-' || v_date || '-' || lpad(v_seq::TEXT, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_production_batch_number(UUID)
  TO authenticated;

-- ─── Replace recipe lines for a finished product ─────────────────────────────

CREATE OR REPLACE FUNCTION public.save_product_recipe(
  p_finished_product_id UUID,
  p_lines JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_id UUID;
  v_role TEXT;
  v_finished RECORD;
  v_line JSONB;
  v_ingredient_id UUID;
  v_qty NUMERIC;
  v_ingredient RECORD;
  v_sort INT := 0;
BEGIN
  v_role := public.get_my_role();
  IF v_role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_store_id := public.current_store_id();
  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'No store selected';
  END IF;

  SELECT id, product_type, business_mode, store_id
  INTO v_finished
  FROM public.products
  WHERE id = p_finished_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Finished product not found';
  END IF;

  IF v_finished.store_id IS DISTINCT FROM v_store_id THEN
    RAISE EXCEPTION 'Product belongs to another store';
  END IF;

  IF v_finished.business_mode <> 'retail' THEN
    RAISE EXCEPTION 'Recipes are only supported for retail products';
  END IF;

  IF v_finished.product_type <> 'finished' THEN
    RAISE EXCEPTION 'Recipes can only be defined on finished products';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' THEN
    RAISE EXCEPTION 'Recipe lines must be a JSON array';
  END IF;

  DELETE FROM public.product_recipe_lines
  WHERE finished_product_id = p_finished_product_id
    AND store_id = v_store_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_ingredient_id := (v_line->>'ingredient_product_id')::UUID;
    v_qty := (v_line->>'quantity_per_unit')::NUMERIC;

    IF v_ingredient_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Each recipe line requires ingredient_product_id and quantity_per_unit > 0';
    END IF;

    SELECT id, name, product_type, business_mode, store_id
    INTO v_ingredient
    FROM public.products
    WHERE id = v_ingredient_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ingredient product not found: %', v_ingredient_id;
    END IF;

    IF v_ingredient.product_type <> 'raw' THEN
      RAISE EXCEPTION 'Ingredient "%" must be a raw material product', v_ingredient.name;
    END IF;

    IF v_ingredient.store_id IS DISTINCT FROM v_store_id THEN
      RAISE EXCEPTION 'Ingredient belongs to another store';
    END IF;

    v_sort := v_sort + 1;

    INSERT INTO public.product_recipe_lines (
      store_id,
      finished_product_id,
      ingredient_product_id,
      quantity_per_unit,
      sort_order
    ) VALUES (
      v_store_id,
      p_finished_product_id,
      v_ingredient_id,
      v_qty,
      COALESCE((v_line->>'sort_order')::INT, v_sort)
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_product_recipe(UUID, JSONB)
  TO authenticated;

-- ─── Complete a production batch (atomic) ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.complete_production_batch(
  p_finished_product_id UUID,
  p_actual_qty NUMERIC,
  p_planned_qty NUMERIC DEFAULT NULL,
  p_batch_number TEXT DEFAULT NULL,
  p_produced_at TIMESTAMPTZ DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.production_batches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_id UUID;
  v_role TEXT;
  v_staff RECORD;
  v_finished RECORD;
  v_batch public.production_batches;
  v_batch_number TEXT;
  v_recipe RECORD;
  v_ingredient RECORD;
  v_required NUMERIC;
  v_prev_stock NUMERIC;
  v_new_stock NUMERIC;
  v_unit_cost NUMERIC;
  v_line_cost NUMERIC;
  v_material_total NUMERIC := 0;
  v_batch_unit_cost NUMERIC;
  v_finished_prev_stock NUMERIC;
  v_finished_new_stock NUMERIC;
  v_finished_prev_cost NUMERIC;
  v_finished_new_cost NUMERIC;
  v_produced_at TIMESTAMPTZ;
  v_planned NUMERIC;
BEGIN
  v_role := public.get_my_role();
  IF v_role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Access denied: production requires admin or manager role';
  END IF;

  v_store_id := public.current_store_id();
  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'No store selected';
  END IF;

  IF p_actual_qty IS NULL OR p_actual_qty <= 0 THEN
    RAISE EXCEPTION 'Actual quantity must be greater than zero';
  END IF;

  v_planned := COALESCE(NULLIF(p_planned_qty, 0), p_actual_qty);
  IF v_planned <= 0 THEN
    RAISE EXCEPTION 'Planned quantity must be greater than zero';
  END IF;

  SELECT id, name, product_type, business_mode, store_id, stock, cost, unit
  INTO v_finished
  FROM public.products
  WHERE id = p_finished_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Finished product not found';
  END IF;

  IF v_finished.store_id IS DISTINCT FROM v_store_id THEN
    RAISE EXCEPTION 'Product belongs to another store';
  END IF;

  IF v_finished.business_mode <> 'retail' THEN
    RAISE EXCEPTION 'Production is only supported for retail products';
  END IF;

  IF v_finished.product_type <> 'finished' THEN
    RAISE EXCEPTION 'Only finished products can be produced';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.product_recipe_lines
    WHERE finished_product_id = p_finished_product_id
      AND store_id = v_store_id
  ) THEN
    RAISE EXCEPTION 'No recipe defined for this product';
  END IF;

  SELECT p.id, p.full_name
  INTO v_staff
  FROM public.profiles p
  WHERE p.id = auth.uid();

  -- Validate stock availability before mutating
  FOR v_recipe IN
    SELECT rl.*, p.name AS ingredient_name, p.stock AS ingredient_stock,
           p.cost AS ingredient_cost, p.unit AS ingredient_unit
    FROM public.product_recipe_lines rl
    INNER JOIN public.products p ON p.id = rl.ingredient_product_id
    WHERE rl.finished_product_id = p_finished_product_id
      AND rl.store_id = v_store_id
    ORDER BY rl.sort_order, rl.created_at
  LOOP
    v_required := ROUND(v_recipe.quantity_per_unit * p_actual_qty, 4);
    IF COALESCE(v_recipe.ingredient_stock, 0) < v_required THEN
      RAISE EXCEPTION 'Insufficient stock for "%": need %, have %',
        v_recipe.ingredient_name, v_required, COALESCE(v_recipe.ingredient_stock, 0);
    END IF;
  END LOOP;

  v_batch_number := NULLIF(trim(p_batch_number), '');
  IF v_batch_number IS NULL THEN
    v_batch_number := public.generate_production_batch_number(v_store_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.production_batches
    WHERE store_id = v_store_id AND batch_number = v_batch_number
  ) THEN
    RAISE EXCEPTION 'Batch number already exists: %', v_batch_number;
  END IF;

  v_produced_at := COALESCE(p_produced_at, now());

  INSERT INTO public.production_batches (
    store_id,
    batch_number,
    finished_product_id,
    planned_qty,
    actual_qty,
    status,
    produced_at,
    expires_at,
    notes,
    staff_id,
    staff_name
  ) VALUES (
    v_store_id,
    v_batch_number,
    p_finished_product_id,
    v_planned,
    p_actual_qty,
    'completed',
    v_produced_at,
    p_expires_at,
    NULLIF(trim(p_notes), ''),
    v_staff.id,
    v_staff.full_name
  )
  RETURNING * INTO v_batch;

  -- Consume ingredients
  FOR v_recipe IN
    SELECT rl.*, p.name AS ingredient_name, p.stock AS ingredient_stock,
           p.cost AS ingredient_cost, p.unit AS ingredient_unit
    FROM public.product_recipe_lines rl
    INNER JOIN public.products p ON p.id = rl.ingredient_product_id
    WHERE rl.finished_product_id = p_finished_product_id
      AND rl.store_id = v_store_id
    ORDER BY rl.sort_order, rl.created_at
    FOR UPDATE OF p
  LOOP
    v_required := ROUND(v_recipe.quantity_per_unit * p_actual_qty, 4);
    v_unit_cost := COALESCE(v_recipe.ingredient_cost, 0);
    v_line_cost := ROUND(v_required * v_unit_cost, 2);
    v_material_total := v_material_total + v_line_cost;

    SELECT stock INTO v_prev_stock
    FROM public.products
    WHERE id = v_recipe.ingredient_product_id
    FOR UPDATE;

    v_new_stock := GREATEST(COALESCE(v_prev_stock, 0) - v_required, 0);

    UPDATE public.products
    SET stock = v_new_stock,
        updated_at = now()
    WHERE id = v_recipe.ingredient_product_id;

    INSERT INTO public.production_batch_consumption (
      batch_id,
      store_id,
      ingredient_product_id,
      ingredient_name,
      quantity_consumed,
      unit,
      unit_cost,
      line_cost
    ) VALUES (
      v_batch.id,
      v_store_id,
      v_recipe.ingredient_product_id,
      v_recipe.ingredient_name,
      v_required,
      COALESCE(v_recipe.ingredient_unit, 'pcs'),
      v_unit_cost,
      v_line_cost
    );

    INSERT INTO public.stock_adjustments (
      product_id,
      store_id,
      type,
      quantity,
      previous_stock,
      new_stock,
      note,
      staff_id
    ) VALUES (
      v_recipe.ingredient_product_id,
      v_store_id,
      'production_out',
      -v_required,
      COALESCE(v_prev_stock, 0),
      v_new_stock,
      'Production batch ' || v_batch_number,
      v_staff.id
    );
  END LOOP;

  v_batch_unit_cost := CASE
    WHEN p_actual_qty > 0 THEN ROUND(v_material_total / p_actual_qty, 4)
    ELSE 0
  END;

  v_finished_prev_stock := COALESCE(v_finished.stock, 0);
  v_finished_prev_cost := COALESCE(v_finished.cost, 0);
  v_finished_new_stock := v_finished_prev_stock + p_actual_qty;

  v_finished_new_cost := CASE
    WHEN v_finished_new_stock > 0 THEN
      ROUND(
        ((v_finished_prev_stock * v_finished_prev_cost) + (p_actual_qty * v_batch_unit_cost))
        / v_finished_new_stock,
        4
      )
    ELSE v_batch_unit_cost
  END;

  UPDATE public.products
  SET stock = v_finished_new_stock,
      cost = v_finished_new_cost,
      updated_at = now()
  WHERE id = p_finished_product_id;

  INSERT INTO public.stock_adjustments (
    product_id,
    store_id,
    type,
    quantity,
    previous_stock,
    new_stock,
    note,
    staff_id
  ) VALUES (
    p_finished_product_id,
    v_store_id,
    'production_in',
    p_actual_qty,
    v_finished_prev_stock,
    v_finished_new_stock,
    'Production batch ' || v_batch_number,
    v_staff.id
  );

  UPDATE public.production_batches
  SET material_cost_total = ROUND(v_material_total, 2),
      unit_cost = v_batch_unit_cost
  WHERE id = v_batch.id
  RETURNING * INTO v_batch;

  RETURN v_batch;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_production_batch(
  UUID, NUMERIC, NUMERIC, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT
) TO authenticated;
