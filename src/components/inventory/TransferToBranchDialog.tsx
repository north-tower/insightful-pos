import { useMemo, useState } from 'react';
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
  product: Product | null;
  onTransferred?: () => void;
}

export default function TransferToBranchDialog({
  open,
  onOpenChange,
  product,
  onTransferred,
}: TransferToBranchDialogProps) {
  const { branches, activeBranch } = useBranch();
  const { transferStock, transferring } = useBranchStockTransfer();
  const [toStoreId, setToStoreId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');

  const destinations = useMemo(
    () =>
      branches.filter(
        (b) =>
          b.id !== activeBranch?.id &&
          (!activeBranch?.business_id || b.business_id === activeBranch.business_id),
      ),
    [branches, activeBranch],
  );

  const available = product ? product.mainStock ?? product.stock : 0;

  const reset = () => {
    setToStoreId('');
    setQuantity('');
    setNote('');
  };

  const handleTransfer = async () => {
    if (!product || !activeBranch) return;
    const qty = parseFloat(quantity);
    if (!toStoreId) {
      toast.error('Select a destination branch');
      return;
    }
    if (Number.isNaN(qty) || qty <= 0) {
      toast.error('Enter a valid quantity');
      return;
    }
    if (qty > available) {
      toast.error(`Only ${available} available at this branch`);
      return;
    }

    try {
      await transferStock({
        fromStoreId: activeBranch.id,
        toStoreId,
        productId: product.id,
        quantity: qty,
        note,
      });
      const dest = destinations.find((d) => d.id === toStoreId);
      toast.success(`Sent ${qty} ${product.unit || 'pcs'} of ${product.name} to ${dest?.name || 'branch'}`);
      reset();
      onOpenChange(false);
      onTransferred?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Transfer failed');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (transferring) return;
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            Send stock to branch
          </DialogTitle>
          <DialogDescription>
            Move stock from {activeBranch?.name || 'this branch'} to another branch under the
            same business. If the product does not exist there, it will be created.
          </DialogDescription>
        </DialogHeader>

        {product && (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
              <p className="font-medium">{product.name}</p>
              <p className="text-xs text-muted-foreground">
                Available here: {available} {product.unit || 'pcs'}
              </p>
            </div>

            {destinations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No other branches available. Add a branch under this business and assign yourself
                to it first.
              </p>
            ) : (
              <>
                <div className="space-y-1">
                  <Label>Destination branch</Label>
                  <Select value={toStoreId || undefined} onValueChange={setToStoreId} disabled={transferring}>
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
                <div className="space-y-1">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    disabled={transferring}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Note (optional)</Label>
                  <Textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={transferring}
                    placeholder="e.g. Restock Westlands for weekend"
                  />
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={transferring} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={transferring || destinations.length === 0 || !product}
            onClick={() => void handleTransfer()}
          >
            {transferring ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Sending…
              </>
            ) : (
              'Send stock'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
