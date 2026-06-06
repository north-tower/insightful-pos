-- ============================================================================
-- 045 - Remove legacy number generators that conflict with store-scoped versions
-- PostgREST cannot call generate_purchase_number() when both of these exist:
--   generate_purchase_number()
--   generate_purchase_number(p_store_id uuid)
-- ============================================================================

DROP FUNCTION IF EXISTS public.generate_purchase_number();

DROP FUNCTION IF EXISTS public.generate_invoice_number();
