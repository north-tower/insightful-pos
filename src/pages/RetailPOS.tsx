import { useState, useMemo } from 'react';
import { Sidebar } from '@/components/pos/Sidebar';
import { Header } from '@/components/pos/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { retailProducts, retailCategories, Product } from '@/data/productData';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  X,
  Barcode,
  CreditCard,
  Banknote,
  QrCode,
  ShoppingCart,
  Package,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

interface RetailPOSProps {
  onNavigate: (tab: string) => void;
}

interface CartItem {
  product: Product;
  quantity: number;
}

type PaymentMethod = 'cash' | 'card' | 'qr';

export default function RetailPOS({ onNavigate }: RetailPOSProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [barcodeInput, setBarcodeInput] = useState('');

  // Filter products
  const filteredProducts = useMemo(() => {
    let products = retailProducts.filter((p) => p.isActive);
    if (activeCategory !== 'all') {
      products = products.filter((p) => p.category === activeCategory);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode?.includes(q)
      );
    }
    return products;
  }, [activeCategory, searchQuery]);

  // Cart functions
  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      toast.error(`${product.name} is out of stock`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast.error(`Only ${product.stock} in stock`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((item) => item.product.id !== productId));
    } else {
      setCart((prev) =>
        prev.map((item) =>
          item.product.id === productId ? { ...item, quantity } : item
        )
      );
    }
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => setCart([]);

  const subtotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const taxRate = 0.05;
  const tax = subtotal * taxRate;
  const total = subtotal + tax;
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Barcode scan handler
  const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      const product = retailProducts.find(
        (p) => p.barcode === barcodeInput.trim() || p.sku === barcodeInput.trim()
      );
      if (product) {
        addToCart(product);
        toast.success(`Added ${product.name}`);
      } else {
        toast.error('Product not found');
      }
      setBarcodeInput('');
    }
  };

  const handleCompleteSale = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    toast.success(
      `Sale completed! $${total.toFixed(2)} via ${paymentMethod}`
    );
    clearCart();
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar activeTab="pos" onTabChange={onNavigate} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <div className="flex-1 flex overflow-hidden">
          {/* Product Grid Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search & Barcode */}
            <div className="p-4 pb-2 flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search products by name or SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="relative w-64">
                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Scan barcode..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeScan}
                  className="pl-10 font-mono"
                />
              </div>
            </div>

            {/* Category Tabs */}
            <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
              {retailCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded text-sm font-medium whitespace-nowrap transition-all',
                    activeCategory === cat.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                  <span className="text-xs opacity-70">{cat.count}</span>
                </button>
              ))}
            </div>

            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredProducts.map((product) => {
                  const cartItem = cart.find(
                    (c) => c.product.id === product.id
                  );
                  const inCart = cartItem ? cartItem.quantity : 0;
                  const isOutOfStock = product.stock <= 0;
                  const isLowStock =
                    product.stock > 0 &&
                    product.stock <= product.lowStockThreshold;

                  return (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      disabled={isOutOfStock}
                      className={cn(
                        'relative bg-card border rounded p-3 text-left transition-all group',
                        inCart > 0
                          ? 'border-primary shadow-md'
                          : 'border-border hover:border-primary/40',
                        isOutOfStock && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      {/* Image */}
                      <div className="relative aspect-square rounded overflow-hidden bg-muted mb-3">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {isOutOfStock && (
                          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                            <Badge className="bg-destructive text-destructive-foreground text-xs">
                              Out of Stock
                            </Badge>
                          </div>
                        )}
                        {isLowStock && !isOutOfStock && (
                          <div className="absolute top-1.5 right-1.5">
                            <AlertTriangle className="w-4 h-4 text-warning" />
                          </div>
                        )}
                        {inCart > 0 && (
                          <div className="absolute top-1.5 left-1.5 bg-primary text-primary-foreground text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                            {inCart}
                          </div>
                        )}
                        {product.discount && (
                          <div className="absolute bottom-1.5 left-1.5">
                            <Badge className="bg-destructive text-destructive-foreground text-xs">
                              {product.discount}% OFF
                            </Badge>
                          </div>
                        )}
                      </div>

                      {/* Details */}
                      <p className="text-sm font-semibold text-foreground line-clamp-2 mb-1 min-h-[2.5rem]">
                        {product.name}
                      </p>
                      <p className="text-xs text-muted-foreground mb-2">
                        {product.sku}
                        {product.brand && ` • ${product.brand}`}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-base font-bold text-foreground">
                          ${product.price.toFixed(2)}
                        </span>
                        <span
                          className={cn(
                            'text-xs',
                            isOutOfStock
                              ? 'text-destructive'
                              : isLowStock
                              ? 'text-warning'
                              : 'text-muted-foreground'
                          )}
                        >
                          {product.stock} {product.unit}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {filteredProducts.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No products found</p>
                </div>
              )}
            </div>
          </div>

          {/* Cart Panel */}
          <div className="w-80 bg-card border-l border-border flex flex-col h-full">
            {/* Cart Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-bold text-lg text-foreground flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Cart
                </h2>
                {cart.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearCart}
                    className="text-destructive hover:text-destructive text-xs"
                  >
                    Clear
                  </Button>
                )}
              </div>
              {totalItems > 0 && (
                <p className="text-sm text-muted-foreground">
                  {totalItems} items
                </p>
              )}
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Cart is empty</p>
                  <p className="text-xs mt-1">
                    Tap a product or scan barcode
                  </p>
                </div>
              )}

              {cart.map((item) => (
                <div
                  key={item.product.id}
                  className="flex gap-3 p-3 rounded border border-border"
                >
                  <img
                    src={item.product.image}
                    alt={item.product.name}
                    className="w-12 h-12 rounded object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {item.product.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ${item.product.price.toFixed(2)} each
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-6 w-6"
                          onClick={() =>
                            updateCartQuantity(
                              item.product.id,
                              item.quantity - 1
                            )
                          }
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-semibold">
                          {item.quantity}
                        </span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-6 w-6"
                          onClick={() =>
                            updateCartQuantity(
                              item.product.id,
                              item.quantity + 1
                            )
                          }
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">
                          $
                          {(item.product.price * item.quantity).toFixed(2)}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => removeFromCart(item.product.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Payment & Totals */}
            {cart.length > 0 && (
              <div className="p-4 border-t border-border space-y-4">
                {/* Totals */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax (5%)</span>
                    <span>${tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-foreground text-lg pt-2 border-t border-border">
                    <span>Total</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="flex gap-2">
                  {(
                    [
                      { id: 'cash', label: 'Cash', icon: Banknote },
                      { id: 'card', label: 'Card', icon: CreditCard },
                      { id: 'qr', label: 'QR', icon: QrCode },
                    ] as const
                  ).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setPaymentMethod(id)}
                      className={cn(
                        'flex-1 flex flex-col items-center gap-1 py-2 px-3 rounded text-xs font-medium transition-all',
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

                {/* Complete Sale */}
                <Button
                  className="w-full h-12 text-base font-semibold"
                  onClick={handleCompleteSale}
                >
                  Complete Sale — ${total.toFixed(2)}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
