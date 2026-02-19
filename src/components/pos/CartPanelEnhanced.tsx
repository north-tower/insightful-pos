import { Minus, Plus, Trash2, Printer, CreditCard, Banknote, QrCode, Edit2, Settings2, FileText, Save, Split } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCart } from '@/context/CartContext';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';
import { SplitBillDialog } from '@/components/order/SplitBillDialog';
import { ItemModifierDialog } from '@/components/order/ItemModifierDialog';
import { HoldOrderDialog } from '@/components/order/HoldOrderDialog';
import { ReceiptDialog } from '@/components/receipt/ReceiptDialog';
import { KitchenTicket } from '@/components/receipt/KitchenTicket';
import { OrderModifier } from '@/data/orderData';
import { CartItem } from '@/context/CartContext';
import { Badge } from '@/components/ui/badge';
import { ReceiptData } from '@/data/receiptData';

type PaymentMethod = 'cash' | 'card' | 'qr' | 'split';
type OrderType = 'dine-in' | 'takeaway' | 'delivery';

export function CartPanelEnhanced() {
  const {
    items,
    updateQuantity,
    removeItem,
    subtotal,
    tax,
    total,
    clearCart,
    totalItems,
    updateItemNotes,
    addItemModifier,
    removeItemModifier,
    orderNotes,
    setOrderNotes,
    holdOrder,
    heldOrders,
    loadHeldOrder,
    deleteHeldOrder,
  } = useCart();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [orderType, setOrderType] = useState<OrderType>('dine-in');
  const [isSplitDialogOpen, setIsSplitDialogOpen] = useState(false);
  const [isModifierDialogOpen, setIsModifierDialogOpen] = useState(false);
  const [isHoldDialogOpen, setIsHoldDialogOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CartItem | null>(null);
  const [partialPayment, setPartialPayment] = useState<number | null>(null);

  // Calculate item total including modifiers
  const calculateItemTotal = (item: CartItem) => {
    const itemBase = item.price * item.quantity;
    const modifierTotal = (item.modifiers || []).reduce((sum, m) => sum + (m.price || 0) * item.quantity, 0);
    return itemBase + modifierTotal;
  };

  const handleModifyItem = (item: CartItem) => {
    setSelectedItem(item);
    setIsModifierDialogOpen(true);
  };

  const handleSaveModifiers = (modifiers: OrderModifier[], notes: string) => {
    if (!selectedItem) return;

    // Remove old modifiers
    const currentItem = items.find((i) => i.id === selectedItem.id);
    if (currentItem?.modifiers) {
      currentItem.modifiers.forEach((m) => {
        removeItemModifier(selectedItem.id, m.id);
      });
    }

    // Add new modifiers
    modifiers.forEach((modifier) => {
      addItemModifier(selectedItem.id, modifier);
    });

    updateItemNotes(selectedItem.id, notes);
    toast.success('Item customized successfully');
  };

  const handleSplitPayment = (splitPayments: any[]) => {
    setPaymentMethod('split');
    toast.success(`Split payment: ${splitPayments.length} methods`);
    // In a real app, you'd process the split payments here
  };

  const handlePlaceOrder = () => {
    if (items.length === 0) {
      toast.error('Please add items to your order');
      return;
    }
    
    if (paymentMethod === 'split') {
      setIsSplitDialogOpen(true);
      return;
    }

    toast.success('Order placed successfully!');
    clearCart();
    setPartialPayment(null);
  };

  const handlePartialPayment = () => {
    setIsSplitDialogOpen(true);
  };

  const handleHoldOrder = (name: string) => {
    holdOrder(name);
    toast.success(`Order "${name}" saved`);
  };

  const generateReceiptData = (): ReceiptData => {
    return {
      orderId: Date.now().toString(),
      orderNumber: `F${Date.now().toString().slice(-4)}`,
      date: new Date(),
      tableNumber: '04',
      customerName: undefined,
      items: items.map((item) => ({
        ...item,
        modifiers: item.modifiers || [],
        notes: item.notes,
      })) as any,
      subtotal,
      tax,
      total,
      paymentMethod: paymentMethod === 'split' ? 'split' : paymentMethod,
      type: orderType,
      orderNotes,
    };
  };

  const handlePrintReceipt = () => {
    if (items.length === 0) {
      toast.error('No items to print receipt for');
      return;
    }
    setIsReceiptOpen(true);
  };

  const displayTotal = partialPayment !== null ? partialPayment : total;
  const remaining = total - (partialPayment || 0);

  return (
    <>
      <div className="w-80 bg-card border-l border-border flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-lg text-foreground">Table No #04</h2>
              <p className="text-sm text-muted-foreground">Order #F0030 • 2 People</p>
            </div>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Edit2 className="w-4 h-4" />
            </Button>
          </div>

          {/* Order Type */}
          <div className="flex gap-2">
            {(['dine-in', 'takeaway', 'delivery'] as OrderType[]).map((type) => (
              <button
                key={type}
                onClick={() => setOrderType(type)}
                className={cn(
                  'flex-1 py-2 px-3 rounded-lg text-xs font-medium capitalize transition-all',
                  orderType === type
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {type.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Order Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-foreground">Ordered Items</h3>
            <span className="text-sm text-primary font-medium">{totalItems} items</span>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="mb-2">No items added</p>
              <p className="text-sm">Select dishes from the menu</p>
            </div>
          ) : (
            items.map((item) => {
              const itemTotal = calculateItemTotal(item);
              return (
                <div
                  key={item.id}
                  className="flex gap-3 p-3 bg-muted/50 rounded-xl animate-slide-in-right"
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-14 h-14 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-medium text-foreground text-sm">{item.name}</p>
                      <button
                        onClick={() => handleModifyItem(item)}
                        className="text-primary hover:text-primary/80 transition-colors"
                        title="Customize item"
                      >
                        <Settings2 className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-xs text-primary font-semibold">
                      ${item.price.toFixed(2)} × {item.quantity}
                    </p>
                    
                    {/* Modifiers */}
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {item.modifiers.map((mod) => (
                          <div key={mod.id} className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs py-0 px-1.5 h-4">
                              {mod.name}
                            </Badge>
                            {mod.price && mod.price > 0 && (
                              <span className="text-xs text-muted-foreground">
                                +${mod.price.toFixed(2)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Notes */}
                    {item.notes && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        Note: {item.notes}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-6 h-6 rounded-md bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-6 h-6 rounded-md bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-destructive/70 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <p className="font-bold text-foreground text-sm">
                      ${itemTotal.toFixed(2)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Order Notes */}
        {items.length > 0 && (
          <div className="px-4 pb-2 border-t border-border pt-3">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <label className="text-xs font-medium text-muted-foreground">Order Notes</label>
            </div>
            <Textarea
              placeholder="Add order notes..."
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              className="min-h-[60px] text-sm"
            />
          </div>
        )}

        {/* Payment Summary */}
        <div className="p-4 border-t border-border space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Tax (5%)</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            {partialPayment !== null && (
              <>
                <div className="flex justify-between text-info">
                  <span>Paid</span>
                  <span>${partialPayment.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-warning font-medium">
                  <span>Remaining</span>
                  <span>${remaining.toFixed(2)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-bold text-lg text-foreground pt-2 border-t border-border">
              <span>Total</span>
              <span>${displayTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <p className="text-sm font-medium text-foreground mb-2">Payment Method</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'cash' as PaymentMethod, icon: Banknote, label: 'Cash' },
                { id: 'card' as PaymentMethod, icon: CreditCard, label: 'Card' },
                { id: 'qr' as PaymentMethod, icon: QrCode, label: 'Scan' },
                { id: 'split' as PaymentMethod, icon: Split, label: 'Split' },
              ].map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => {
                    setPaymentMethod(id);
                    if (id === 'split') {
                      setIsSplitDialogOpen(true);
                    }
                  }}
                  className={cn(
                    'flex flex-col items-center gap-1 p-2 rounded-xl text-xs font-medium transition-all',
                    paymentMethod === id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1 gap-2" 
                size="sm"
                onClick={handlePrintReceipt}
                disabled={items.length === 0}
              >
                <Printer className="w-4 h-4" />
                Print
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                size="sm"
                onClick={() => setIsHoldDialogOpen(true)}
                disabled={items.length === 0}
              >
                <Save className="w-4 h-4" />
                Hold
              </Button>
            </div>
            {partialPayment === null ? (
              <Button
                onClick={handlePlaceOrder}
                className="w-full gap-2 bg-primary hover:bg-primary/90"
                disabled={items.length === 0}
              >
                Place Order
              </Button>
            ) : (
              <div className="space-y-2">
                <Button
                  onClick={handlePartialPayment}
                  variant="outline"
                  className="w-full gap-2"
                >
                  Add Payment
                </Button>
                <Button
                  onClick={() => {
                    toast.success('Order completed!');
                    clearCart();
                    setPartialPayment(null);
                  }}
                  className="w-full gap-2 bg-success hover:bg-success/90"
                  disabled={remaining > 0.01}
                >
                  Complete Payment
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <SplitBillDialog
        open={isSplitDialogOpen}
        onOpenChange={setIsSplitDialogOpen}
        total={total}
        onConfirm={handleSplitPayment}
      />

      {selectedItem && (
        <ItemModifierDialog
          open={isModifierDialogOpen}
          onOpenChange={setIsModifierDialogOpen}
          item={selectedItem}
          onSave={handleSaveModifiers}
        />
      )}

      <HoldOrderDialog
        open={isHoldDialogOpen}
        onOpenChange={setIsHoldDialogOpen}
        onConfirm={handleHoldOrder}
      />

      {isReceiptOpen && items.length > 0 && (
        <ReceiptDialog
          open={isReceiptOpen}
          onOpenChange={setIsReceiptOpen}
          receiptData={generateReceiptData()}
        />
      )}
    </>
  );
}

