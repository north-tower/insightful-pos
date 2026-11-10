import type { PaymentMethod } from '@/hooks/useOrders';

/**
 * Display label for stored payment method values (does not change stored values).
 *
 * Stored values in the app: cash | card | qr | mpesa (plus pseudo "split" on receipts).
 * Filter UI uses "bank" (not stored).
 */
export function getPaymentMethodLabel(method: string): string {
  switch (method as PaymentMethod) {
    case 'cash':
      return 'Cash';
    case 'mpesa':
    case 'qr':
      return 'M-Pesa';
    case 'card':
      return 'Bank transfer';
    default:
      return method;
  }
}

/** Optional reference field label keyed off stored method (labels only). */
export function getPaymentReferenceFieldLabel(method: string): string {
  switch (method as PaymentMethod) {
    case 'mpesa':
    case 'qr':
      return 'M-Pesa code';
    case 'card':
      return 'Bank reference';
    case 'cash':
      return 'Reference (optional)';
    default:
      return 'Reference (optional)';
  }
}

/** @deprecated Use getPaymentMethodLabel — kept for call sites importing from PaymentDialog. */
export function paymentMethodLabel(method: PaymentMethod): string {
  return getPaymentMethodLabel(method);
}
