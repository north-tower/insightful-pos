import { useRef, type RefObject } from 'react';
import { ChevronLeft, Ban, Loader2, Undo2, X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { StatusChip } from '@/components/ui/StatusChip';
import { cn } from '@/lib/utils';
import { formatKES } from '@/lib/formatKES';
import { Money } from '@/components/ui/Money';
import { formatDate } from '@/lib/formatDate';
import { formatQty, formatQtyAmount } from '@/lib/units';
import { getOrderListStatus } from '@/lib/orderListStatus';
import { getPaymentMethodLabel } from '@/lib/paymentMethods';
import {
  type Payment,
  type SaleOrder,
  sumActivePaymentAmount,
} from '@/hooks/useOrders';
import type { Customer } from '@/hooks/useCustomers';

function formatOrderDetailDateTime(iso: string): string {
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${formatDate(date)}, ${time}`;
}

function formatPaymentDateTime(iso: string): string {
  return formatOrderDetailDateTime(iso);
}

function orderStatusCaption(status: string): string | null {
  if (status === 'cancelled' || status === 'voided' || status === 'completed') {
    return null;
  }
  if (status === 'preparing') return 'Preparing';
  if (status === 'pending') return 'Pending';
  if (status === 'ready') return 'Ready';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

const DRAWER_PAD = 'px-5';

function itemQtyUnitLine(
  quantity: number,
  unitPrice: number,
  unit?: string | null,
): string {
  const pricePart = formatKES(unitPrice);
  if (unit) {
    return `${formatQty(quantity, unit)} × ${pricePart}`;
  }
  return `${formatQtyAmount(quantity)} × ${pricePart}`;
}

const OUTLINED_48 =
  'focus-ring inline-flex h-12 min-h-12 min-w-12 items-center justify-center rounded-[var(--radius)] border border-hairline bg-surface px-3 text-sm font-semibold text-ink active:scale-[0.98]';

const ICON_BTN_48 =
  'focus-ring inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius)] border border-hairline bg-surface text-ink active:scale-[0.98]';

const ROW_TEXT_BTN =
  'focus-ring inline-flex h-12 min-h-12 items-center justify-center px-2 text-sm font-semibold text-ink underline-offset-2 hover:underline';

const ACCENT_FOOTER_BTN =
  'focus-ring flex h-14 w-full min-h-14 items-center justify-center rounded-[var(--radius)] bg-primary text-base font-semibold text-primary-foreground active:scale-[0.98]';

const RECEIPT_TEAR_MASK =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='6' viewBox='0 0 12 6'%3E%3Crect width='12' height='3' fill='white'/%3E%3Cpolygon points='0,3 6,6 12,3' fill='black'/%3E%3Cline x1='0' y1='3' x2='12' y2='3' stroke='black' stroke-width='0.25'/%3E%3C/svg%3E\")";

export interface OrderDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: SaleOrder | null;
  isDesktopMd: boolean;
  customer: Customer | null;
  getOrderBalanceDue: (order: SaleOrder) => number;
  onPrintReceipt: (order: SaleOrder) => void;
  onRecordPayment: (order: SaleOrder) => void;
  canRecordPayment: boolean;
  onEditPayment: (payment: Payment) => void;
  onReversePayment: (payment: Payment) => void;
  canModifyPayments: boolean;
  canReversePayments: boolean;
  reversingPaymentId: string | null;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export function OrderDetailDrawer({
  open,
  onOpenChange,
  order,
  isDesktopMd,
  customer,
  getOrderBalanceDue,
  onPrintReceipt,
  onRecordPayment,
  canRecordPayment,
  onEditPayment,
  onReversePayment,
  canModifyPayments,
  canReversePayments,
  reversingPaymentId,
  returnFocusRef,
}: OrderDetailDrawerProps) {
  const fallbackFocusOrderId = useRef<string | null>(null);
  if (order?.id) {
    fallbackFocusOrderId.current = order.id;
  }
  const balanceDue = order ? getOrderBalanceDue(order) : 0;
  const listStatus = order ? getOrderListStatus(order, getOrderBalanceDue) : null;
  const isCancelled = order?.status === 'cancelled';
  const showBalanceBlock = Boolean(order && balanceDue > 0 && !isCancelled);
  const showFooterRecord = Boolean(order && canRecordPayment && balanceDue > 0 && !isCancelled);
  const paidTotal = order ? sumActivePaymentAmount(order.payments) : 0;
  const statusCaption = order ? orderStatusCaption(order.status) : null;
  const showDueDateInDetails = Boolean(
    order?.due_date && !showBalanceBlock && !isCancelled,
  );
  const headerSubtitle = order
    ? [order.customer_name, formatOrderDetailDateTime(order.created_at)]
        .filter(Boolean)
        .join(' · ')
    : '';
  const saleTypeLabel =
    order?.sale_type === 'credit' ? 'Credit sale' : 'Cash sale';
  const taxRatePercent = order ? Math.round((order.tax_rate || 0) * 100) : 0;
  const showTax =
    order &&
    (order.tax_amount > 0 || (order.tax_rate != null && order.tax_rate > 0));
  const hasCompactDetails = Boolean(
    order &&
      ((customer && order.customer_name) ||
        order.invoice_number ||
        order.staff_name ||
        showDueDateInDetails),
  );
  const handleCloseAutoFocus = (event: Event) => {
    event.preventDefault();
    const fromRef = returnFocusRef?.current;
    if (fromRef && document.contains(fromRef)) {
      fromRef.focus();
      return;
    }
    const orderId = order?.id ?? fallbackFocusOrderId.current;
    if (!orderId) return;
    const trigger = document.querySelector(
      `[data-order-focus="${orderId}"]`,
    ) as HTMLElement | null;
    trigger?.focus();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        hideClose
        onCloseAutoFocus={handleCloseAutoFocus}
        className={cn(
          'flex h-full max-h-[100dvh] flex-col gap-0 overflow-hidden p-0 shadow-lg',
          isDesktopMd
            ? 'w-[520px] max-w-[520px] sm:max-w-[520px]'
            : 'inset-0 h-[100dvh] w-full max-w-none border-0',
        )}
      >
        {order ? (
          <>
            <SheetTitle className="sr-only">Order #{order.order_number}</SheetTitle>
            <SheetDescription className="sr-only">
              Order details for {formatOrderDetailDateTime(order.created_at)}
            </SheetDescription>

            <header
              className={cn(
                'shrink-0 border-b border-hairline bg-background pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]',
                DRAWER_PAD,
              )}
            >
              <div className="flex items-start gap-2">
                {!isDesktopMd ? (
                  <button
                    type="button"
                    className={ICON_BTN_48}
                    aria-label="Back to sales history"
                    onClick={() => onOpenChange(false)}
                  >
                    <ChevronLeft className="h-5 w-5" aria-hidden />
                  </button>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="text-xl font-semibold text-ink">
                        <span className="font-sans">Order </span>
                        <span className="font-mono">#{order.order_number}</span>
                      </h2>
                      <p className="mt-0.5 truncate text-sm text-ink-2">
                        {headerSubtitle}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        className={OUTLINED_48}
                        onClick={() => onPrintReceipt(order)}
                      >
                        Receipt
                      </button>
                      {isDesktopMd ? (
                        <button
                          type="button"
                          className={ICON_BTN_48}
                          aria-label="Close order details"
                          onClick={() => onOpenChange(false)}
                        >
                          <X className="h-5 w-5" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <div
              className={cn(
                'min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-gutter:stable]',
                DRAWER_PAD,
              )}
            >
              <section className="border-b border-hairline py-3">
                {isCancelled ? (
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <Ban className="h-4 w-4 shrink-0 text-ink-2" aria-hidden />
                    This order was cancelled
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      {listStatus ? <StatusChip status={listStatus} size="md" /> : null}
                      <span className="text-sm font-medium text-ink">{saleTypeLabel}</span>
                      {statusCaption ? (
                        <span className="text-sm font-medium text-ink">{statusCaption}</span>
                      ) : null}
                    </div>
                    {showBalanceBlock ? (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-ink-2">Balance due</p>
                        <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
                          <Money value={balanceDue} variant="display" size="xl" />
                          {order.due_date ? (
                            <div className="flex flex-wrap items-center gap-2 pb-1">
                              <p className="text-sm text-ink-2">
                                Due {formatDate(new Date(order.due_date))}
                              </p>
                              {listStatus === 'overdue' ? (
                                <StatusChip status="overdue" size="sm" />
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </section>

              <section className="py-3" aria-labelledby="order-receipt-paper-heading">
                <h3 id="order-receipt-paper-heading" className="sr-only">
                  Receipt
                </h3>
                <div className="overflow-hidden rounded-t-2xl border border-b-0 border-hairline bg-surface">
                  <div className="p-5">
                    <p className="text-xs font-semibold text-ink-2">Items</p>
                    <ul className="mt-3 space-y-0">
                      {order.items.map((item, index) => (
                        <li
                          key={item.id}
                          className={cn(
                            'py-3',
                            index > 0 && 'border-t border-dotted border-hairline',
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="min-w-0 flex-1 text-sm font-semibold text-ink">
                              {item.product_name}
                            </p>
                            <Money
                              value={item.line_total}
                              strike={isCancelled}
                              className="shrink-0 text-sm font-semibold"
                            />
                          </div>
                          <p className="mt-0.5 font-mono text-xs text-ink-2">
                            {itemQtyUnitLine(item.quantity, item.unit_price)}
                          </p>
                          {item.sku ? (
                            <p className="mt-0.5 font-mono text-xs text-ink-2">{item.sku}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-4 space-y-2 border-t border-hairline pt-4 text-sm">
                      <div className="flex justify-between gap-3 text-ink">
                        <span className="text-ink-2">Subtotal</span>
                        <Money value={order.subtotal} strike={isCancelled} />
                      </div>
                      {order.discount_amount > 0 ? (
                        <div className="flex justify-between gap-3 text-ink">
                          <span className="text-ink-2">Discount</span>
                          <Money
                            value={order.discount_amount}
                            sign="minus"
                            strike={isCancelled}
                          />
                        </div>
                      ) : null}
                      {showTax ? (
                        <div className="flex justify-between gap-3 text-ink">
                          <span className="text-ink-2">Tax ({taxRatePercent}%)</span>
                          <Money value={order.tax_amount} strike={isCancelled} />
                        </div>
                      ) : null}
                      <div
                        className="border-t-2 border-double border-hairline pt-3"
                        role="separator"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-semibold text-ink">Total</span>
                          <Money
                            value={order.total}
                            variant="display"
                            size="lg"
                            strike={isCancelled}
                          />
                        </div>
                        <div className="mt-3 space-y-1 text-sm">
                          <div className="flex justify-between gap-3 text-ink">
                            <span className="text-ink-2">Paid</span>
                            <Money value={paidTotal} strike={isCancelled} />
                          </div>
                          {balanceDue > 0 && !isCancelled ? (
                            <div className="flex justify-between gap-3 text-ink">
                              <span className="text-ink-2">Balance due</span>
                              <Money value={balanceDue} />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  className="h-[6px] w-full bg-surface"
                  style={{
                    maskImage: RECEIPT_TEAR_MASK,
                    WebkitMaskImage: RECEIPT_TEAR_MASK,
                    maskRepeat: 'repeat-x',
                    WebkitMaskRepeat: 'repeat-x',
                    maskSize: '12px 6px',
                    WebkitMaskSize: '12px 6px',
                  }}
                  aria-hidden
                />
              </section>

              {!isCancelled ? (
                <section className="border-t border-hairline py-3" aria-labelledby="order-payments-heading">
                  <h3 id="order-payments-heading" className="text-sm font-semibold text-ink">
                    Payments ({order.payments.length})
                  </h3>
                  {order.payments.length === 0 ? (
                    <p className="mt-3 text-sm text-ink-2">No payments yet.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-hairline">
                      {order.payments.map((payment) => (
                        <li
                          key={payment.id}
                          className={cn(
                            'flex w-full items-start justify-between gap-3 py-3',
                            payment.reversed_at && 'opacity-60',
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-ink">
                              {getPaymentMethodLabel(payment.method)}
                            </p>
                            {payment.description || payment.reference ? (
                              <p className="mt-0.5 text-sm text-ink-2">
                                {payment.description || payment.reference}
                              </p>
                            ) : null}
                            <p className="mt-0.5 text-xs text-ink-2">
                              {formatPaymentDateTime(payment.paid_at)}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <Money
                              value={payment.amount}
                              className="text-sm font-semibold"
                            />
                            {canModifyPayments && !payment.reversed_at ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  className={ROW_TEXT_BTN}
                                  onClick={() => onEditPayment(payment)}
                                >
                                  Edit
                                </button>
                                {canReversePayments ? (
                                  <button
                                    type="button"
                                    className={cn(
                                      ROW_TEXT_BTN,
                                      'inline-flex items-center gap-1',
                                    )}
                                    onClick={() => onReversePayment(payment)}
                                    disabled={reversingPaymentId === payment.id}
                                  >
                                    {reversingPaymentId === payment.id ? (
                                      <Loader2
                                        className="h-4 w-4 animate-spin text-ink"
                                        aria-hidden
                                      />
                                    ) : (
                                      <Undo2 className="h-4 w-4 text-fail" aria-hidden />
                                    )}
                                    Reverse
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : null}

              {hasCompactDetails ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-hairline py-3 text-sm">
                  {customer && order.customer_name ? (
                    <div className="col-span-2 min-w-0">
                      <dt className="sr-only">Account balance</dt>
                      <dd className="text-ink">
                        {order.customer_name} account balance{' '}
                        <Money value={customer.credit_balance} className="inline" />
                      </dd>
                    </div>
                  ) : null}
                  {order.invoice_number ? (
                    <div className="min-w-0">
                      <dt className="text-ink-2">Invoice</dt>
                      <dd className="mt-1 font-mono text-ink">{order.invoice_number}</dd>
                    </div>
                  ) : null}
                  {order.staff_name ? (
                    <div className="min-w-0">
                      <dt className="text-ink-2">Staff</dt>
                      <dd className="mt-1 text-ink">{order.staff_name}</dd>
                    </div>
                  ) : null}
                  {showDueDateInDetails ? (
                    <div className="min-w-0">
                      <dt className="text-ink-2">Due date</dt>
                      <dd className="mt-1 text-ink">
                        {formatDate(new Date(order.due_date!))}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}

              <div className="h-4 shrink-0" aria-hidden />
            </div>

            {showFooterRecord ? (
              <footer
                className={cn(
                  'shrink-0 border-t border-hairline bg-background pb-[max(1rem,env(safe-area-inset-bottom))] pt-3',
                  DRAWER_PAD,
                )}
              >
                <button
                  type="button"
                  className={ACCENT_FOOTER_BTN}
                  onClick={() => onRecordPayment(order)}
                >
                  Record payment
                </button>
              </footer>
            ) : null}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
