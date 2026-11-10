import { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CURRENCY_SYMBOL } from '@/lib/currency';
import { TypedNumberHint } from '@/components/ui/typed-number-hint';
import { formatKES } from '@/lib/formatKES';
import { Money } from '@/components/ui/Money';
import { formatDate } from '@/lib/formatDate';
import {
  getPaymentMethodLabel,
  getPaymentReferenceFieldLabel,
  paymentMethodLabel,
} from '@/lib/paymentMethods';
import { SaleOrder, PaymentMethod } from '@/hooks/useOrders';
import { Customer } from '@/hooks/useCustomers';
import { notifyPaymentReceived } from '@/lib/sendSms';
import {
  RecordDialogShell,
  RECORD_OUTLINED_BTN,
  RECORD_PRIMARY_BTN,
} from '@/components/payment/RecordDialogShell';
import {
  INVOICE_PAYMENT_METHOD_TILES,
  METHOD_ONLY_PAYMENT_TILES,
  PaymentMethodTiles,
} from '@/components/payment/PaymentMethodTiles';

export { paymentMethodLabel };

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: SaleOrder;
  customer?: Customer | null;
  otherUnpaidOrders?: SaleOrder[];
  onRecordPayment?: (
    orderId: string,
    payment: {
      method: PaymentMethod;
      amount: number;
      reference?: string;
      description?: string;
      paid_at?: string;
    },
  ) => Promise<any>;
  onRecordAccountPayment?: (
    customerId: string,
    amount: number,
    method: PaymentMethod,
    reference?: string,
    description?: string,
    paidAt?: string,
  ) => Promise<{ success: boolean; error?: string } | any>;
  onPaymentComplete?: () => void;
  companyName?: string;
  variant?: 'default' | 'methodOnly';
}

function orderBalanceDue(order: SaleOrder): number {
  const paid = order.payments.reduce((s, p) => s + p.amount, 0);
  return Math.max(order.total - paid, 0);
}

interface DistributionLine {
  order: SaleOrder;
  balanceBefore: number;
  applied: number;
  balanceAfter: number;
}

function buildDistribution(
  primaryOrder: SaleOrder,
  otherOrders: SaleOrder[],
  paymentAmount: number,
): DistributionLine[] {
  const lines: DistributionLine[] = [];
  let remaining = paymentAmount;

  const primaryBalance = orderBalanceDue(primaryOrder);
  const primaryApplied = Math.min(remaining, primaryBalance);
  if (primaryApplied > 0) {
    lines.push({
      order: primaryOrder,
      balanceBefore: primaryBalance,
      applied: primaryApplied,
      balanceAfter: primaryBalance - primaryApplied,
    });
    remaining -= primaryApplied;
  }

  const sorted = [...otherOrders].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  for (const order of sorted) {
    if (remaining <= 0) break;
    const bal = orderBalanceDue(order);
    if (bal <= 0) continue;
    const applied = Math.min(remaining, bal);
    lines.push({
      order,
      balanceBefore: bal,
      applied,
      balanceAfter: bal - applied,
    });
    remaining -= applied;
  }

  return lines;
}

function amountMatches(entered: number, target: number): boolean {
  return entered > 0 && Math.abs(entered - target) < 0.005;
}

const FILL_BTN =
  'focus-ring inline-flex h-12 min-h-12 min-w-0 flex-[1_1_calc(50%-0.25rem)] items-center gap-2 rounded-[var(--radius)] border border-hairline bg-surface px-3 text-sm font-semibold text-ink active:scale-[0.98] min-[768px]:flex-[0_1_auto]';

