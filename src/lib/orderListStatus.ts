import type { StatusChipStatus } from '@/components/ui/StatusChip';
import { type SaleOrder, sumActivePaymentAmount } from '@/hooks/useOrders';

export function getOrderListStatus(
  order: SaleOrder,
  getOrderBalanceDue: (order: SaleOrder) => number,
): StatusChipStatus {
  if (order.status === 'cancelled') {
    return 'cancelled';
  }

  const balanceDue = getOrderBalanceDue(order);
  if (balanceDue <= 0) {
    return 'paid';
  }

  if (order.due_date) {
    const dueEnd = new Date(order.due_date);
    dueEnd.setHours(23, 59, 59, 999);
    if (dueEnd.getTime() < Date.now()) {
      return 'overdue';
    }
  }

  const paid = sumActivePaymentAmount(order.payments);
  if (paid > 0) {
    return 'partpaid';
  }

  return 'unpaid';
}
