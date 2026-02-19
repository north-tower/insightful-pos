import { useState } from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { SaleOrder, PaymentMethod } from '@/hooks/useOrders';
import { Customer } from '@/hooks/useCustomers';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: SaleOrder;
  customer?: Customer | null;
  onRecordPayment: (
    orderId: string,
    payment: { method: PaymentMethod; amount: number; reference?: string },
  ) => Promise<any>;
  onPaymentComplete?: () => void;
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

export function PaymentDialog({
  open,
  onOpenChange,
  order,
  customer,
  onRecordPayment,
  onPaymentComplete,
}: PaymentDialogProps) {
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPaid = order.payments.reduce((s, p) => s + p.amount, 0);
  const balanceDue = Math.max(order.total - totalPaid, 0);
  const enteredAmount = parseFloat(amount) || 0;

  const customerName = customer
    ? `${customer.first_name} ${customer.last_name}`.trim()
    : order.customer_name || 'Unknown';

  const handleSubmit = async () => {
    if (enteredAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (enteredAmount > balanceDue) {
      setError(`Amount exceeds balance due ($${balanceDue.toFixed(2)})`);
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const result = await onRecordPayment(order.id, {
        method,
        amount: enteredAmount,
        reference: reference.trim() || undefined,
      });

      if (result) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setAmount('');
          setReference('');
          onPaymentComplete?.();
          onOpenChange(false);
        }, 1500);
      } else {
        setError('Payment failed. Please try again.');
      }
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
              ${enteredAmount.toFixed(2)} via {method}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Invoice Summary */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Invoice Total</span>
                <span className="font-medium">${order.total.toFixed(2)}</span>
              </div>
              {order.payments.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Previously Paid ({order.payments.length} payment
                    {order.payments.length > 1 ? 's' : ''})
                  </span>
                  <span className="font-medium text-success">
                    -${totalPaid.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
                <span>Balance Due</span>
                <span className="text-warning">${balanceDue.toFixed(2)}</span>
              </div>
              {order.due_date && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Due Date</span>
                  <span>{format(new Date(order.due_date), 'MMM dd, yyyy')}</span>
                </div>
              )}
            </div>

            {/* Customer Account Info */}
            {customer && customer.credit_balance > 0 && (
              <div className="p-3 bg-warning/5 border border-warning/20 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {customerName}'s Total Account Balance
                  </span>
                  <span className="font-bold text-warning">
                    ${customer.credit_balance.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

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
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                  $
                </span>
                <Input
                  id="payment-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={balanceDue}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError(null);
                  }}
                  placeholder="0.00"
                  className="pl-7 text-lg font-semibold"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(balanceDue.toFixed(2))}
                  className="text-xs"
                >
                  Pay Full (${balanceDue.toFixed(2)})
                </Button>
                {balanceDue > 100 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount((balanceDue / 2).toFixed(2))}
                    className="text-xs"
                  >
                    Half (${(balanceDue / 2).toFixed(2)})
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

            {/* After-payment preview */}
            {enteredAmount > 0 && enteredAmount <= balanceDue && (
              <div className="p-3 bg-muted/30 rounded-lg text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">After this payment</span>
                  <Badge
                    className={cn(
                      'text-xs',
                      enteredAmount >= balanceDue
                        ? 'bg-success/10 text-success'
                        : 'bg-warning/10 text-warning',
                    )}
                  >
                    {enteredAmount >= balanceDue ? 'FULLY PAID' : 'PARTIAL'}
                  </Badge>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Remaining Balance</span>
                  <span
                    className={cn(
                      enteredAmount >= balanceDue ? 'text-success' : 'text-warning',
                    )}
                  >
                    ${Math.max(balanceDue - enteredAmount, 0).toFixed(2)}
                  </span>
                </div>
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
                disabled={isProcessing || enteredAmount <= 0 || enteredAmount > balanceDue}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Record ${enteredAmount > 0 ? enteredAmount.toFixed(2) : '0.00'}
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
