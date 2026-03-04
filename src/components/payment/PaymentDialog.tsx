import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Banknote,
  CreditCard,
  QrCode,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fc, CURRENCY_SYMBOL } from '@/lib/currency';
import { format } from 'date-fns';
import { SaleOrder, PaymentMethod } from '@/hooks/useOrders';
import { Customer } from '@/hooks/useCustomers';
import { notifyPaymentReceived } from '@/lib/sendSms';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The primary order the user clicked "Pay" on */
  order: SaleOrder;
  customer?: Customer | null;
  /** Other unpaid credit orders for the same customer (excluding the primary order) */
  otherUnpaidOrders?: SaleOrder[];
  /** Record a single payment against an order — DB trigger handles customer balance */
  onRecordPayment?: (
    orderId: string,
    payment: { method: PaymentMethod; amount: number; reference?: string },
  ) => Promise<any>;
  /** Record a payment directly on customer account (no invoice allocation). */
  onRecordAccountPayment?: (
    customerId: string,
    amount: number,
    method: PaymentMethod,
    reference?: string,
  ) => Promise<{ success: boolean; error?: string } | any>;
  /** Called after everything is done */
  onPaymentComplete?: () => void;
  /** Company name for SMS notifications */
  companyName?: string;
}

const paymentMethods: Array<{
  id: PaymentMethod;
  label: string;
  icon: typeof Banknote;
}> = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'qr', label: 'QR / Mobile', icon: QrCode },
];

/** Compute the balance due for an order from its payments array */
function orderBalanceDue(order: SaleOrder): number {
  const paid = order.payments.reduce((s, p) => s + p.amount, 0);
  return Math.max(order.total - paid, 0);
}

