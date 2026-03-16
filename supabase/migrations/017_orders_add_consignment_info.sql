-- ============================================================================
-- 017 - Add optional consignment details to orders/invoices
-- ============================================================================

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS consignment_info TEXT;
