import { formatKESForSms } from '@/lib/formatKES';
import type { SaleOrder } from '@/hooks/useOrders';

/** Short GSM-friendly footer (customer + owner). */
export const SMS_FOOTER = '- Insightful POS';

/** @deprecated Use SMS_FOOTER */
export const SMS_APP_SIGNATURE = SMS_FOOTER;

const SMS_MAX_ITEMS = 3;

function formatPaymentNotePart(paymentDescription?: string): string {
  const note = paymentDescription?.trim();
  return note ? ` Note: ${note}.` : '';
}

/** Customer-facing closing line after a payment (settled vs balance due). */
function formatCustomerBalanceAfterLine(balanceAfter: number): string {
  if (balanceAfter <= 0) return 'Your account is fully settled.';
  return `New balance: ${formatKESForSms(Math.max(balanceAfter, 0))}.`;
}

function formatInvoiceDuePart(dueDateIso: string | null | undefined): string {
  if (!dueDateIso) return '';
  const dueDate = new Date(dueDateIso).toLocaleDateString('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  return dueDate ? ` Payment due by ${dueDate}.` : '';
}

function formatConsignmentPart(consignmentInfo?: string, order?: SaleOrder): string {
  const resolved = consignmentInfo?.trim() || order?.consignment_info?.trim();
  return resolved ? ` Consignment: ${resolved}.` : '';
}

export function buildOrderItemsSummary(order: SaleOrder): string {
  if (!order.items || order.items.length === 0) return '';
  const items = order.items.slice(0, SMS_MAX_ITEMS).map((item) => {
    const name = item.product_name || 'Item';
    const qty = Number(item.quantity || 0);
    const unit = formatKESForSms(Number(item.unit_price || 0));
    return `${name} x${qty} @ ${unit}`;
  });
  const remaining = order.items.length - SMS_MAX_ITEMS;
  const more = remaining > 0 ? ` (+${remaining} more)` : '';
  return `${items.join('; ')}${more}`;
}

export function buildInvoiceCreatedCustomerMessage(
  order: SaleOrder,
  companyName: string,
  previousBalance?: number,
  overallBalance?: number,
  consignmentInfo?: string,
): string {
  const invoiceNo = order.invoice_number || order.order_number;
  const amount = formatKESForSms(order.total);
  const prevBalanceAmount = formatKESForSms(Math.max(previousBalance || 0, 0));
  const overallBalanceAmount = formatKESForSms(Math.max(overallBalance || order.total, 0));
  const name = order.customer_name || 'Customer';
  const duePart = formatInvoiceDuePart(order.due_date);
  const consignmentPart = formatConsignmentPart(consignmentInfo, order);
  const itemsSummary = buildOrderItemsSummary(order);
  const itemsPart = itemsSummary ? ` Items: ${itemsSummary}.` : '';

  return `Dear ${name}, invoice #${invoiceNo} for ${amount} has been issued by ${companyName}. Previous balance: ${prevBalanceAmount}. Total balance due: ${overallBalanceAmount}.${itemsPart}${duePart}${consignmentPart} Thank you for your business. ${SMS_FOOTER}`;
}

export function buildInvoiceCancelledCustomerMessage(
  order: SaleOrder,
  companyName: string,
  amountRemovedFromBalance: number,
  previousBalance: number,
  balanceAfter: number,
  totalPaidOnInvoice: number,
): string {
  const invoiceNo = order.invoice_number || order.order_number;
  const invoiceAmount = formatKESForSms(order.total);
  const removed = formatKESForSms(Math.max(amountRemovedFromBalance, 0));
  const previous = formatKESForSms(Math.max(previousBalance, 0));
  const balanceLine = formatCustomerBalanceAfterLine(balanceAfter);
  const name = order.customer_name || 'Customer';
  const shopName = companyName?.trim() || 'Our Shop';
  const depositPart =
    totalPaidOnInvoice > 0
      ? ` Payments totalling ${formatKESForSms(totalPaidOnInvoice)} on this invoice remain on record; contact ${shopName} if you need a cash refund.`
      : '';

  return `Dear ${name}, invoice #${invoiceNo} for ${invoiceAmount} at ${shopName} has been cancelled. ${removed} removed from your account balance. Previous balance: ${previous}. ${balanceLine}${depositPart} Thank you. ${SMS_FOOTER}`;
}

export function buildInvoiceCancelledOwnerMessage(
  order: SaleOrder,
  companyName: string,
  amountRemovedFromBalance: number,
  previousBalance: number,
  balanceAfter: number,
  totalPaidOnInvoice: number,
): string {
  const invoiceNo = order.invoice_number || order.order_number;
  const invoiceAmount = formatKESForSms(order.total);
  const removed = formatKESForSms(Math.max(amountRemovedFromBalance, 0));
  const previous = formatKESForSms(Math.max(previousBalance, 0));
  const balance = formatKESForSms(Math.max(balanceAfter, 0));
  const name = order.customer_name || 'Customer';
  const shopName = companyName?.trim() || 'Our Shop';
  const depositPart =
    totalPaidOnInvoice > 0
      ? ` Deposits on invoice: ${formatKESForSms(totalPaidOnInvoice)} (not auto-refunded).`
      : '';

  return `Owner Alert: Credit invoice #${invoiceNo} for ${name} cancelled at ${shopName}. Invoice: ${invoiceAmount}. Removed from balance: ${removed}. Previous balance: ${previous}. New balance: ${balance}.${depositPart} ${SMS_FOOTER}`;
}

export function buildInvoiceCreatedOwnerMessage(
  order: SaleOrder,
  companyName: string,
  previousBalance?: number,
  overallBalance?: number,
  consignmentInfo?: string,
): string {
  const invoiceNo = order.invoice_number || order.order_number;
  const amount = formatKESForSms(order.total);
  const prevBalanceAmount = formatKESForSms(Math.max(previousBalance || 0, 0));
  const overallBalanceAmount = formatKESForSms(Math.max(overallBalance || order.total, 0));
  const name = order.customer_name || 'Customer';
  const duePart = formatInvoiceDuePart(order.due_date);
  const consignmentPart = formatConsignmentPart(consignmentInfo, order);
  const itemsSummary = buildOrderItemsSummary(order);
  const itemsPart = itemsSummary ? ` Items: ${itemsSummary}.` : '';

  return `Owner Alert: Credit invoice #${invoiceNo} created for ${name} at ${companyName}. Amount: ${amount}. Previous balance: ${prevBalanceAmount}. New balance: ${overallBalanceAmount}.${itemsPart}${duePart}${consignmentPart} ${SMS_FOOTER}`;
}

export function buildPaymentReceivedCustomerMessage(
  order: SaleOrder,
  paidAmount: number,
  previousBalance: number,
  balanceAfter: number,
  companyName: string,
  paymentDescription?: string,
): string {
  const invoiceNo = order.invoice_number || order.order_number;
  const paid = formatKESForSms(paidAmount);
  const previous = formatKESForSms(Math.max(previousBalance, 0));
  const balanceLine = formatCustomerBalanceAfterLine(balanceAfter);
  const name = order.customer_name || 'Customer';
  const shopName = companyName?.trim() || 'Our Shop';
  const descriptionPart = formatPaymentNotePart(paymentDescription);

  return `Dear ${name}, we have received your payment of ${paid} for invoice #${invoiceNo} at ${shopName}. Previous balance: ${previous}. ${balanceLine}${descriptionPart} Thank you for choosing ${shopName}. ${SMS_FOOTER}`;
}

export function buildPaymentReceivedOwnerMessage(
  order: SaleOrder,
  paidAmount: number,
  previousBalance: number,
  balanceAfter: number,
  companyName: string,
  paymentDescription?: string,
): string {
  const invoiceNo = order.invoice_number || order.order_number;
  const paid = formatKESForSms(paidAmount);
  const previous = formatKESForSms(Math.max(previousBalance, 0));
  const balance = formatKESForSms(Math.max(balanceAfter, 0));
  const name = order.customer_name || 'Customer';
  const shopName = companyName?.trim() || 'Our Shop';
  const descriptionPart = formatPaymentNotePart(paymentDescription);

  return `Owner Alert: Payment of ${paid} received from ${name} for invoice #${invoiceNo} at ${shopName}. Previous balance: ${previous}. New balance: ${balance}.${descriptionPart} ${SMS_FOOTER}`;
}

export function buildAccountPaymentReceivedCustomerMessage(
  customerName: string,
  paidAmount: number,
  previousBalance: number,
  balanceAfter: number,
  companyName: string,
  paymentDescription?: string,
): string {
  const paid = formatKESForSms(Math.max(paidAmount, 0));
  const previous = formatKESForSms(Math.max(previousBalance, 0));
  const balanceLine = formatCustomerBalanceAfterLine(balanceAfter);
  const name = customerName || 'Customer';
  const shopName = companyName?.trim() || 'Our Shop';
  const descriptionPart = formatPaymentNotePart(paymentDescription);

  return `Dear ${name}, we have received your payment of ${paid} at ${shopName}. Previous balance: ${previous}. ${balanceLine}${descriptionPart} Thank you for choosing ${shopName}. ${SMS_FOOTER}`;
}

export function buildAccountPaymentReceivedOwnerMessage(
  customerName: string,
  paidAmount: number,
  previousBalance: number,
  balanceAfter: number,
  companyName: string,
  paymentDescription?: string,
): string {
  const paid = formatKESForSms(Math.max(paidAmount, 0));
  const previous = formatKESForSms(Math.max(previousBalance, 0));
  const balance = formatKESForSms(Math.max(balanceAfter, 0));
  const name = customerName || 'Customer';
  const shopName = companyName?.trim() || 'Our Shop';
  const descriptionPart = formatPaymentNotePart(paymentDescription);

  return `Owner Alert: Account payment of ${paid} received from ${name} at ${shopName}. Previous balance: ${previous}. New balance: ${balance}.${descriptionPart} ${SMS_FOOTER}`;
}

export function buildInvoicePaymentReversedCustomerMessage(
  order: SaleOrder,
  reversedAmount: number,
  previousBalance: number,
  balanceAfter: number,
  companyName: string,
  paymentDescription?: string,
): string {
  const invoiceNo = order.invoice_number || order.order_number;
  const reversed = formatKESForSms(Math.max(reversedAmount, 0));
  const previous = formatKESForSms(Math.max(previousBalance, 0));
  const balanceLine = formatCustomerBalanceAfterLine(balanceAfter);
  const name = order.customer_name || 'Customer';
  const shopName = companyName?.trim() || 'Our Shop';
  const descriptionPart = formatPaymentNotePart(paymentDescription);

  return `Dear ${name}, your payment of ${reversed} for invoice #${invoiceNo} at ${shopName} has been reversed. Previous balance: ${previous}. ${balanceLine}${descriptionPart} Thank you. ${SMS_FOOTER}`;
}

export function buildInvoicePaymentReversedOwnerMessage(
  order: SaleOrder,
  reversedAmount: number,
  previousBalance: number,
  balanceAfter: number,
  companyName: string,
  paymentDescription?: string,
): string {
  const invoiceNo = order.invoice_number || order.order_number;
  const reversed = formatKESForSms(Math.max(reversedAmount, 0));
  const previous = formatKESForSms(Math.max(previousBalance, 0));
  const balance = formatKESForSms(Math.max(balanceAfter, 0));
  const name = order.customer_name || 'Customer';
  const shopName = companyName?.trim() || 'Our Shop';
  const descriptionPart = formatPaymentNotePart(paymentDescription);

  return `Owner Alert: Payment reversal of ${reversed} for ${name} on invoice #${invoiceNo} at ${shopName}. Previous balance: ${previous}. New balance: ${balance}.${descriptionPart} ${SMS_FOOTER}`;
}

export function buildAccountPaymentReversedCustomerMessage(
  customerName: string,
  reversedAmount: number,
  previousBalance: number,
  balanceAfter: number,
  companyName: string,
  paymentDescription?: string,
): string {
  const reversed = formatKESForSms(Math.max(reversedAmount, 0));
  const previous = formatKESForSms(Math.max(previousBalance, 0));
  const balanceLine = formatCustomerBalanceAfterLine(balanceAfter);
  const name = customerName || 'Customer';
  const shopName = companyName?.trim() || 'Our Shop';
  const descriptionPart = formatPaymentNotePart(paymentDescription);

  return `Dear ${name}, your account payment of ${reversed} at ${shopName} has been reversed. Previous balance: ${previous}. ${balanceLine}${descriptionPart} Thank you. ${SMS_FOOTER}`;
}

export function buildAccountPaymentReversedOwnerMessage(
  customerName: string,
  reversedAmount: number,
  previousBalance: number,
  balanceAfter: number,
  companyName: string,
  paymentDescription?: string,
): string {
  const reversed = formatKESForSms(Math.max(reversedAmount, 0));
  const previous = formatKESForSms(Math.max(previousBalance, 0));
  const balance = formatKESForSms(Math.max(balanceAfter, 0));
  const name = customerName || 'Customer';
  const shopName = companyName?.trim() || 'Our Shop';
  const descriptionPart = formatPaymentNotePart(paymentDescription);

  return `Owner Alert: Account payment reversal of ${reversed} for ${name} at ${shopName}. Previous balance: ${previous}. New balance: ${balance}.${descriptionPart} ${SMS_FOOTER}`;
}
