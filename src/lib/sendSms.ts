/**
 * Send an SMS notification via the Celcom Africa gateway (Supabase Edge Function).
 *
 * This is intentionally fire-and-forget — it logs errors to the console
 * but never throws, so the calling code is never blocked.
 */
import { supabase } from '@/lib/supabase';
import { SaleOrder, sumActivePaymentAmount } from '@/hooks/useOrders';
import {
  buildAccountPaymentReceivedCustomerMessage,
  buildAccountPaymentReceivedOwnerMessage,
  buildAccountPaymentReversedCustomerMessage,
  buildAccountPaymentReversedOwnerMessage,
  buildInvoiceCancelledCustomerMessage,
  buildInvoiceCancelledOwnerMessage,
  buildInvoiceCreatedCustomerMessage,
  buildInvoiceCreatedOwnerMessage,
  buildInvoicePaymentReversedCustomerMessage,
  buildInvoicePaymentReversedOwnerMessage,
  buildPaymentReceivedCustomerMessage,
  buildPaymentReceivedOwnerMessage,
} from '@/lib/smsMessages';

const OWNER_PHONE = '0729690592';
const MAIN_STORE_CODE = 'main';

let canSendSmsInCurrentStorePromise: Promise<boolean> | null = null;

async function canSendSmsInCurrentStore(): Promise<boolean> {
  if (!canSendSmsInCurrentStorePromise) {
    canSendSmsInCurrentStorePromise = (async () => {
      try {
        const { data: currentStoreId, error: currentStoreErr } = await supabase.rpc('current_store_id');
        if (currentStoreErr) {
          console.error('Failed to resolve current store for SMS:', currentStoreErr);
          return false;
        }
        if (!currentStoreId) return false;

        const { data: storeData, error: storeErr } = await supabase
          .from('stores')
          .select('code')
          .eq('id', currentStoreId)
          .maybeSingle();

        if (storeErr) {
          console.error('Failed to load store metadata for SMS:', storeErr);
          return false;
        }

        return (storeData?.code || '').toLowerCase() === MAIN_STORE_CODE;
      } catch (err) {
        console.error('SMS store scope check failed:', err);
        return false;
      }
    })();
  }

  return canSendSmsInCurrentStorePromise;
}

/** Normalize Kenya mobiles for the SMS gateway (2547XXXXXXXX). */
export function normalizeKenyaMobile(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('254')) return digits;
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith('7')) return `254${digits}`;
  return digits;
}

export function estimateInvoiceSmsBalances(
  order: SaleOrder,
  customerCreditBalance?: number | null,
): { previousBalance: number; overallBalance: number } {
  const overallBalance = customerCreditBalance ?? order.total;
  const paidAtCreation = sumActivePaymentAmount(order.payments);
  const netIncrease = Math.max(Number(order.total) - paidAtCreation, 0);
  const previousBalance = Math.max(overallBalance - netIncrease, 0);
  return { previousBalance, overallBalance };
}

// ─── Low-level send ────────────────────────────────────────────────────────

