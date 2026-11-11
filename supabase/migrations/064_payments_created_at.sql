-- ============================================================================
-- 064 - payments.created_at (system record time; paid_at remains business date)
-- ============================================================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

UPDATE public.payments
SET created_at = paid_at
WHERE created_at IS NULL;

ALTER TABLE public.payments
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_created_at
  ON public.payments (created_at DESC);
