-- ============================================================================
-- 031 - Preserve cashier allocation history per issuance
-- After a return, re-issuing should create a NEW row (history-safe).
-- ============================================================================

-- Remove strict unique constraint that forced one row forever per cashier/product/store.
ALTER TABLE public.cashier_stock_allocations
  DROP CONSTRAINT IF EXISTS cashier_stock_allocations_store_id_cashier_id_product_id_key;

-- Enforce at most one ACTIVE allocation at a time for same cashier/product/store.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cashier_allocations_unique_active
  ON public.cashier_stock_allocations(store_id, cashier_id, product_id)
  WHERE is_active = true;
