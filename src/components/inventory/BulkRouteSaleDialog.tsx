import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  FileText,
  Loader2,
  ShoppingCart,
  Smartphone,
  Landmark,
  User,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { fc } from '@/lib/currency';
import { toast } from 'sonner';
import { useOrders, type PaymentMethod, type SaleType } from '@/hooks/useOrders';
import { useCustomers, type Customer } from '@/hooks/useCustomers';

export type BulkRouteSaleLine = {
  allocationId: string;
  productId: string;
  productName: string;
  unit: string;
  unitPrice: number;
  unitCost?: number;
  sku?: string;
  barcode?: string;
  assignedQty: number;
  soldQty: number;
  remaining: number;
  isActive: boolean;
};

export type BulkRouteSaleAssignment = {
  id: string;
  cashierId: string;
  cashierName: string;
  assignmentDate: string;
  routeName: string;
  lines: BulkRouteSaleLine[];
};

const paymentOptions: Array<{
  id: PaymentMethod;
  label: string;
  icon: typeof Banknote;
}> = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'mpesa', label: 'M-Pesa', icon: Smartphone },
  { id: 'card', label: 'Bank', icon: Landmark },
];

function parseQty(raw: string): number {
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : NaN;
}

function assignmentCreatedAtIso(assignmentDate: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(assignmentDate)) {
    const d = new Date(`${assignmentDate}T12:00:00`);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

interface BulkRouteSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: BulkRouteSaleAssignment | null;
  onCompleted?: () => void | Promise<void>;
}

