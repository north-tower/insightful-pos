-- ============================================================================
-- 011 – Stock adjustments when purchase items are added/removed
-- Handles the case where a RECEIVED purchase is edited (items changed).
-- The existing trigger (010) handles the initial status change to 'received'.
-- These new triggers handle item-level changes on already-received purchases.
-- ============================================================================

-- ─── When a purchase item is INSERTED into a received purchase ──────────────
-- (e.g. editing a received PO adds new items → increase stock)

CREATE OR REPLACE FUNCTION adjust_stock_on_purchase_item_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_purchase RECORD;
  prev_stock INT;
BEGIN
  -- Only adjust stock if the parent purchase is already 'received'
  SELECT status, purchase_number, staff_id
  INTO v_purchase
  FROM public.purchases
  WHERE id = NEW.purchase_id;

  IF v_purchase.status = 'received' AND NEW.product_id IS NOT NULL THEN
    SELECT COALESCE(stock, 0) INTO prev_stock
    FROM public.products
    WHERE id = NEW.product_id;

    UPDATE public.products
    SET stock = prev_stock + NEW.quantity,
        updated_at = now()
    WHERE id = NEW.product_id;

    INSERT INTO public.stock_adjustments
      (product_id, type, quantity, previous_stock, new_stock, note, staff_id)
    VALUES
      (NEW.product_id, 'restock', NEW.quantity,
       prev_stock, prev_stock + NEW.quantity,
       'Purchase ' || v_purchase.purchase_number || ' (edit)',
       v_purchase.staff_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_purchase_item_insert_stock
  AFTER INSERT ON public.purchase_items
  FOR EACH ROW EXECUTE FUNCTION adjust_stock_on_purchase_item_insert();


-- ─── When a purchase item is DELETED from a received purchase ───────────────
-- (e.g. editing a received PO removes old items → decrease stock)

CREATE OR REPLACE FUNCTION adjust_stock_on_purchase_item_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_purchase RECORD;
  prev_stock INT;
BEGIN
  SELECT status, purchase_number, staff_id
  INTO v_purchase
  FROM public.purchases
  WHERE id = OLD.purchase_id;

  IF v_purchase.status = 'received' AND OLD.product_id IS NOT NULL THEN
    SELECT COALESCE(stock, 0) INTO prev_stock
    FROM public.products
    WHERE id = OLD.product_id;

    UPDATE public.products
    SET stock = GREATEST(prev_stock - OLD.quantity, 0),
        updated_at = now()
    WHERE id = OLD.product_id;

    INSERT INTO public.stock_adjustments
      (product_id, type, quantity, previous_stock, new_stock, note, staff_id)
    VALUES
      (OLD.product_id, 'adjustment', -OLD.quantity,
       prev_stock, GREATEST(prev_stock - OLD.quantity, 0),
       'Purchase ' || v_purchase.purchase_number || ' (edit — item removed)',
       v_purchase.staff_id);
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_purchase_item_delete_stock
  AFTER DELETE ON public.purchase_items
  FOR EACH ROW EXECUTE FUNCTION adjust_stock_on_purchase_item_delete();
