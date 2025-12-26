import { Minus, Plus, Trash2, Printer, CreditCard, Banknote, QrCode, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';

type PaymentMethod = 'cash' | 'card' | 'qr';
type OrderType = 'dine-in' | 'takeaway' | 'delivery';

export function CartPanel() {
  const { items, updateQuantity, removeItem, subtotal, tax, total, clearCart, totalItems } = useCart();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [orderType, setOrderType] = useState<OrderType>('dine-in');

  const handlePlaceOrder = () => {
    if (items.length === 0) {
      toast.error('Please add items to your order');
      return;
    }
    toast.success('Order placed successfully!');
    clearCart();
  };

  return (
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
          items.map((item) => (
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
                <p className="font-medium text-foreground text-sm truncate">{item.name}</p>
                <p className="text-xs text-primary font-semibold">${item.price.toFixed(2)} × {item.quantity}</p>
                <div className="flex items-center gap-2 mt-1">
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
                  ${(item.price * item.quantity).toFixed(2)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

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
          <div className="flex justify-between font-bold text-lg text-foreground pt-2 border-t border-border">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Method */}
        <div>
          <p className="text-sm font-medium text-foreground mb-2">Payment Method</p>
          <div className="flex gap-2">
            {[
              { id: 'cash' as PaymentMethod, icon: Banknote, label: 'Cash' },
              { id: 'card' as PaymentMethod, icon: CreditCard, label: 'Card' },
              { id: 'qr' as PaymentMethod, icon: QrCode, label: 'Scan' },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setPaymentMethod(id)}
                className={cn(
                  'flex-1 flex flex-col items-center gap-1 p-3 rounded-xl text-xs font-medium transition-all',
                  paymentMethod === id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                <Icon className="w-5 h-5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 gap-2">
            <Printer className="w-4 h-4" />
            Print
          </Button>
          <Button onClick={handlePlaceOrder} className="flex-1 gap-2 bg-primary hover:bg-primary/90">
            Place Order
          </Button>
        </div>
      </div>
    </div>
  );
}
