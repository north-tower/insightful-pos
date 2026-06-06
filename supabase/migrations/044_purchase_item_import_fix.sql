-- ============================================================================
-- 044 - Fix purchase_items import when parent purchase has NULL store_id
-- The old trigger treated "purchase missing" and "store_id IS NULL" the same.
-- ============================================================================

-- Backfill purchases missing store_id (common after CSV import)
UPDATE public.purchases p
SET store_id = s.id,
    updated_at = now()
FROM public.stores s
WHERE s.code = 'main'
  AND p.store_id IS NULL;

CREATE OR REPLACE FUNCTION public.sync_purchase_item_store_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_purchase_exists BOOLEAN;
  v_purchase_store_id UUID;
BEGIN
  SELECT TRUE, store_id
  INTO v_purchase_exists, v_purchase_store_id
  FROM public.purchases
  WHERE id = NEW.purchase_id;

  IF NOT COALESCE(v_purchase_exists, FALSE) THEN
    RAISE EXCEPTION 'Purchase not found for purchase_id %', NEW.purchase_id;
  END IF;

  IF v_purchase_store_id IS NULL THEN
    v_purchase_store_id := public.default_import_store_id();
    IF v_purchase_store_id IS NULL THEN
      RAISE EXCEPTION 'Purchase % has no store_id and no default store is configured', NEW.purchase_id;
    END IF;

    UPDATE public.purchases
    SET store_id = v_purchase_store_id,
        updated_at = now()
    WHERE id = NEW.purchase_id
      AND store_id IS NULL;
  END IF;

  IF NEW.store_id IS NULL THEN
    NEW.store_id := v_purchase_store_id;
  ELSIF NEW.store_id <> v_purchase_store_id THEN
    RAISE EXCEPTION 'purchase_items.store_id must match parent purchase store';
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.can_access_store(NEW.store_id) THEN
    RAISE EXCEPTION 'Access denied for store %', NEW.store_id;
  END IF;

  RETURN NEW;
END;
$$;
