-- Optional address captured at sale time (e.g. retail cash walk-in).

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_address TEXT;

COMMENT ON COLUMN orders.customer_address IS 'Customer address snapshot on the order (e.g. walk-in retail cash sale).';
