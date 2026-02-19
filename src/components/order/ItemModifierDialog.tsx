import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { CartItem } from '@/context/CartContext';
import { OrderModifier, modifierOptions } from '@/data/orderData';
import { Plus, X } from 'lucide-react';

interface ItemModifierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CartItem;
  onSave: (modifiers: OrderModifier[], notes: string) => void;
}

export function ItemModifierDialog({ open, onOpenChange, item, onSave }: ItemModifierDialogProps) {
  const [selectedModifiers, setSelectedModifiers] = useState<OrderModifier[]>(item.modifiers || []);
  const [notes, setNotes] = useState(item.notes || '');

  const toggleModifier = (option: typeof modifierOptions.addons[0], type: 'add-on' | 'substitution') => {
    const modifierId = option.id;
    const exists = selectedModifiers.find((m) => m.id === modifierId);

    if (exists) {
      setSelectedModifiers(selectedModifiers.filter((m) => m.id !== modifierId));
    } else {
      setSelectedModifiers([
        ...selectedModifiers,
        {
          id: modifierId,
          type,
          name: option.name,
          price: option.price,
          originalItemId: item.id,
        },
      ]);
    }
  };

  const handleSave = () => {
    onSave(selectedModifiers, notes);
    onOpenChange(false);
  };

  const modifierTotal = selectedModifiers.reduce((sum, m) => sum + (m.price || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Customize {item.name}</DialogTitle>
          <DialogDescription>
            Add modifiers, substitutions, or notes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add-ons */}
          <div>
            <Label className="text-sm font-semibold mb-3 block">Add-ons</Label>
            <div className="space-y-2">
              {modifierOptions.addons.map((option) => {
                const isSelected = selectedModifiers.some((m) => m.id === option.id);
                return (
                  <div key={option.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleModifier(option, 'add-on')}
                      />
                      <span className="text-sm">{option.name}</span>
                    </div>
                    <span className="text-sm font-medium">+${option.price.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Substitutions */}
          <div>
            <Label className="text-sm font-semibold mb-3 block">Substitutions</Label>
            <div className="space-y-2">
              {modifierOptions.substitutions.map((option) => {
                const isSelected = selectedModifiers.some((m) => m.id === option.id);
                return (
                  <div key={option.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleModifier(option, 'substitution')}
                      />
                      <span className="text-sm">{option.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes" className="text-sm font-semibold mb-2 block">
              Special Instructions
            </Label>
            <Textarea
              id="notes"
              placeholder="Add any special instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {/* Total */}
          {modifierTotal > 0 && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Add-ons Total</span>
                <span className="font-semibold">+${modifierTotal.toFixed(2)}</span>
              </div>
            </div>
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
            <Button onClick={handleSave} className="flex-1">
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


