/**
 * Send an SMS notification via the Celcom Africa gateway (Supabase Edge Function).
 *
 * This is intentionally fire-and-forget — it logs errors to the console
 * but never throws, so the calling code is never blocked.
 */
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/currency';
import { SaleOrder } from '@/hooks/useOrders';

// ─── Low-level send ────────────────────────────────────────────────────────

async function sendSms(mobile: string, message: string): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('send-sms', {
      body: { mobile, message },
    });
    if (error) console.error('SMS send error:', error);
  } catch (err) {
    console.error('SMS send failed:', err);
  }
}

// ─── Invoice created notification ──────────────────────────────────────────

/**
 * Notify a customer that a credit invoice has been created.
 *
 * @param order        The newly created order
 * @param companyName  Business name to include in the message
 * @param previousBalance  Customer balance before this invoice
 * @param overallBalance   Customer cumulative balance after this invoice
 */
export function notifyInvoiceCreated(
  order: SaleOrder,
  companyName: string,
  previousBalance?: number,
  overallBalance?: number,
): void {
  const phone = order.customer_phone;
  if (!phone) return; // No phone → no SMS

  const invoiceNo = order.invoice_number || order.order_number;
  const amount = formatCurrency(order.total);
  const prevBalanceAmount = formatCurrency(Math.max(previousBalance || 0, 0));
  const overallBalanceAmount = formatCurrency(Math.max(overallBalance || order.total, 0));
  const dueDate = order.due_date
    ? new Date(order.due_date).toLocaleDateString('en-KE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '';

  const name = order.customer_name || 'Customer';
  const duePart = dueDate ? ` Due: ${dueDate}.` : '';

  const msg =
    `Dear ${name}, your invoice #${invoiceNo} of ${amount} from ${companyName} has been created. Previous balance: ${prevBalanceAmount}. Overall balance: ${overallBalanceAmount}.${duePart} Thank you for your business.`;

  // Fire and forget
  sendSms(phone, msg);
}

// ─── Payment received notification ─────────────────────────────────────────

/**
 * Notify a customer that a payment has been received.
 *
 * @param order        The order the payment was applied to
 * @param paidAmount   How much was paid in this transaction
 * @param balanceAfter Remaining balance on the order after payment
 * @param companyName  Business name to include in the message
 * @param customerPhone  Override phone (e.g. from customer object)
 */
export function notifyPaymentReceived(
  order: SaleOrder,
  paidAmount: number,
  balanceAfter: number,
  companyName: string,
  customerPhone?: string,
): void {
  const phone = customerPhone || order.customer_phone;
  if (!phone) return;

  const invoiceNo = order.invoice_number || order.order_number;
  const paid = formatCurrency(paidAmount);
  const balance = formatCurrency(balanceAfter);
  const name = order.customer_name || 'Customer';

  const msg =
    `Dear ${name}, we have received your payment of ${paid} for invoice #${invoiceNo}. Balance: ${balance}. Thank you! - ${companyName}`;

  sendSms(phone, msg);
}