/** Build a distribution plan: how a payment amount is split across orders */
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

  // Primary order first
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

  // Then other orders sorted by oldest first (by created_at)
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
}: PaymentDialogProps) {
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const balanceDue = orderBalanceDue(order);
  const enteredAmount = parseFloat(amount) || 0;

  // Total balance across all unpaid invoices for this customer
  const totalCustomerBalance = useMemo(() => {
    const otherBalance = otherUnpaidOrders.reduce((s, o) => s + orderBalanceDue(o), 0);
    return balanceDue + otherBalance;
  }, [balanceDue, otherUnpaidOrders]);

  // Distribution preview
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

  const customerName = customer
    ? `${customer.first_name} ${customer.last_name}`.trim()
    : order.customer_name || 'Unknown';

  const handleSubmit = async () => {
    if (enteredAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (!isAccountPaymentMode && !onRecordPayment) {
      setError('Unable to record payment in this context');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      if (isAccountPaymentMode) {
        const res = await onRecordAccountPayment!(
          customer!.id,
          enteredAmount,
          method,
          reference.trim() || undefined,
        );
        if (res && res.success === false) {
          throw new Error(res.error || 'Payment failed');
        }
      } else {
        // Legacy order-allocation fallback for contexts not yet migrated.
        let recordedAmount = 0;
        for (const line of distribution) {
          if (line.applied <= 0) continue;
          await onRecordPayment?.(line.order.id, {
            method,
            amount: line.applied,
            reference: reference.trim() || undefined,
          });
          recordedAmount += line.applied;
        }

        const remainder = Math.max(enteredAmount - recordedAmount, 0);
        if (remainder > 0) {
          await onRecordPayment?.(order.id, {
            method,
            amount: remainder,
            reference: reference.trim() || undefined,
          });
        }
      }

      // DB triggers have already:
      // 1. Reduced customer.credit_balance for each payment
      // 2. Updated each order's payment_status
      // No need to call makePaymentOnAccount — that would be a double-deduction.

      // Send SMS notification for the payment (fire-and-forget)
      if (companyName) {
        const phone = customer?.phone || order.customer_phone;
        if (phone) {
          // Use customer account balance when available so opening balance is included.
          const totalBalanceBefore = accountBalanceBefore;
          const totalBalanceAfter = Math.max(
            totalBalanceBefore - enteredAmount,
            0,
          );
          notifyPaymentReceived(
            order,
            enteredAmount,
            totalBalanceBefore,
            totalBalanceAfter,
            companyName,
            phone,
          );
        }
      }

        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setAmount('');
          setReference('');
          onPaymentComplete?.();
          onOpenChange(false);
        }, 1500);
    } catch (err: any) {
      setError(err.message || 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!isProcessing) {
      setAmount('');
      setReference('');
      setError(null);
      setSuccess(false);
      onOpenChange(open);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Record Payment
          </DialogTitle>
          <DialogDescription>
            Invoice {order.invoice_number || order.order_number}
            {customerName && ` — ${customerName}`}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <CheckCircle2 className="w-16 h-16 text-success" />
            <p className="text-lg font-semibold text-success">Payment Recorded!</p>
            <p className="text-sm text-muted-foreground">
              {fc(enteredAmount)} via {method}
              {willSpillOver && ` — distributed across ${distribution.length} invoices`}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Invoice Summary */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="flex justify-between text-sm gap-4">
                <span className="text-muted-foreground shrink-0">Invoice Total</span>
                <span className="font-medium tabular-nums text-right">{fc(order.total)}</span>
              </div>
              {order.payments.length > 0 && (
                <div className="flex justify-between text-sm gap-4">
                  <span className="text-muted-foreground shrink-0">
                    Previously Paid ({order.payments.length} payment
                    {order.payments.length > 1 ? 's' : ''})
                  </span>
                  <span className="font-medium text-success tabular-nums text-right">
                    -{fc(order.total - balanceDue)}
                  </span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base border-t pt-2 mt-2 gap-4">
                <span className="shrink-0">This Invoice Balance</span>
                <span className="text-warning tabular-nums text-right">{fc(balanceDue)}</span>
              </div>
            {isAccountPaymentMode && (
              <div className="flex justify-between text-sm font-medium gap-4">
                <span className="shrink-0">Current Account Balance</span>
                <span className="text-warning tabular-nums text-right">
                  {fc(accountBalanceBefore)}
                </span>
              </div>
            )}
            {!isAccountPaymentMode && otherUnpaidOrders.length > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground gap-4">
                  <span className="shrink-0">
                    + {otherUnpaidOrders.length} other unpaid invoice{otherUnpaidOrders.length > 1 ? 's' : ''}
                  </span>
                  <span className="tabular-nums text-right">
                    {fc(totalCustomerBalance - balanceDue)}
                  </span>
                </div>
              )}
            {!isAccountPaymentMode && otherUnpaidOrders.length > 0 && (
                <div className="flex justify-between text-sm font-medium gap-4">
                  <span className="shrink-0">Total Account Balance</span>
                  <span className="text-warning tabular-nums text-right">{fc(totalCustomerBalance)}</span>
                </div>
              )}
              {order.due_date && (
                <div className="flex justify-between text-xs text-muted-foreground gap-4">
                  <span className="shrink-0">Due Date</span>
                  <span>{format(new Date(order.due_date), 'MMM dd, yyyy')}</span>
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Payment Method</Label>
              <div className="grid grid-cols-3 gap-2">
                {paymentMethods.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setMethod(id)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all',
                      method === id
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/30',
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="payment-amount" className="text-sm font-medium">
                Amount
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-xs">
                  {CURRENCY_SYMBOL}
                </span>
                <Input
                  id="payment-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError(null);
                  }}
                  placeholder="0.00"
                  className="pl-10 text-lg font-semibold"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(balanceDue.toFixed(2))}
                  className="text-xs tabular-nums"
                >
                  This Invoice ({fc(balanceDue)})
                </Button>
                {isAccountPaymentMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(accountBalanceBefore.toFixed(2))}
                    className="text-xs tabular-nums"
                  >
                    Account Balance ({fc(accountBalanceBefore)})
                  </Button>
                )}
                {!isAccountPaymentMode && otherUnpaidOrders.length > 0 && totalCustomerBalance > balanceDue && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(totalCustomerBalance.toFixed(2))}
                    className="text-xs tabular-nums"
                  >
                    All Invoices ({fc(totalCustomerBalance)})
                  </Button>
                )}
                {balanceDue > 100 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount((balanceDue / 2).toFixed(2))}
                    className="text-xs tabular-nums"
                  >
                    Half ({fc(balanceDue / 2)})
                  </Button>
                )}
              </div>
            </div>

            {/* Reference (for card/QR) */}
            {(method === 'card' || method === 'qr') && (
              <div className="space-y-2">
                <Label htmlFor="payment-ref" className="text-sm font-medium">
                  Reference / Transaction ID
                </Label>
                <Input
                  id="payment-ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder={
                    method === 'card'
                      ? 'Last 4 digits or auth code'
                      : 'Transaction reference'
                  }
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Distribution Preview */}
            {enteredAmount > 0 && (
              <div className="p-3 bg-muted/30 rounded-lg text-sm space-y-3">
                {/* Account-level mode: show simple before/after account balance */}
                {isAccountPaymentMode ? (
                  <>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground shrink-0">
                        Account Balance Before
                      </span>
                      <span className="font-medium tabular-nums text-right">
                        {fc(accountBalanceBefore)}
                      </span>
                    </div>
                    <div className="flex justify-between font-medium gap-4">
                      <span className="shrink-0">Account Balance After</span>
                      <span
                        className={cn(
                          'tabular-nums text-right',
                          accountBalanceBefore - enteredAmount <= 0
                            ? 'text-success'
                            : 'text-warning',
                        )}
                      >
                        {fc(Math.max(accountBalanceBefore - enteredAmount, 0))}
                      </span>
                    </div>
                  </>
                ) : willSpillOver ? (
                  <>
                    <div className="flex items-center gap-2 text-primary font-medium">
                      <ArrowRight className="w-4 h-4" />
                      Payment will be distributed across {distribution.length} invoices
                    </div>
                    <div className="space-y-2">
                      {distribution.map((line, idx) => (
                        <div
                          key={line.order.id}
                          className={cn(
                            'flex items-center justify-between gap-3 p-2 rounded border text-xs',
                            idx === 0
                              ? 'bg-primary/5 border-primary/20'
                              : 'bg-muted/50 border-border',
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">
                              {line.order.invoice_number || line.order.order_number}
                              {idx === 0 && (
                                <span className="text-muted-foreground ml-1">(this invoice)</span>
                              )}
                            </p>
                            <p className="text-muted-foreground">
                              Balance: {fc(line.balanceBefore)}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-success tabular-nums">
                              -{fc(line.applied)}
                            </p>
                            <p className="text-muted-foreground tabular-nums">
                              {line.balanceAfter <= 0 ? (
                                <span className="text-success">Paid</span>
                              ) : (
                                <>Rem: {fc(line.balanceAfter)}</>
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  /* Single order — simple preview */
                  <>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground shrink-0">After this payment</span>
                  <Badge
                    className={cn(
                          'text-xs shrink-0',
                      enteredAmount >= balanceDue
                        ? 'bg-success/10 text-success'
                        : 'bg-warning/10 text-warning',
                    )}
                  >
                    {enteredAmount >= balanceDue ? 'FULLY PAID' : 'PARTIAL'}
                  </Badge>
                </div>
                    <div className="flex justify-between font-medium gap-4">
                      <span className="shrink-0">Remaining Balance</span>
                  <span
                    className={cn(
                          'tabular-nums text-right',
                      enteredAmount >= balanceDue ? 'text-success' : 'text-warning',
                    )}
                  >
                    {fc(Math.max(balanceDue - enteredAmount, 0))}
                  </span>
                </div>
                  </>
                )}

                {/* Excess beyond all invoices */}
                {excessAfterAll > 0 && (
                  <div className="flex justify-between font-medium text-info gap-4 border-t pt-2">
                    <span className="shrink-0">Overpayment (advance credit)</span>
                    <span className="tabular-nums text-right">{fc(excessAfterAll)}</span>
                  </div>
                )}

                {/* Total account balance after payment */}
                {!isAccountPaymentMode && otherUnpaidOrders.length > 0 && (
                  <div className="flex justify-between font-medium gap-4 border-t pt-2">
                    <span className="shrink-0">Account Balance After</span>
                    <span
                      className={cn(
                        'tabular-nums text-right',
                        totalCustomerBalance - totalApplied <= 0
                          ? 'text-success'
                          : 'text-warning',
                      )}
                    >
                      {fc(Math.max(totalCustomerBalance - totalApplied, 0))}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleClose(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleSubmit}
                disabled={isProcessing || enteredAmount <= 0}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="truncate tabular-nums">Record {enteredAmount > 0 ? fc(enteredAmount) : fc(0)}</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