async function sendSms(mobile: string, message: string): Promise<void> {
  try {
    const canSend = await canSendSmsInCurrentStore();
    if (!canSend) return;

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
  if (phone) {
    const msg = buildInvoiceCreatedCustomerMessage(
      order,
      companyName,
      previousBalance,
      overallBalance,
      consignmentInfo,
    );
    sendSms(phone, msg);
  }

  const ownerMsg = buildInvoiceCreatedOwnerMessage(
    order,
    companyName,
    previousBalance,
    overallBalance,
    consignmentInfo,
  );
  sendOwnerAlert(ownerMsg);
}

// ─── Credit invoice cancelled ───────────────────────────────────────────────

export function notifyInvoiceCancelled(
  order: SaleOrder,
  companyName: string,
  amountRemovedFromBalance: number,
  previousBalance: number,
  balanceAfter: number,
  totalPaidOnInvoice: number,
  customerPhone?: string,
): void {
  const phone = customerPhone || order.customer_phone;
  if (phone) {
    const msg = buildInvoiceCancelledCustomerMessage(
      order,
      companyName,
      amountRemovedFromBalance,
      previousBalance,
      balanceAfter,
      totalPaidOnInvoice,
    );
    sendSms(phone, msg);
  }

  const ownerMsg = buildInvoiceCancelledOwnerMessage(
    order,
    companyName,
    amountRemovedFromBalance,
    previousBalance,
    balanceAfter,
    totalPaidOnInvoice,
  );
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
  if (phone) {
    const msg = buildPaymentReceivedCustomerMessage(
      order,
      paidAmount,
      previousBalance,
      balanceAfter,
      companyName,
      paymentDescription,
    );
    sendSms(phone, msg);
  }

  const ownerMsg = buildPaymentReceivedOwnerMessage(
    order,
    paidAmount,
    previousBalance,
    balanceAfter,
    companyName,
    paymentDescription,
  );
  sendOwnerAlert(ownerMsg);
}

export function notifyInvoicePaymentReversed(
  order: SaleOrder,
  reversedAmount: number,
  previousBalance: number,
  balanceAfter: number,
  companyName: string,
  customerPhone?: string,
  paymentDescription?: string,
): void {
  const phone = customerPhone || order.customer_phone;
  if (phone) {
    const msg = buildInvoicePaymentReversedCustomerMessage(
      order,
      reversedAmount,
      previousBalance,
      balanceAfter,
      companyName,
      paymentDescription,
    );
    sendSms(phone, msg);
  }

  const ownerMsg = buildInvoicePaymentReversedOwnerMessage(
    order,
    reversedAmount,
    previousBalance,
    balanceAfter,
    companyName,
    paymentDescription,
  );
  sendOwnerAlert(ownerMsg);
}

export function notifyAccountPaymentReversed(
  customerName: string,
  reversedAmount: number,
  previousBalance: number,
  balanceAfter: number,
  companyName: string,
  customerPhone?: string,
  paymentDescription?: string,
): void {
  if (customerPhone) {
    const msg = buildAccountPaymentReversedCustomerMessage(
      customerName,
      reversedAmount,
      previousBalance,
      balanceAfter,
      companyName,
      paymentDescription,
    );
    sendSms(customerPhone, msg);
  }

  const ownerMsg = buildAccountPaymentReversedOwnerMessage(
    customerName,
    reversedAmount,
    previousBalance,
    balanceAfter,
    companyName,
    paymentDescription,
  );
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
  if (customerPhone) {
    const msg = buildAccountPaymentReceivedCustomerMessage(
      customerName,
      paidAmount,
      previousBalance,
      balanceAfter,
      companyName,
      paymentDescription,
    );
    sendSms(customerPhone, msg);
  }

  const ownerMsg = buildAccountPaymentReceivedOwnerMessage(
    customerName,
    paidAmount,
    previousBalance,
    balanceAfter,
    companyName,
    paymentDescription,
  );
  sendOwnerAlert(ownerMsg);
}

/**
 * Manually send (or resend) the credit-invoice SMS to any number — for staff resend / testing.
 * Does not send owner alerts.
 */
export async function sendInvoiceNotificationSms(
  mobile: string,
  order: SaleOrder,
  companyName: string,
  customerCreditBalance?: number | null,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = mobile.trim();
  if (!trimmed) return { ok: false, error: 'Enter a phone number' };

  const normalized = normalizeKenyaMobile(trimmed);
  if (normalized.length < 11) {
    return { ok: false, error: 'Enter a valid Kenya mobile number' };
  }

  const canSend = await canSendSmsInCurrentStore();
  if (!canSend) {
    return { ok: false, error: 'SMS can only be sent from the main store.' };
  }

  const { previousBalance, overallBalance } = estimateInvoiceSmsBalances(
    order,
    customerCreditBalance,
  );
  const msg = buildInvoiceCreatedCustomerMessage(
    order,
    companyName,
    previousBalance,
    overallBalance,
    order.consignment_info,
  );

  try {
    const { data, error } = await supabase.functions.invoke('send-sms', {
      body: { mobile: normalized, message: msg },
    });
    if (error) return { ok: false, error: error.message };
    if (data && typeof data === 'object' && 'error' in data && data.error) {
      return { ok: false, error: String(data.error) };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send SMS';
    return { ok: false, error: message };
  }
}
