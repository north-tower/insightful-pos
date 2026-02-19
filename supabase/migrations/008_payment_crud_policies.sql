-- ─── Payment UPDATE & DELETE policies ───────────────────────────────────────
-- Migration 005 only created SELECT and INSERT policies on payments.
-- We need UPDATE and DELETE so admins/managers can edit or remove payments.

-- UPDATE: admins, managers, and the staff member who created the parent order
CREATE POLICY "Admins and managers can update payments."
  ON payments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND (role = 'admin' OR role = 'manager')
    )
  );

-- DELETE: admins only (destructive action)
CREATE POLICY "Admins can delete payments."
  ON payments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );


-- ─── Trigger: adjust customer balance on payment UPDATE ────────────────────
-- When a payment amount changes, adjust the customer's credit_balance by the
-- difference, then recalculate the order's payment_status.

CREATE OR REPLACE FUNCTION update_customer_on_payment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order    RECORD;
  v_diff     NUMERIC;
  total_paid NUMERIC;
  order_total NUMERIC;
BEGIN
  SELECT sale_type, customer_id, total INTO v_order
  FROM orders WHERE id = NEW.order_id;

  v_diff := NEW.amount - OLD.amount;

  -- Adjust customer balance if credit sale
  IF v_order.sale_type = 'credit' AND v_order.customer_id IS NOT NULL AND v_diff != 0 THEN
    UPDATE customers
    SET credit_balance = GREATEST(credit_balance - v_diff, 0),
        updated_at = now()
    WHERE id = v_order.customer_id;
  END IF;

  -- Recalculate order payment_status
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM payments WHERE order_id = NEW.order_id;

  -- Account for the update (SUM already includes the new row since this is AFTER)
  order_total := v_order.total;

  IF total_paid >= order_total THEN
    UPDATE orders SET payment_status = 'paid' WHERE id = NEW.order_id;
  ELSIF total_paid > 0 THEN
    UPDATE orders SET payment_status = 'partial' WHERE id = NEW.order_id;
  ELSE
    UPDATE orders SET payment_status = 'unpaid' WHERE id = NEW.order_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_update_balance
  AFTER UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_customer_on_payment_update();


-- ─── Trigger: adjust customer balance on payment DELETE ────────────────────
-- When a payment is deleted, add the amount back to the customer's balance
-- and recalculate the order's payment_status.

CREATE OR REPLACE FUNCTION update_customer_on_payment_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order     RECORD;
  total_paid  NUMERIC;
  order_total NUMERIC;
BEGIN
  SELECT sale_type, customer_id, total INTO v_order
  FROM orders WHERE id = OLD.order_id;

  -- Add payment back to customer balance if credit sale
  IF v_order.sale_type = 'credit' AND v_order.customer_id IS NOT NULL THEN
    UPDATE customers
    SET credit_balance = credit_balance + OLD.amount,
        updated_at = now()
    WHERE id = v_order.customer_id;
  END IF;

  -- Recalculate order payment_status
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM payments WHERE order_id = OLD.order_id;

  order_total := v_order.total;

  IF total_paid >= order_total THEN
    UPDATE orders SET payment_status = 'paid' WHERE id = OLD.order_id;
  ELSIF total_paid > 0 THEN
    UPDATE orders SET payment_status = 'partial' WHERE id = OLD.order_id;
  ELSE
    UPDATE orders SET payment_status = 'unpaid' WHERE id = OLD.order_id;
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_payment_delete_balance
  AFTER DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_customer_on_payment_delete();
