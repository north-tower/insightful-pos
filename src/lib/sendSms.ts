/**
 * Send an SMS notification via the Celcom Africa gateway (Supabase Edge Function).
 *
 * This is intentionally fire-and-forget — it logs errors to the console
 * but never throws, so the calling code is never blocked.
 */
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/currency';
import { SaleOrder } from '@/hooks/useOrders';

const APP_SIGNATURE = 'Generated from Insightful POS.';
const OWNER_PHONE = '0729690592';

function buildOrderItemsSummary(order: SaleOrder): string {
  if (!order.items || order.items.length === 0) return '';
  const maxItems = 4;
  const items = order.items.slice(0, maxItems).map((item) => {
    const name = item.product_name || 'Item';
    const qty = Number(item.quantity || 0);
    const unit = formatCurrency(Number(item.unit_price || 0));
    return `${name} x${qty} @ ${unit}`;
  });
  const remaining = order.items.length - maxItems;
  const more = remaining > 0 ? ` +${remaining} more` : '';
  return `${items.join('; ')}${more}`;
}

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

function sendOwnerAlert(message: string): void {
  // Owner alerts are informational and should never block user operations.
  sendSms(OWNER_PHONE, message);
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
  consignmentInfo?: string,
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
  const resolvedConsignment = consignmentInfo?.trim() || order.consignment_info?.trim();
  const consignmentPart = resolvedConsignment
    ? ` Consignment: ${resolvedConsignment}.`
    : '';
  const itemsSummary = buildOrderItemsSummary(order);
  const itemsPart = itemsSummary ? ` Items: ${itemsSummary}.` : '';

  const msg =
    `Dear ${name}, your invoice #${invoiceNo} of ${amount} from ${companyName} has been created. Previous balance: ${prevBalanceAmount}. Overall balance: ${overallBalanceAmount}.${itemsPart}${duePart}${consignmentPart} Thank you for your business. ${APP_SIGNATURE}`;

  // Fire and forget
  sendSms(phone, msg);

  const ownerMsg =
    `Owner Alert: New credit invoice ${invoiceNo} has been created for ${name} at ${companyName}. Invoice amount: ${amount}. Previous balance: ${prevBalanceAmount}. Current account balance: ${overallBalanceAmount}.${itemsPart}${duePart}${consignmentPart} ${APP_SIGNATURE}`;
  sendOwnerAlert(ownerMsg);
}

// ─── Payment received notification ─────────────────────────────────────────

/**
 * Notify a customer that a payment has been received.
 *
 * @param order        The order the payment was applied to
 * @param paidAmount   How much was paid in this transaction
 * @param previousBalance Balance before this payment (account level)
 * @param balanceAfter Remaining balance after payment (account level)
 * @param companyName  Business name to include in the message
 * @param customerPhone  Override phone (e.g. from customer object)
 */
export function notifyPaymentReceived(
  order: SaleOrder,
  paidAmount: number,
  previousBalance: number,
  balanceAfter: number,
  companyName: string,
  customerPhone?: string,
  paymentDescription?: string,
): void {
  const phone = customerPhone || order.customer_phone;
  if (!phone) return;

  const invoiceNo = order.invoice_number || order.order_number;
  const paid = formatCurrency(paidAmount);
  const previous = formatCurrency(Math.max(previousBalance, 0));
  const balance = formatCurrency(Math.max(balanceAfter, 0));
  const name = order.customer_name || 'Customer';
  const shopName = companyName?.trim() || 'Our Shop';
  const descriptionPart = paymentDescription?.trim()
    ? ` Description: ${paymentDescription.trim()}.`
    : '';

  const msg =
    `Dear ${name}, payment received for invoice #${invoiceNo} at ${shopName}. Statement: Previous ${previous} | Paid ${paid} | Balance ${balance}.${descriptionPart} Thank you for choosing ${shopName}. ${APP_SIGNATURE}`;

  sendSms(phone, msg);

  const ownerMsg =
    `Owner Alert: Payment received at ${shopName} for invoice ${invoiceNo}. Customer: ${name}. Paid: ${paid}. Previous balance: ${previous}. New balance: ${balance}.${descriptionPart} ${APP_SIGNATURE}`;
  sendOwnerAlert(ownerMsg);
}

/**
 * Notify a customer that a payment has been applied directly to account balance
 * (not tied to a specific open invoice).
 */
export function notifyAccountPaymentReceived(
  customerName: string,
  paidAmount: number,
  previousBalance: number,
  balanceAfter: number,
  companyName: string,
  customerPhone?: string,
  paymentDescription?: string,
): void {
  if (!customerPhone) return;
  const paid = formatCurrency(Math.max(paidAmount, 0));
  const previous = formatCurrency(Math.max(previousBalance, 0));
  const balance = formatCurrency(Math.max(balanceAfter, 0));
  const name = customerName || 'Customer';
  const shopName = companyName?.trim() || 'Our Shop';
  const descriptionPart = paymentDescription?.trim()
    ? ` Description: ${paymentDescription.trim()}.`
    : '';

  const msg =
    `Dear ${name}, payment received at ${shopName}. Statement: Previous ${previous} | Paid ${paid} | Balance ${balance}.${descriptionPart} Thank you for choosing ${shopName}. ${APP_SIGNATURE}`;

  sendSms(customerPhone, msg);

  const ownerMsg =
    `Owner Alert: Account payment received at ${shopName}. Customer: ${name}. Paid: ${paid}. Previous balance: ${previous}. New balance: ${balance}.${descriptionPart} ${APP_SIGNATURE}`;
  sendOwnerAlert(ownerMsg);
}
