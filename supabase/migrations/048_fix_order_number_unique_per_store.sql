-- ============================================================================
-- 048 - Fix order_number and invoice_number uniqueness to be per-store
--
-- The original orders table (migration 005) declared:
--   order_number TEXT NOT NULL UNIQUE
--   invoice_number TEXT UNIQUE
--
-- These are globally unique across all stores. After migration 022 introduced
-- store-scoped number generators (generate_order_number, generate_invoice_number),
-- each store starts its own counter from R0001 / INV-YYYY-0001. When a second
-- store creates an order it collides with the first store's number, producing a
-- 409 Conflict (unique-constraint violation) on insert.
--
-- Fix: drop the global unique constraints and replace them with per-store ones.
-- ============================================================================

-- ─── order_number: global → per-store ────────────────────────────────────────

-- Drop the old global unique index (created as a named constraint in 005)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_number_key;
-- Also handle the case where it was created as an unnamed index
DROP INDEX IF EXISTS public.orders_order_number_key;

-- Add per-store uniqueness
ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_number_store_unique
  UNIQUE (store_id, order_number);


-- ─── invoice_number: global → per-store ──────────────────────────────────────

-- Drop the old global unique constraint (added in migration 007)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_invoice_number_key;
DROP INDEX IF EXISTS public.orders_invoice_number_key;

-- Add per-store uniqueness (allow NULL — not every order has an invoice number)
ALTER TABLE public.orders
  ADD CONSTRAINT orders_invoice_number_store_unique
  UNIQUE (store_id, invoice_number);
