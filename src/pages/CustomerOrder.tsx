import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { useOrderQueue } from '@/context/OrderQueueContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CategoryTabs } from '@/components/pos/CategoryTabs';
import { MenuCard } from '@/components/pos/MenuCard';
import { useProducts } from '@/hooks/useProducts';
import { ShoppingCart, CheckCircle2, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ThemeToggle } from '@/components/ThemeToggle';

type OrderType = 'dine-in' | 'takeaway' | 'delivery';
type OrderSource = 'kiosk' | 'qr' | 'web';

export default function CustomerOrder() {
  const { menuItems, categories, loading } = useProducts();
  const { items, subtotal, tax, total, clearCart, orderNotes, setOrderNotes } = useCart();
  const { submitCustomerOrder } = useOrderQueue();
  const [activeCategory, setActiveCategory] = useState('all');
  const [orderType, setOrderType] = useState<OrderType>('dine-in');
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [trackingCode, setTrackingCode] = useState('');
  const [source] = useState<OrderSource>('qr'); // Could be passed as prop or from URL params

  const filteredItems = useMemo(() => {
    if (activeCategory === 'all') return menuItems;
    return menuItems.filter((item) => item.category === activeCategory);
  }, [activeCategory, menuItems]);

  const handleSubmitOrder = async () => {
    if (items.length === 0) {
      toast.error('Please add items to your order');
      return;
    }

    if (orderType === 'dine-in' && !tableNumber) {
      toast.error('Please enter your table number');
      return;
    }

    setIsSubmitting(true);

    try {
      const order = submitCustomerOrder({
        source,
        customerName: customerName || undefined,
        items: items as any,
        subtotal,
        tax,
        total,
        orderNotes: orderNotes || undefined,
        type: orderType,
        tableNumber: orderType === 'dine-in' ? tableNumber : undefined,
      });

      setTrackingCode(order.trackingCode || '');
      setOrderSubmitted(true);
      clearCart();
      toast.success('Order submitted successfully!');
      
      // Redirect to tracking page
      if (order.trackingCode) {
        setTimeout(() => {
          window.location.href = `/track/${order.trackingCode}`;
        }, 2000);
      }
    } catch (error) {
      toast.error('Failed to submit order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (orderSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-2">Order Submitted!</h1>
              <p className="text-muted-foreground">
                Your order has been received and is being processed.
              </p>
            </div>
            {trackingCode && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Tracking Code</p>
                <p className="text-2xl font-bold font-mono">{trackingCode}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Use this code to track your order status
                </p>
              </div>
            )}
            <Button
              onClick={() => {
                setOrderSubmitted(false);
                setTrackingCode('');
                setCustomerName('');
                setPhone('');
                setEmail('');
                setTableNumber('');
              }}
              className="w-full"
            >
              Place Another Order
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Nexus Restaurant</h1>
            <p className="text-sm opacity-90">Place Your Order</p>
          </div>
          <ThemeToggle variant="primary" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Menu Section */}
          <div className="lg:col-span-2">
            {/* Order Type Selection */}
            <div className="mb-6">
              <Label className="mb-2 block">Order Type</Label>
              <div className="flex gap-2">
                {(['dine-in', 'takeaway', 'delivery'] as OrderType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setOrderType(type)}
                    className={cn(
                      'flex-1 py-2 px-4 rounded-lg text-sm font-medium capitalize transition-all',
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

            {/* Customer Information */}
            <Card className="mb-6">
              <CardContent className="p-4 space-y-4">
                <h2 className="font-semibold">Your Information</h2>
                {orderType === 'dine-in' && (
                  <div>
                    <Label htmlFor="tableNumber">Table Number *</Label>
                    <Input
                      id="tableNumber"
                      placeholder="Enter your table number"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      className="mt-1"
                      required
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="customerName">Name</Label>
                    <Input
                      id="customerName"
                      placeholder="Your name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="Phone number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">Email (optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Menu Categories */}
            <CategoryTabs
              categories={categories}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
            />

            {/* Menu Items */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
              {filteredItems.map((item) => (
                <MenuCard key={item.id} item={item} />
              ))}
            </div>
          </div>

          {/* Cart Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <ShoppingCart className="w-5 h-5" />
                  <h2 className="font-semibold text-lg">Your Order</h2>
                  <span className="ml-auto text-sm text-muted-foreground">
                    {items.reduce((sum, i) => sum + i.quantity, 0)} items
                  </span>
                </div>

                {/* Order Items */}
                <div className="space-y-3 max-h-[300px] overflow-y-auto mb-4">
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Your cart is empty
                    </p>
                  ) : (
                    items.map((item) => (
                      <div key={item.id} className="flex items-start gap-3 text-sm">
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-muted-foreground">
                            ${item.price.toFixed(2)} × {item.quantity}
                          </p>
                        </div>
                        <p className="font-semibold">
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Order Notes */}
                {items.length > 0 && (
                  <div className="mb-4">
                    <Label htmlFor="orderNotes" className="text-sm">Special Instructions</Label>
                    <Textarea
                      id="orderNotes"
                      placeholder="Any special requests..."
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      className="mt-1 min-h-[60px] text-sm"
                    />
                  </div>
                )}

                {/* Totals */}
                {items.length > 0 && (
                  <div className="space-y-2 mb-4 pt-4 border-t">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span>${tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg pt-2 border-t">
                      <span>Total</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  onClick={handleSubmitOrder}
                  disabled={items.length === 0 || isSubmitting}
                  className="w-full"
                  size="lg"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Order'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

