import { useState, useMemo } from 'react';
import { PageLayout } from '@/components/pos/PageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useProducts } from '@/hooks/useProducts';
import { useOrders, SaleOrder, SaleType } from '@/hooks/useOrders';
import { useCustomers, Customer } from '@/hooks/useCustomers';
import type { Product } from '@/hooks/useProducts';
import { InvoiceDialog } from '@/components/receipt/InvoiceDialog';
import { ReceiptData } from '@/data/receiptData';
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
  Loader2,
  Printer,
  FileText,
  User,
  UserPlus,
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
  const { retailProducts, retailCategories, loading, refetch: refetchProducts } = useProducts();
  const { createOrder } = useOrders();
  const { customers, getCustomerDisplayName } = useCustomers();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [saleType, setSaleType] = useState<SaleType>('cash');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<SaleOrder | null>(null);
  const [lastOrderCustomer, setLastOrderCustomer] = useState<Customer | null>(null);

  // Customer search filter
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return customers.filter(c => c.status !== 'inactive');
    const q = customerSearchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        c.status !== 'inactive' &&
        (`${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q)),
    );
  }, [customers, customerSearchQuery]);

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
  }, [activeCategory, searchQuery, retailProducts]);

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
      const barcodeVal = barcodeInput.trim();
      const product = retailProducts.find(
        (p) => p.barcode === barcodeVal || p.sku === barcodeVal
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

  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    if (saleType === 'credit' && !selectedCustomer) {
      toast.error('Please select a customer for credit sale');
      setShowCustomerPicker(true);
      return;
    }

    setIsProcessing(true);

    try {
      // For credit sales, no payment upfront
      const payments =
        saleType === 'credit'
          ? []
          : [{ method: paymentMethod, amount: total }];

      const dueDate = saleType === 'credit'
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : undefined;

      const order = await createOrder({
        order_type: 'pos',
        sale_type: saleType,
        customer_id: selectedCustomer?.id,
        customer_name: selectedCustomer
          ? getCustomerDisplayName(selectedCustomer)
          : undefined,
        customer_email: selectedCustomer?.email,
        customer_phone: selectedCustomer?.phone,
        due_date: dueDate,
        items: cart.map((item) => ({
          product_id: item.product.id,
          product_name: item.product.name,
          product_image: item.product.image,
          unit_price: item.product.price,
          quantity: item.quantity,
          sku: item.product.sku,
          barcode: item.product.barcode,
        })),
        payments,
      });

      if (order) {
        setLastOrder(order);
        setLastOrderCustomer(selectedCustomer);
        const label = saleType === 'credit' ? 'Credit invoice' : 'Sale';
        toast.success(`${label} #${order.invoice_number || order.order_number} — $${order.total.toFixed(2)}`);
        setIsInvoiceOpen(true);
        clearCart();
        setSelectedCustomer(null);
        setSaleType('cash');
        refetchProducts();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete sale');
    } finally {
      setIsProcessing(false);
    }
  };

  const generateReceiptData = (order: SaleOrder): ReceiptData => {
    return {
      orderId: order.id,
      orderNumber: order.order_number,
      date: new Date(order.created_at),
      items: order.items.map((item) => ({
        id: item.product_id || item.id,
        name: item.product_name,
        price: item.unit_price,
        category: '',
        image: item.product_image || '',
        quantity: item.quantity,
        modifiers: [],
        notes: item.notes,
      })) as any,
      subtotal: order.subtotal,
      tax: order.tax_amount,
      discount: order.discount_amount > 0 ? order.discount_amount : undefined,
      total: order.total,
      paymentMethod: order.payments[0]?.method || 'cash',
      type: 'dine-in', // Retail doesn't use this field, but type requires it
      staffName: order.staff_name,
    };
  };

  return (
    <PageLayout activeTab="pos" onNavigate={onNavigate} flexContent>
          {/* Product Grid Area */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Search & Barcode */}
            <div className="p-3 sm:p-4 pb-2 flex flex-col sm:flex-row gap-2 sm:gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="relative sm:w-48 lg:w-64">
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
            <div className="px-3 sm:px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
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
            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-3">
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

          {/* Cart Panel — bottom on mobile, right sidebar on lg+ */}
          <div className="w-full lg:w-80 bg-card border-t lg:border-t-0 lg:border-l border-border flex flex-col h-auto max-h-[50vh] lg:max-h-none lg:h-full shrink-0">
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

              {/* Sale Type Toggle */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => {
                    setSaleType('cash');
                    if (saleType === 'credit') setSelectedCustomer(null);
                  }}
                  className={cn(
                    'flex-1 py-1.5 px-3 rounded text-xs font-semibold transition-all flex items-center justify-center gap-1',
                    saleType === 'cash'
                      ? 'bg-success/15 text-success border border-success/30'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  <Banknote className="w-3 h-3" />
                  Cash Sale
                </button>
                <button
                  onClick={() => {
                    setSaleType('credit');
                    if (!selectedCustomer) setShowCustomerPicker(true);
                  }}
                  className={cn(
                    'flex-1 py-1.5 px-3 rounded text-xs font-semibold transition-all flex items-center justify-center gap-1',
                    saleType === 'credit'
                      ? 'bg-warning/15 text-warning border border-warning/30'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  <FileText className="w-3 h-3" />
                  Credit Sale
                </button>
              </div>

              {/* Customer picker for credit sales */}
              {saleType === 'credit' && (
                <div className="mt-2">
                  {selectedCustomer ? (
                    <div className="flex items-center justify-between p-2 bg-warning/5 border border-warning/20 rounded text-sm">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-warning" />
                        <div>
                          <p className="font-semibold text-foreground text-xs">
                            {getCustomerDisplayName(selectedCustomer)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Balance: ${selectedCustomer.credit_balance.toFixed(2)}
                            {selectedCustomer.credit_limit > 0 &&
                              ` / Limit: $${selectedCustomer.credit_limit.toFixed(2)}`}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedCustomer(null);
                          setShowCustomerPicker(true);
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowCustomerPicker(true)}
                      className="w-full p-2 border border-dashed border-warning/40 rounded text-warning text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-warning/5 transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Select Customer
                    </button>
                  )}
                </div>
              )}

              {/* Customer picker dropdown */}
              {showCustomerPicker && (
                <div className="mt-2 border border-border rounded bg-card shadow-lg max-h-48 overflow-hidden">
                  <div className="p-2 border-b border-border">
                    <Input
                      placeholder="Search customers..."
                      value={customerSearchQuery}
                      onChange={(e) => setCustomerSearchQuery(e.target.value)}
                      className="h-7 text-xs"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-32 overflow-y-auto">
                    {filteredCustomers.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">
                        No customers found
                      </p>
                    ) : (
                      filteredCustomers.map((customer) => (
                        <button
                          key={customer.id}
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setShowCustomerPicker(false);
                            setCustomerSearchQuery('');
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-muted transition-colors flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-medium text-foreground">
                              {getCustomerDisplayName(customer)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {customer.phone || customer.email || ''}
                            </p>
                          </div>
                          <div className="text-right">
                            {customer.credit_balance > 0 && (
                              <Badge variant="outline" className="text-[10px] text-warning border-warning/30">
                                ${customer.credit_balance.toFixed(2)}
                              </Badge>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="p-2 border-t border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs h-6"
                      onClick={() => {
                        setShowCustomerPicker(false);
                        setCustomerSearchQuery('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
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

                {/* Payment Method — hidden for credit sales */}
                {saleType === 'cash' && (
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
                )}

                {/* Credit sale info */}
                {saleType === 'credit' && (
                  <div className="p-2 bg-warning/5 border border-warning/20 rounded text-xs text-muted-foreground">
                    <p className="font-semibold text-warning mb-0.5">Credit Sale</p>
                    <p>Invoice will be added to customer's balance.</p>
                  </div>
                )}

                {/* Complete Sale */}
                <Button
                  className={cn(
                    "w-full h-12 text-base font-semibold",
                    saleType === 'credit'
                      ? 'bg-warning hover:bg-warning/90 text-warning-foreground'
                      : ''
                  )}
                  onClick={handleCompleteSale}
                  disabled={isProcessing || (saleType === 'credit' && !selectedCustomer)}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Processing…
                    </>
                  ) : saleType === 'credit' ? (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      Create Invoice — ${total.toFixed(2)}
                    </>
                  ) : (
                    `Complete Sale — $${total.toFixed(2)}`
                  )}
                </Button>

                {/* Last receipt quick print */}
                {lastOrder && (
                  <Button
                    variant="outline"
                    className="w-full gap-2 mt-2"
                    size="sm"
                    onClick={() => setIsInvoiceOpen(true)}
                  >
                    <Printer className="w-4 h-4" />
                    Reprint #{lastOrder.invoice_number || lastOrder.order_number}
                  </Button>
                )}
              </div>
            )}
          </div>

      {/* Invoice/Receipt Dialog */}
      {isInvoiceOpen && lastOrder && (
        <InvoiceDialog
          open={isInvoiceOpen}
          onOpenChange={(open) => {
            setIsInvoiceOpen(open);
            if (!open) {
              setLastOrder(null);
              setLastOrderCustomer(null);
            }
          }}
          order={lastOrder}
          customer={lastOrderCustomer}
          receiptData={generateReceiptData(lastOrder)}
          defaultView={lastOrder.sale_type === 'credit' ? 'invoice' : 'receipt'}
        />
      )}
    </PageLayout>
  );
}
