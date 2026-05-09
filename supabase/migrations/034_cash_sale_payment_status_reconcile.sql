-- Reconcile orders.payment_status whenever a payment row is inserted.
-- Previously only credit+customer orders were updated; cash retail sales stayed "unpaid"
-- after recording payment, hiding refund UI and skewing reports.

CREATE OR REPLACE FUNCTION public.update_customer_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order RECORD;
  total_paid NUMERIC;
  order_total NUMERIC;
BEGIN
  SELECT sale_type, customer_id, store_id, total
  INTO v_order
  FROM public.orders
  WHERE id = NEW.order_id;

  IF v_order.sale_type = 'credit'
     AND v_order.customer_id IS NOT NULL
     AND v_order.store_id = NEW.store_id THEN
    UPDATE public.customers
    SET credit_balance = GREATEST(credit_balance - NEW.amount, 0),
        updated_at = now()
    WHERE id = v_order.customer_id
      AND store_id = NEW.store_id;
  END IF;

  -- All sale types: derive payment_status from payments vs order total
  IF v_order.store_id = NEW.store_id THEN
    SELECT COALESCE(SUM(amount), 0)
    INTO total_paid
    FROM public.payments
    WHERE order_id = NEW.order_id
      AND store_id = NEW.store_id;

    order_total := v_order.total;

    IF total_paid >= order_total THEN
      UPDATE public.orders
      SET payment_status = 'paid'
      WHERE id = NEW.order_id
        AND store_id = NEW.store_id;
    ELSIF total_paid > 0 THEN
      UPDATE public.orders
      SET payment_status = 'partial'
      WHERE id = NEW.order_id
        AND store_id = NEW.store_id;
    ELSE
      UPDATE public.orders
      SET payment_status = 'unpaid'
      WHERE id = NEW.order_id
        AND store_id = NEW.store_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
