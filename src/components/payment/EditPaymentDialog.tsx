import { useState, useEffect } from 'react';
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
import {
  Banknote,
  CreditCard,
  QrCode,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fc, CURRENCY_SYMBOL } from '@/lib/currency';
import { format } from 'date-fns';
import { Payment, PaymentMethod, SaleOrder } from '@/hooks/useOrders';

interface EditPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: Payment;
  /** The parent order (for context display) */
  order?: SaleOrder;
  onUpdate: (
    paymentId: string,
    updates: { method?: PaymentMethod; amount?: number; reference?: string },
  ) => Promise<Payment | null>;
  onUpdateComplete?: () => void;
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

export function EditPaymentDialog({
  open,
  onOpenChange,
  payment,
  order,
  onUpdate,
  onUpdateComplete,
}: EditPaymentDialogProps) {
  const [method, setMethod] = useState<PaymentMethod>(payment.method);
  const [amount, setAmount] = useState(payment.amount.toFixed(2));
  const [reference, setReference] = useState(payment.reference || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when payment changes
  useEffect(() => {
    setMethod(payment.method);
    setAmount(payment.amount.toFixed(2));
    setReference(payment.reference || '');
    setError(null);
    setSuccess(false);
  }, [payment]);

  const enteredAmount = parseFloat(amount) || 0;

  const hasChanges =
    method !== payment.method ||
    enteredAmount !== payment.amount ||
    (reference || '') !== (payment.reference || '');

  const handleSubmit = async () => {
    if (enteredAmount <= 0) {
      setError('Amount must be greater than zero');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const updates: { method?: PaymentMethod; amount?: number; reference?: string } = {};
      if (method !== payment.method) updates.method = method;
      if (enteredAmount !== payment.amount) updates.amount = enteredAmount;
      if ((reference || '') !== (payment.reference || '')) updates.reference = reference;

      const result = await onUpdate(payment.id, updates);

      if (result) {
        // DB trigger (trg_payment_update_balance) already:
        // 1. Adjusts customer.credit_balance by the diff
        // 2. Recalculates order.payment_status
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onUpdateComplete?.();
          onOpenChange(false);
        }, 1200);
      } else {
        setError('Failed to update payment. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Update failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!isProcessing) {
      setError(null);
      setSuccess(false);
      onOpenChange(open);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            Edit Payment
          </DialogTitle>
          <DialogDescription>
            Recorded {format(new Date(payment.paid_at), 'MMM dd, yyyy HH:mm')}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <CheckCircle2 className="w-16 h-16 text-success" />
            <p className="text-lg font-semibold text-success">Payment Updated!</p>
          </div>
        ) : (
          <div className="space-y-5">
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
              <Label htmlFor="edit-payment-amount" className="text-sm font-medium">
                Amount
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-xs">
                  {CURRENCY_SYMBOL}
                </span>
                <Input
                  id="edit-payment-amount"
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
              {enteredAmount !== payment.amount && enteredAmount > 0 && (
                <p className="text-xs text-muted-foreground">
                  Original: {fc(payment.amount)} →{' '}
                  <span className="font-medium text-foreground">
                    {fc(enteredAmount)}
                  </span>{' '}
                  ({enteredAmount > payment.amount ? '+' : ''}
                  {fc(enteredAmount - payment.amount)})
                </p>
              )}
            </div>

            {/* Reference */}
            <div className="space-y-2">
              <Label htmlFor="edit-payment-ref" className="text-sm font-medium">
                Reference / Transaction ID
              </Label>
              <Input
                id="edit-payment-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Optional reference"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
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
                disabled={isProcessing || !hasChanges || enteredAmount <= 0}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Save Changes
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
