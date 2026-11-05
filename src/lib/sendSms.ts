/**
 * Send an SMS notification via the Celcom Africa gateway (Supabase Edge Function).
 *
 * This is intentionally fire-and-forget — it logs errors to the console
 * but never throws, so the calling code is never blocked.
 */
import { supabase } from '@/lib/supabase';
import { SaleOrder } from '@/hooks/useOrders';
import {
  buildAccountPaymentReceivedCustomerMessage,
  buildAccountPaymentReceivedOwnerMessage,
  buildInvoiceCancelledCustomerMessage,
  buildInvoiceCancelledOwnerMessage,
  buildInvoiceCreatedCustomerMessage,
  buildInvoiceCreatedOwnerMessage,
  buildPaymentReceivedCustomerMessage,
  buildPaymentReceivedOwnerMessage,
} from '@/lib/smsMessages';

const OWNER_PHONE = '0799229340';
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
  if (!phone) return; // No phone → no SMS

  const msg = buildInvoiceCreatedCustomerMessage(
    order,
    companyName,
    previousBalance,
    overallBalance,
    consignmentInfo,
  );

  sendSms(phone, msg);

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
  if (!phone) return;

  const msg = buildPaymentReceivedCustomerMessage(
    order,
    paidAmount,
    previousBalance,
    balanceAfter,
    companyName,
    paymentDescription,
  );

  sendSms(phone, msg);

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

  const msg = buildAccountPaymentReceivedCustomerMessage(
    customerName,
    paidAmount,
    previousBalance,
    balanceAfter,
    companyName,
    paymentDescription,
  );

  sendSms(customerPhone, msg);

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
