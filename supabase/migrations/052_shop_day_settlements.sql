-- ============================================================================
-- 052 - Shop day EOD: expense payment channel + shop_day_settlements
-- ============================================================================

-- How an operating expense was paid (affects till reconciliation by channel)
ALTER TABLE public.operating_expenses
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cash';

ALTER TABLE public.operating_expenses
  DROP CONSTRAINT IF EXISTS operating_expenses_payment_method_check;

ALTER TABLE public.operating_expenses
  ADD CONSTRAINT operating_expenses_payment_method_check
  CHECK (payment_method IN ('cash', 'mpesa', 'bank'));

COMMENT ON COLUMN public.operating_expenses.payment_method IS
  'Channel used to pay the expense: cash, mpesa, or bank. Used for shop-day till reconciliation.';

-- ─── Shop day settlements (per store + calendar date) ───────────────────────

CREATE TABLE IF NOT EXISTS public.shop_day_settlements (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id             UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  business_date        DATE NOT NULL,

  opening_float        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (opening_float >= 0),
  closing_float        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (closing_float >= 0),

  expected_cash        NUMERIC(12,2) NOT NULL DEFAULT 0,
  expected_mpesa       NUMERIC(12,2) NOT NULL DEFAULT 0,
  expected_bank        NUMERIC(12,2) NOT NULL DEFAULT 0,

  cash_counted         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cash_counted >= 0),
  mpesa_confirmed      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (mpesa_confirmed >= 0),
  bank_confirmed       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (bank_confirmed >= 0),

  cash_variance        NUMERIC(12,2) NOT NULL DEFAULT 0,
  mpesa_variance       NUMERIC(12,2) NOT NULL DEFAULT 0,
  bank_variance        NUMERIC(12,2) NOT NULL DEFAULT 0,

  notes                TEXT,
  is_finalized         BOOLEAN NOT NULL DEFAULT false,
  finalized_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  finalized_by_name    TEXT,
  finalized_at         TIMESTAMPTZ,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (store_id, business_date)
);

CREATE INDEX IF NOT EXISTS idx_shop_day_settlements_store_date
  ON public.shop_day_settlements(store_id, business_date DESC);

DROP TRIGGER IF EXISTS shop_day_settlements_updated_at ON public.shop_day_settlements;
CREATE TRIGGER shop_day_settlements_updated_at
  BEFORE UPDATE ON public.shop_day_settlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.shop_day_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store members can read shop day settlements" ON public.shop_day_settlements;
CREATE POLICY "Store members can read shop day settlements"
  ON public.shop_day_settlements FOR SELECT
  TO authenticated
  USING (public.can_access_store(store_id));

DROP POLICY IF EXISTS "Admin manager can manage shop day settlements" ON public.shop_day_settlements;
CREATE POLICY "Admin manager can manage shop day settlements"
  ON public.shop_day_settlements FOR ALL
  TO authenticated
  USING (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    public.can_access_store(store_id)
    AND public.get_my_role() IN ('admin', 'manager')
  );

DROP TRIGGER IF EXISTS trg_shop_day_settlements_apply_current_store_id ON public.shop_day_settlements;
CREATE TRIGGER trg_shop_day_settlements_apply_current_store_id
  BEFORE INSERT ON public.shop_day_settlements
  FOR EACH ROW EXECUTE FUNCTION public.apply_current_store_id();