export function BulkRouteSaleDialog({
  open,
  onOpenChange,
  assignment,
  onCompleted,
}: BulkRouteSaleDialogProps) {
  const { createOrder } = useOrders();
  const { customers, getCustomerDisplayName } = useCustomers();

  const [soldQtyByProduct, setSoldQtyByProduct] = useState<Record<string, string>>({});
  const [saleType, setSaleType] = useState<SaleType>('cash');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !assignment) return;
    setSoldQtyByProduct({});
    setSaleType('cash');
    setPaymentMethod('cash');
    setPaymentReference('');
    setSelectedCustomer(null);
    setCustomerSearch('');
    setShowCustomerPicker(false);
    setIsSubmitting(false);
  }, [open, assignment?.id]);

  const sellableLines = useMemo(
    () => (assignment?.lines ?? []).filter((line) => line.isActive && line.remaining > 0),
    [assignment],
  );

  const draftLines = useMemo(() => {
    return sellableLines
      .map((line) => {
        const qty = parseQty(soldQtyByProduct[line.productId] || '');
        return { line, qty };
      })
      .filter(({ qty }) => !isNaN(qty) && qty > 0);
  }, [sellableLines, soldQtyByProduct]);

  const validationError = useMemo(() => {
    for (const { line, qty } of draftLines) {
      if (qty > line.remaining + 1e-9) {
        return `${line.productName}: sold qty exceeds remaining (${line.remaining})`;
      }
    }
    if (saleType === 'credit' && !selectedCustomer) {
      return 'Select a customer for credit sales';
    }
    return null;
  }, [draftLines, saleType, selectedCustomer]);

  const subtotal = draftLines.reduce(
    (sum, { line, qty }) => sum + line.unitPrice * qty,
    0,
  );
  const totalUnits = draftLines.reduce((sum, { qty }) => sum + qty, 0);
  const canSubmit =
    draftLines.length > 0 && !validationError && !isSubmitting && Boolean(assignment);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers.slice(0, 20);
    return customers
      .filter((c) => {
        const name = getCustomerDisplayName(c).toLowerCase();
        return (
          name.includes(q) ||
          (c.phone || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 20);
  }, [customers, customerSearch, getCustomerDisplayName]);

  const fillRemaining = () => {
    const next: Record<string, string> = {};
    for (const line of sellableLines) {
      next[line.productId] = String(line.remaining);
    }
    setSoldQtyByProduct(next);
  };

  const clearQtys = () => setSoldQtyByProduct({});

  const handleSubmit = async () => {
    if (!assignment || !canSubmit) return;
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast.error('Bulk route sales require an online connection');
      return;
    }

    setIsSubmitting(true);
    try {
      const items = draftLines.map(({ line, qty }) => ({
        product_id: line.productId,
        product_name: line.productName,
        unit_price: line.unitPrice,
        unit_cost: line.unitCost,
        quantity: qty,
        sku: line.sku,
        barcode: line.barcode,
      }));

      const payments =
        saleType === 'cash'
          ? [
              {
                method: paymentMethod,
                amount: subtotal,
                reference: paymentReference.trim() || undefined,
                description: `Bulk route sale · ${assignment.routeName}`,
              },
            ]
          : [];

      const order = await createOrder({
        order_type: 'pos',
        sale_type: saleType,
        assignment_id: assignment.id,
        staff_id: assignment.cashierId,
        staff_name: assignment.cashierName,
        created_at: assignmentCreatedAtIso(assignment.assignmentDate),
        customer_id: selectedCustomer?.id,
        customer_name: selectedCustomer
          ? getCustomerDisplayName(selectedCustomer)
          : undefined,
        customer_phone: selectedCustomer?.phone || undefined,
        customer_email: selectedCustomer?.email || undefined,
        notes: `Bulk route checkout · ${assignment.routeName}`,
        items,
        payments,
      });

      if (!order) {
        toast.error('Failed to create bulk sale');
        return;
      }

      toast.success(
        `Bulk sale recorded · ${order.invoice_number || order.order_number} · ${fc(subtotal)}`,
      );
      onOpenChange(false);
      await onCompleted?.();
    } catch (err: any) {
      console.error('Bulk route sale failed:', err);
      toast.error(err?.message || 'Failed to create bulk sale');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Record route sales
          </DialogTitle>
          <DialogDescription>
            {assignment
              ? `${assignment.routeName} · ${assignment.cashierName} · ${assignment.assignmentDate}`
              : 'Enter sold quantities for this assignment and post one checkout.'}
          </DialogDescription>
        </DialogHeader>

        {!assignment ? (
          <p className="text-sm text-muted-foreground">No assignment selected.</p>
        ) : sellableLines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No remaining assigned stock to sell on this route.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={fillRemaining}>
                Fill remaining
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={clearQtys}>
                Clear
              </Button>
              <Badge variant="outline" className="ml-auto text-xs">
                {draftLines.length} line{draftLines.length === 1 ? '' : 's'} · {totalUnits}{' '}
                units
              </Badge>
            </div>

            <div className="rounded-lg border border-border">
              <div className="grid grid-cols-[1fr_4rem_4rem_5rem] gap-2 border-b border-border px-3 py-2 text-[10px] font-medium uppercase text-muted-foreground">
                <span>Product</span>
                <span className="text-center">Left</span>
                <span className="text-center">Sold</span>
                <span className="text-right">Now</span>
              </div>
              <ul className="max-h-56 divide-y divide-border overflow-y-auto">
                {sellableLines.map((line) => {
                  const raw = soldQtyByProduct[line.productId] || '';
                  const qty = parseQty(raw);
                  const over = !isNaN(qty) && qty > line.remaining;
                  return (
                    <li
                      key={line.allocationId}
                      className="grid grid-cols-[1fr_4rem_4rem_5rem] items-center gap-2 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{line.productName}</p>
                        <p className="text-[10px] text-muted-foreground tabular-nums">
                          {fc(line.unitPrice)}/{line.unit || 'unit'}
                        </p>
                      </div>
                      <span className="text-center text-xs tabular-nums text-muted-foreground">
                        {line.remaining}
                      </span>
                      <span className="text-center text-xs tabular-nums text-muted-foreground">
                        {line.soldQty}
                      </span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        max={line.remaining}
                        placeholder="0"
                        value={raw}
                        onChange={(e) =>
                          setSoldQtyByProduct((prev) => ({
                            ...prev,
                            [line.productId]: e.target.value,
                          }))
                        }
                        className={cn(
                          'h-8 text-center text-sm',
                          over && 'border-destructive focus-visible:ring-destructive',
                        )}
                        disabled={isSubmitting}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="flex rounded-lg border border-border bg-muted/60 p-1">
              <button
                type="button"
                onClick={() => setSaleType('cash')}
                className={cn(
                  'flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium',
                  saleType === 'cash'
                    ? 'bg-primary font-semibold text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Banknote className="h-3.5 w-3.5" />
                Cash Sale
              </button>
              <button
                type="button"
                onClick={() => {
                  setSaleType('credit');
                  if (!selectedCustomer) setShowCustomerPicker(true);
                }}
                className={cn(
                  'flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium',
                  saleType === 'credit'
                    ? 'bg-primary font-semibold text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <FileText className="h-3.5 w-3.5" />
                Credit Sale
              </button>
            </div>

            {saleType === 'cash' && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Payment method</p>
                <div className="grid grid-cols-3 gap-2">
                  {paymentOptions.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPaymentMethod(id)}
                      className={cn(
                        'flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg border-2 px-1 py-2 text-center text-[10px] font-medium',
                        paymentMethod === id
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border text-muted-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
                {(paymentMethod === 'mpesa' || paymentMethod === 'card') && (
                  <Input
                    placeholder={
                      paymentMethod === 'mpesa'
                        ? 'M-Pesa confirmation (optional)'
                        : 'Bank reference (optional)'
                    }
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="h-9 text-sm"
                  />
                )}
              </div>
            )}

            {(saleType === 'credit' || showCustomerPicker || selectedCustomer) && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Customer{saleType === 'credit' ? ' (required)' : ' (optional)'}
                </p>
                {selectedCustomer && !showCustomerPicker ? (
                  <div className="flex items-center justify-between rounded border border-border bg-muted/40 p-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs font-semibold">
                          {getCustomerDisplayName(selectedCustomer)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {selectedCustomer.phone || selectedCustomer.email || ''}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="flex min-h-8 min-w-8 items-center justify-center text-muted-foreground"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setShowCustomerPicker(true);
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded border border-border">
                    <div className="border-b border-border p-2">
                      <Input
                        placeholder="Search customers..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="h-8 text-xs"
                        autoFocus={saleType === 'credit'}
                      />
                    </div>
                    <div className="max-h-32 overflow-y-auto">
                      {filteredCustomers.length === 0 ? (
                        <p className="py-3 text-center text-xs text-muted-foreground">
                          No customers found
                        </p>
                      ) : (
                        filteredCustomers.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-muted"
                            onClick={() => {
                              setSelectedCustomer(customer);
                              setShowCustomerPicker(false);
                              setCustomerSearch('');
                            }}
                          >
                            <span className="font-medium">
                              {getCustomerDisplayName(customer)}
                            </span>
                            <span className="text-muted-foreground">
                              {customer.phone || ''}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                    {saleType !== 'credit' && (
                      <div className="border-t border-border p-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-full text-xs"
                          onClick={() => setShowCustomerPicker(false)}
                        >
                          Skip customer
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-xl font-bold tabular-nums">{fc(subtotal)}</span>
            </div>

            {validationError && (
              <p className="text-xs text-destructive">{validationError}</p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={!canSubmit}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Recording…
              </>
            ) : saleType === 'credit' ? (
              `Create Invoice — ${fc(subtotal)}`
            ) : (
              `Complete Sale — ${fc(subtotal)}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
