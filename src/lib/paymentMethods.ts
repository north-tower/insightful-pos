import type { PaymentMethod } from '@/hooks/useOrders';

/** Display label for stored payment method values (does not change stored values). */
export function getPaymentMethodLabel(method: string): string {
  switch (method as PaymentMethod) {
    case 'cash':
      return 'Cash';
    case 'mpesa':
      return 'M-Pesa / Paybill';
    case 'card':
      return 'Direct Bank';
    case 'qr':
      return 'QR / Mobile';
    default:
      return method;
  }
}
