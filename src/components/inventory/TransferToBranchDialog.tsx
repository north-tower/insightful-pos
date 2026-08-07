import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Loader2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Product } from '@/hooks/useProducts';
import { useBranch } from '@/context/BranchContext';
import { useBranchStockTransfer } from '@/hooks/useBranchStockTransfer';
import { toast } from 'sonner';

interface TransferToBranchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** One or more products to send */
  products: Product[];
  onTransferred?: () => void;
}

function availableStock(product: Product): number {
  return product.mainStock ?? product.stock;
}

export default function TransferToBranchDialog({
  open,
  onOpenChange,
  products,
  onTransferred,
}: TransferToBranchDialogProps) {
  const { branches, activeBranch } = useBranch();
  const { transferStock, transferring } = useBranchStockTransfer();
  const [toStoreId, setToStoreId] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const isBulk = products.length > 1;
  const primary = products[0] || null;

  const destinations = useMemo(
    () =>
      branches.filter(
        (b) =>
          b.id !== activeBranch?.id &&
          (!activeBranch?.business_id || b.business_id === activeBranch.business_id),
      ),
    [branches, activeBranch],
  );

  useEffect(() => {
    if (!open) return;
    const next: Record<string, string> = {};
    for (const p of products) {
      const avail = availableStock(p);
      // Prefill with available stock so bulk send is one click after picking branch
      next[p.id] = avail > 0 ? String(avail) : '';
    }
    setQuantities(next);
    setToStoreId('');
    setNote('');
    setProgress(null);
  }, [open, products]);

  const reset = () => {
    setToStoreId('');
    setQuantities({});
    setNote('');
    setProgress(null);
  };

  const setQty = (productId: string, value: string) => {
    setQuantities((prev) => ({ ...prev, [productId]: value }));
  };

  const linesToSend = useMemo(() => {
    return products
      .map((p) => {
        const qty = parseFloat(quantities[p.id] || '');
        return { product: p, qty, available: availableStock(p) };
      })
      .filter((line) => Number.isFinite(line.qty) && line.qty > 0);
  }, [products, quantities]);

  const handleTransfer = async () => {
    if (!activeBranch || products.length === 0) return;
    if (!toStoreId) {
      toast.error('Select a destination branch');
      return;
    }
    if (linesToSend.length === 0) {
      toast.error('Enter a quantity for at least one product');
      return;
    }

    const over = linesToSend.find((l) => l.qty > l.available);
    if (over) {
      toast.error(
        `Only ${over.available} available for "${over.product.name}" at this branch`,
      );
      return;
    }

    const dest = destinations.find((d) => d.id === toStoreId);
    let ok = 0;
    const failures: string[] = [];
    setProgress({ done: 0, total: linesToSend.length });

    try {
      for (let i = 0; i < linesToSend.length; i++) {
        const line = linesToSend[i];
        try {
          await transferStock({
            fromStoreId: activeBranch.id,
            toStoreId,
            productId: line.product.id,
            quantity: line.qty,
            note,
          });
          ok += 1;
        } catch (err: unknown) {
          failures.push(
            `${line.product.name}: ${err instanceof Error ? err.message : 'failed'}`,
          );
        }
        setProgress({ done: i + 1, total: linesToSend.length });
      }

      if (ok > 0 && failures.length === 0) {
        toast.success(
          isBulk
            ? `Sent ${ok} product${ok === 1 ? '' : 's'} to ${dest?.name || 'branch'}`
            : `Sent ${linesToSend[0].qty} ${linesToSend[0].product.unit || 'pcs'} of ${linesToSend[0].product.name} to ${dest?.name || 'branch'}`,
        );
        reset();
        onOpenChange(false);
        onTransferred?.();
      } else if (ok > 0) {
        toast.warning(`Sent ${ok}, ${failures.length} failed. ${failures[0]}`);
        onTransferred?.();
      } else {
        toast.error(failures[0] || 'Transfer failed');
      }
    } finally {
      setProgress(null);
    }
  };

  const busy = transferring || progress !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (busy) return;
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className={isBulk ? 'max-w-lg max-h-[90vh] overflow-y-auto' : 'max-w-md'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            {isBulk ? `Send ${products.length} products to branch` : 'Send stock to branch'}
          </DialogTitle>
          <DialogDescription>
            Move stock from {activeBranch?.name || 'this branch'} to another branch under the
            same business. Missing products at the destination are created automatically.
          </DialogDescription>
        </DialogHeader>

        {products.length > 0 && (
          <div className="space-y-4">
            {!isBulk && primary && (
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
                <p className="font-medium">{primary.name}</p>
                <p className="text-xs text-muted-foreground">
                  Available here: {availableStock(primary)} {primary.unit || 'pcs'}
                </p>
              </div>
            )}

            {destinations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No other branches available. Add a branch under this business and assign yourself
                to it first.
              </p>
            ) : (
              <>
                <div className="space-y-1">
                  <Label>Destination branch</Label>
                  <Select
                    value={toStoreId || undefined}
                    onValueChange={setToStoreId}
                    disabled={busy}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {destinations.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                          {b.is_headquarters ? ' (HQ)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {isBulk ? (
                  <div className="rounded-md border border-border overflow-hidden">
                    <div className="max-h-56 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                          <tr>
                            <th className="text-left p-2 font-medium">Product</th>
                            <th className="text-right p-2 font-medium w-20">Avail</th>
                            <th className="text-right p-2 font-medium w-28">Send qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {products.map((p) => {
                            const avail = availableStock(p);
                            return (
                              <tr key={p.id} className="border-t border-border/70">
                                <td className="p-2">
                                  <p className="font-medium leading-tight">{p.name}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {p.unit || 'pcs'}
                                  </p>
                                </td>
                                <td className="p-2 text-right tabular-nums text-muted-foreground">
                                  {avail}
                                </td>
                                <td className="p-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="any"
                                    max={avail}
                                    value={quantities[p.id] ?? ''}
                                    onChange={(e) => setQty(p.id, e.target.value)}
                                    disabled={busy || avail <= 0}
                                    className="h-8 text-right"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="border-t border-border bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground">
                      Prefills available stock — edit any qty or clear rows you don&apos;t want to
                      send. {linesToSend.length} line
                      {linesToSend.length === 1 ? '' : 's'} ready.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={quantities[primary?.id || ''] ?? ''}
                      onChange={(e) => primary && setQty(primary.id, e.target.value)}
                      disabled={busy}
                      placeholder="0"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <Label>Note (optional)</Label>
                  <Textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={busy}
                    placeholder="e.g. Restock branch for weekend"
                  />
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={busy || destinations.length === 0 || products.length === 0}
            onClick={() => void handleTransfer()}
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                {progress
                  ? `Sending ${progress.done}/${progress.total}…`
                  : 'Sending…'}
              </>
            ) : isBulk ? (
              `Send ${linesToSend.length || products.length} products`
            ) : (
              'Send stock'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