export function PaymentDialog({
  open,
  onOpenChange,
  order,
  customer,
  otherUnpaidOrders = [],
  onRecordPayment,
  onRecordAccountPayment,
  onPaymentComplete,
  companyName,
  variant = 'default',
}: PaymentDialogProps) {
  const isMethodOnly = variant === 'methodOnly';
  const [isDesktopMd, setIsDesktopMd] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  );
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => setIsDesktopMd(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const balanceDue = orderBalanceDue(order);
  const enteredAmount = parseFloat(amount) || 0;
  const paidSoFar = order.total - balanceDue;
  const paymentCount = order.payments.length;

  const totalCustomerBalance = useMemo(() => {
    const otherBalance = otherUnpaidOrders.reduce((s, o) => s + orderBalanceDue(o), 0);
    return balanceDue + otherBalance;
  }, [balanceDue, otherUnpaidOrders]);

  const distribution = useMemo(
    () => buildDistribution(order, otherUnpaidOrders, enteredAmount),
    [order, otherUnpaidOrders, enteredAmount],
  );

  const willSpillOver = distribution.length > 1;
  const totalApplied = Math.min(enteredAmount, totalCustomerBalance);
  const excessAfterAll = Math.max(enteredAmount - totalCustomerBalance, 0);
  const accountBalanceBefore = Math.max(
    customer?.credit_balance ?? totalCustomerBalance,
    0,
  );
  const isAccountPaymentMode = Boolean(customer && onRecordAccountPayment);
  const effectiveAccountMode = isAccountPaymentMode && !isMethodOnly;

  useEffect(() => {
    if (!open || !isMethodOnly) return;
    setMethod('cash');
    setAmount('');
    setReference('');
    setDescription('');
    setError(null);
    setPaymentDate(new Date().toISOString().slice(0, 10));
  }, [open, isMethodOnly, order.id]);

  const customerName = customer
    ? `${customer.first_name} ${customer.last_name}`.trim()
    : order.customer_name || 'Unknown';

  const invoiceLabel = order.invoice_number || order.order_number;
  const amountToPay = isMethodOnly ? balanceDue : enteredAmount;
  const paymentDateLabel = formatDate(new Date(`${paymentDate}T12:00:00`));

  const handleSubmit = async () => {
    if (isMethodOnly) {
      if (balanceDue <= 0) {
        setError('Nothing to pay on this order');
        return;
      }
      if (!onRecordPayment) {
        setError('Unable to record payment in this context');
        return;
      }
    } else if (enteredAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (!effectiveAccountMode && !onRecordPayment) {
      setError('Unable to record payment in this context');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      if (effectiveAccountMode) {
        const res = await onRecordAccountPayment!(
          customer!.id,
          enteredAmount,
          method,
          reference.trim() || undefined,
          description.trim() || undefined,
          new Date(`${paymentDate}T12:00:00`).toISOString(),
        );
        if (res && res.success === false) {
          throw new Error(res.error || 'Payment failed');
        }
      } else if (isMethodOnly) {
        await onRecordPayment!(order.id, {
          method,
          amount: balanceDue,
          reference: reference.trim() || undefined,
          paid_at: new Date(`${paymentDate}T12:00:00`).toISOString(),
        });
      } else {
        let recordedAmount = 0;
        for (const line of distribution) {
          if (line.applied <= 0) continue;
          await onRecordPayment?.(line.order.id, {
            method,
            amount: line.applied,
            reference: reference.trim() || undefined,
            description: description.trim() || undefined,
            paid_at: new Date(`${paymentDate}T12:00:00`).toISOString(),
          });
          recordedAmount += line.applied;
        }

        const remainder = Math.max(enteredAmount - recordedAmount, 0);
        if (remainder > 0) {
          await onRecordPayment?.(order.id, {
            method,
            amount: remainder,
            reference: reference.trim() || undefined,
            description: description.trim() || undefined,
            paid_at: new Date(`${paymentDate}T12:00:00`).toISOString(),
          });
        }
      }

      if (companyName) {
        const phone = customer?.phone || order.customer_phone;
        if (phone) {
          const totalBalanceBefore = accountBalanceBefore;
          const smsAmount = effectiveAccountMode ? enteredAmount : amountToPay;
          const totalBalanceAfter = Math.max(totalBalanceBefore - smsAmount, 0);
          notifyPaymentReceived(
            order,
            smsAmount,
            totalBalanceBefore,
            totalBalanceAfter,
            companyName,
            phone,
            description.trim() || undefined,
          );
        }
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setAmount('');
        setReference('');
        setDescription('');
        setPaymentDate(new Date().toISOString().slice(0, 10));
        onPaymentComplete?.();
        onOpenChange(false);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = (next: boolean) => {
    if (!isProcessing) {
      setAmount('');
      setReference('');
      setDescription('');
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setError(null);
      setSuccess(false);
      onOpenChange(next);
    }
  };

  const submitDisabled =
    isProcessing || (isMethodOnly ? balanceDue <= 0 : enteredAmount <= 0);

  const title = isMethodOnly ? 'Set payment method' : 'Record payment';
  const subtitle = isMethodOnly ? (
    <>
      Full payment {formatKES(balanceDue)} ·{' '}
      <span className="font-mono">{invoiceLabel}</span>
      {customerName ? ` · ${customerName}` : null}
    </>
  ) : (
    <>
      Invoice <span className="font-mono">{invoiceLabel}</span>
      {customerName ? ` · ${customerName}` : null}
    </>
  );

  const footer = success ? null : (
    <div className="space-y-2">
      {!isMethodOnly && enteredAmount <= 0 && !isProcessing ? (
        <p className="text-center text-sm text-ink-2">Enter an amount</p>
      ) : null}
      <div className="flex gap-3">
        <button
          type="button"
          className={RECORD_OUTLINED_BTN}
          onClick={() => handleClose(false)}
          disabled={isProcessing}
        >
          Cancel
        </button>
        <button
          type="button"
          className={RECORD_PRIMARY_BTN}
          onClick={() => void handleSubmit()}
          disabled={submitDisabled}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Processing…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate font-sans tabular-nums">
                {isMethodOnly ? (
                  <>
                    Confirm{' '}
                    <Money value={balanceDue} sansInline />
                  </>
                ) : (
                  <>
                    Record{' '}
                    <Money
                      value={enteredAmount > 0 ? enteredAmount : 0}
                      sansInline
                    />
                  </>
                )}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <RecordDialogShell
      open={open}
      onOpenChange={handleClose}
      isDesktopMd={isDesktopMd}
      blockClose={isProcessing}
      title={title}
      subtitle={subtitle}
      footer={footer ?? <div />}
      titleId="record-payment-title"
      descriptionId="record-payment-desc"
    >
      {success ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10">
          <CheckCircle2 className="h-14 w-14 text-primary" aria-hidden />
          <p className="text-lg font-semibold text-ink">Payment recorded</p>
          <p className="text-center text-sm text-ink-2">
            {formatKES(amountToPay)} via {getPaymentMethodLabel(method)}
            {!isMethodOnly && willSpillOver
              ? ` — distributed across ${distribution.length} invoices`
              : null}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="receipt-ruled space-y-2 border-y border-hairline py-4 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-ink-2">Invoice total</span>
              <Money value={order.total} className="text-ink" />
            </div>
            {paymentCount > 0 ? (
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-ink-2">
                  Paid so far ({paymentCount} payment
                  {paymentCount > 1 ? 's' : ''})
                </span>
                <Money value={paidSoFar} sign="minus" className="text-ink" />
              </div>
            ) : null}
            <div className="border-y-2 border-double border-hairline py-3">
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-semibold text-ink">Balance due</span>
                <Money value={balanceDue} variant="display" size={28} />
              </div>
            </div>
            {order.due_date ? (
              <p className="text-sm text-ink-2">
                Due {formatDate(new Date(order.due_date))}
              </p>
            ) : null}
            {!isMethodOnly && isAccountPaymentMode ? (
              <p className="text-sm text-ink-2">
                {customerName} owes {formatKES(accountBalanceBefore)} in total
              </p>
            ) : null}
            {!isMethodOnly && !isAccountPaymentMode && otherUnpaidOrders.length > 0 ? (
              <p className="text-sm text-ink-2">
                {customerName} owes {formatKES(totalCustomerBalance)} in total
              </p>
            ) : null}
          </section>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-ink">Payment method</Label>
            <PaymentMethodTiles
              methods={isMethodOnly ? METHOD_ONLY_PAYMENT_TILES : INVOICE_PAYMENT_METHOD_TILES}
              value={method}
              onChange={setMethod}
            />
          </div>

          {!isMethodOnly ? (
            <div className="space-y-2">
              <Label htmlFor="payment-amount" className="text-sm font-semibold text-ink">
                Amount
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-2">
                  KES
                </span>
                <Input
                  id="payment-amount"
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError(null);
                  }}
                  placeholder="0.00"
                  className="h-14 border-hairline pl-14 font-sans text-[28px] font-bold tabular-nums md:text-[28px]"
                />
              </div>
              <TypedNumberHint value={amount} prefix={`${CURRENCY_SYMBOL} `} />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={cn(
                    FILL_BTN,
                    amountMatches(enteredAmount, balanceDue) &&
                      'border-primary bg-[hsl(var(--accent-soft))]',
                  )}
                  aria-pressed={amountMatches(enteredAmount, balanceDue)}
                  onClick={() => setAmount(balanceDue.toFixed(2))}
                >
                  {amountMatches(enteredAmount, balanceDue) ? (
                    <Check className="h-4 w-4 text-primary" aria-hidden />
                  ) : null}
                  <span>
                    Invoice balance · <Money value={balanceDue} />
                  </span>
                </button>
                {balanceDue > 100 ? (
                  <button
                    type="button"
                    className={cn(
                      FILL_BTN,
                      amountMatches(enteredAmount, balanceDue / 2) &&
                        'border-primary bg-[hsl(var(--accent-soft))]',
                    )}
                    aria-pressed={amountMatches(enteredAmount, balanceDue / 2)}
                    onClick={() => setAmount((balanceDue / 2).toFixed(2))}
                  >
                    {amountMatches(enteredAmount, balanceDue / 2) ? (
                      <Check className="h-4 w-4 text-primary" aria-hidden />
                    ) : null}
                    <span>
                      Half · <Money value={balanceDue / 2} />
                    </span>
                  </button>
                ) : null}
                {isAccountPaymentMode ? (
                  <button
                    type="button"
                    className={cn(
                      FILL_BTN,
                      amountMatches(enteredAmount, accountBalanceBefore) &&
                        'border-primary bg-[hsl(var(--accent-soft))]',
                    )}
                    aria-pressed={amountMatches(enteredAmount, accountBalanceBefore)}
                    onClick={() => setAmount(accountBalanceBefore.toFixed(2))}
                  >
                    {amountMatches(enteredAmount, accountBalanceBefore) ? (
                      <Check className="h-4 w-4 text-primary" aria-hidden />
                    ) : null}
                    <span>
                      Account balance ·{' '}
                      <Money value={accountBalanceBefore} />
                    </span>
                  </button>
                ) : null}
                {!isAccountPaymentMode &&
                otherUnpaidOrders.length > 0 &&
                totalCustomerBalance > balanceDue ? (
                  <button
                    type="button"
                    className={cn(
                      FILL_BTN,
                      amountMatches(enteredAmount, totalCustomerBalance) &&
                        'border-primary bg-[hsl(var(--accent-soft))]',
                    )}
                    aria-pressed={amountMatches(enteredAmount, totalCustomerBalance)}
                    onClick={() => setAmount(totalCustomerBalance.toFixed(2))}
                  >
                    {amountMatches(enteredAmount, totalCustomerBalance) ? (
                      <Check className="h-4 w-4 text-primary" aria-hidden />
                    ) : null}
                    <span>
                      All invoices · <Money value={totalCustomerBalance} />
                    </span>
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {isMethodOnly && balanceDue > 0 ? (
            <p className="text-center text-sm text-ink-2">
              Paying <span className="font-semibold tabular-nums text-ink">{formatKES(balanceDue)}</span> in full
            </p>
          ) : null}

          {(method === 'card' || method === 'qr' || method === 'mpesa') && (
            <div className="space-y-2">
              <Label htmlFor="payment-ref" className="text-sm font-semibold text-ink">
                {getPaymentReferenceFieldLabel(method)}
              </Label>
              <Input
                id="payment-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="min-h-12 border-hairline"
                placeholder={
                  method === 'card'
                    ? 'Last 4 digits or auth code'
                    : method === 'mpesa'
                      ? 'M-Pesa confirmation code'
                      : 'Transaction reference'
                }
              />
            </div>
          )}

          {!isMethodOnly ? (
            <div className="space-y-2">
              <Label htmlFor="payment-description" className="text-sm font-semibold text-ink">
                Description (optional)
              </Label>
              <Input
                id="payment-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-12 border-hairline"
                placeholder="e.g. Deposit, part payment, transfer note"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="payment-date" className="text-sm font-semibold text-ink">
              Payment date · {paymentDateLabel}
            </Label>
            <Input
              id="payment-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="min-h-12 border-hairline"
            />
          </div>

          {error ? (
            <div className="flex items-center gap-2 border border-hairline bg-surface p-3 text-sm text-fail">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
              {error}
            </div>
          ) : null}

          {!isMethodOnly && enteredAmount > 0 ? (
            <div className="space-y-3 border-y border-hairline py-3 text-sm">
              {effectiveAccountMode ? (
                <>
                  <div className="flex justify-between gap-4">
                    <span className="text-ink-2">Account balance before</span>
                    <span className="font-mono tabular-nums text-ink">
                      {formatKES(accountBalanceBefore)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 font-medium">
                    <span className="text-ink">Account balance after</span>
                    <span className="font-mono tabular-nums text-ink">
                      {formatKES(Math.max(accountBalanceBefore - enteredAmount, 0))}
                    </span>
                  </div>
                </>
              ) : willSpillOver ? (
                <>
                  <div className="flex items-center gap-2 font-medium text-ink">
                    <ArrowRight className="h-4 w-4" aria-hidden />
                    Payment across {distribution.length} invoices
                  </div>
                  <ul className="divide-y divide-hairline border-y border-hairline">
                    {distribution.map((line, idx) => (
                      <li
                        key={line.order.id}
                        className="flex items-center justify-between gap-3 py-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-ink">
                            {line.order.invoice_number || line.order.order_number}
                            {idx === 0 ? (
                              <span className="ml-1 text-ink-2">(this invoice)</span>
                            ) : null}
                          </p>
                          <p className="text-ink-2">
                            Balance {formatKES(line.balanceBefore)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-mono font-bold tabular-nums text-ink">
                            −{formatKES(line.applied)}
                          </p>
                          <p className="font-mono tabular-nums text-ink-2">
                            {line.balanceAfter <= 0
                              ? 'Paid'
                              : `Rem. ${formatKES(line.balanceAfter)}`}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <div className="flex justify-between gap-4">
                    <span className="text-ink-2">Remaining balance</span>
                    <span className="font-mono tabular-nums text-ink">
                      {formatKES(Math.max(balanceDue - enteredAmount, 0))}
                    </span>
                  </div>
                  <p className="text-ink-2">
                    {enteredAmount >= balanceDue ? 'Fully paid after this payment' : 'Partial payment'}
                  </p>
                </>
              )}

              {excessAfterAll > 0 ? (
                <div className="flex justify-between gap-4 border-t border-hairline pt-2 font-medium">
                  <span className="text-ink">Overpayment (advance credit)</span>
                  <span className="font-mono tabular-nums text-ink">
                    {formatKES(excessAfterAll)}
                  </span>
                </div>
              ) : null}

              {!isAccountPaymentMode && otherUnpaidOrders.length > 0 ? (
                <div className="flex justify-between gap-4 border-t border-hairline pt-2 font-medium">
                  <span className="text-ink">Account balance after</span>
                  <span className="font-mono tabular-nums text-ink">
                    {formatKES(Math.max(totalCustomerBalance - totalApplied, 0))}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </RecordDialogShell>
  );
}
