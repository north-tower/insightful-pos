-- ============================================================================
-- 016 - Add optional payment description
-- Supports notes like "Deposit at invoice creation" on payment entries.
-- ============================================================================

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS description TEXT;
