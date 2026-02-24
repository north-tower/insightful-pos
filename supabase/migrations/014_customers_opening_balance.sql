-- ============================================================================
-- 014 - Add customers.opening_balance for migration support
-- Stores the initial migrated balance separately from the running credit balance.
-- ============================================================================

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Backfill existing rows so historical records remain consistent.
UPDATE customers
SET opening_balance = credit_balance
WHERE opening_balance = 0
  AND credit_balance > 0;
