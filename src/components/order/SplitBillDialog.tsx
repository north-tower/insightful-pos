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
import { CreditCard, Banknote, QrCode, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SplitPayment } from '@/data/orderData';

interface SplitBillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  onConfirm: (payments: SplitPayment[]) => void;
}

type PaymentMethod = 'cash' | 'card' | 'qr';

export function SplitBillDialog({ open, onOpenChange, total, onConfirm }: SplitBillDialogProps) {
  const [payments, setPayments] = useState<Array<{ method: PaymentMethod; amount: number }>>([
    { method: 'card', amount: 0 },
  ]);

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = total - totalPaid;
  const isComplete = remaining <= 0.01;

  const addPayment = () => {
    setPayments([...payments, { method: 'card', amount: Math.max(0, remaining) }]);
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const updatePayment = (index: number, field: 'method' | 'amount', value: PaymentMethod | number) => {
    setPayments(
      payments.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const handleConfirm = () => {
    const splitPayments: SplitPayment[] = payments
      .filter((p) => p.amount > 0)
      .map((p) => ({
        id: Date.now().toString() + Math.random(),
        method: p.method,
        amount: p.amount,
        paidAt: new Date(),
      }));
    onConfirm(splitPayments);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Split Bill</DialogTitle>
          <DialogDescription>
            Split the payment across multiple methods
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Total */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Amount</span>
              <span className="text-2xl font-bold">${total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm text-muted-foreground">Remaining</span>
              <span className={cn(
                "text-lg font-semibold",
                isComplete ? "text-success" : "text-foreground"
              )}>
                ${Math.abs(remaining).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="space-y-3">
            {payments.map((payment, index) => (
              <div key={index} className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1">Method</Label>
                  <div className="flex gap-1">
                    {(['cash', 'card', 'qr'] as PaymentMethod[]).map((method) => (
                      <button
                        key={method}
                        onClick={() => updatePayment(index, 'method', method)}
                        className={cn(
                          'flex-1 p-2 rounded-lg text-xs font-medium transition-all',
                          payment.method === method
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        )}
                      >
                        {method === 'cash' && <Banknote className="w-4 h-4 mx-auto" />}
                        {method === 'card' && <CreditCard className="w-4 h-4 mx-auto" />}
                        {method === 'qr' && <QrCode className="w-4 h-4 mx-auto" />}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1">Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max={total}
                    value={payment.amount.toFixed(2)}
                    onChange={(e) => updatePayment(index, 'amount', parseFloat(e.target.value) || 0)}
                  />
                </div>
                {payments.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removePayment(index)}
                    className="mb-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {!isComplete && (
            <Button
              variant="outline"
              onClick={addPayment}
              className="w-full gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Payment Method
            </Button>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!isComplete}
              className="flex-1"
            >
              Confirm Split Payment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


