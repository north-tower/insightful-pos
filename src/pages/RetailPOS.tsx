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
  Trash2,
  X,
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
  ChevronDown,
  LayoutGrid,
  List,
} from 'lucide-react';
import { generatePlaceholderUrl } from '@/lib/product-images';
import { fc, CURRENCY_SYMBOL } from '@/lib/currency';
import { toast } from 'sonner';
import { useCompanySettings } from '@/context/BusinessSettingsContext';
import { notifyInvoiceCreated } from '@/lib/sendSms';

interface RetailPOSProps {
  onNavigate: (tab: string) => void;
}

interface CartItem {
  product: Product;
  quantity: number;
  /** Override price – defaults to product.price when undefined */
  overridePrice?: number;
}

type PaymentMethod = 'cash' | 'card' | 'qr';
type ProductViewMode = 'card' | 'list';

const PRODUCT_VIEW_STORAGE_KEY = 'retail-pos:product-view-mode';

function getInitialProductViewMode(): ProductViewMode {
  if (typeof window === 'undefined') return 'card';
  return window.localStorage.getItem(PRODUCT_VIEW_STORAGE_KEY) === 'list' ? 'list' : 'card';
}

export default function RetailPOS({ onNavigate }: RetailPOSProps) {
  const {
    retailProducts,
    loading,
    refetch: refetchProducts,
    debugOfflineCacheKey,
    debugLastDataSource,
  } = useProducts();
  const { createOrder } = useOrders();
  const { customers, getCustomerDisplayName, refetch: refetchCustomers } = useCustomers();
  const { companyName } = useCompanySettings();
  const [searchQuery, setSearchQuery] = useState('');
  // All retail products are under one category – no category filter needed
  const activeCategory = 'all';
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [saleType, setSaleType] = useState<SaleType>('cash');
  const [creditDeposit, setCreditDeposit] = useState('');
  const [creditPaymentDescription, setCreditPaymentDescription] = useState('');
  const [consignmentInfo, setConsignmentInfo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<SaleOrder | null>(null);
  const [lastOrderCustomer, setLastOrderCustomer] = useState<Customer | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [productViewMode, setProductViewMode] = useState<ProductViewMode>(getInitialProductViewMode);

  // Local editing state so inputs can be cleared / partially typed before committing
  const [editingQty, setEditingQty] = useState<Record<string, string>>({});
  const [editingPrice, setEditingPrice] = useState<Record<string, string>>({});

  const commitQty = (productId: string) => {
    const raw = editingQty[productId];
    if (raw !== undefined) {
      const val = parseInt(raw, 10);
      if (!isNaN(val) && val > 0) {
        updateCartQuantity(productId, val);
      } else if (raw === '' || val <= 0) {
        // Treat empty or zero as remove
        updateCartQuantity(productId, 0);
      }
      setEditingQty((prev) => { const n = { ...prev }; delete n[productId]; return n; });
    }
  };

  const commitPrice = (productId: string) => {
    const raw = editingPrice[productId];
    if (raw !== undefined) {
      const val = parseFloat(raw);
      if (!isNaN(val) && val >= 0) {
        updateCartPrice(productId, val);
      }
      setEditingPrice((prev) => { const n = { ...prev }; delete n[productId]; return n; });
    }
  };

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

  const updateCartPrice = (productId: string, price: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, overridePrice: price } : item
      )
    );
  };

  /** Effective unit price for a cart item (override or original) */
  const getUnitPrice = (item: CartItem) =>
    item.overridePrice !== undefined ? item.overridePrice : item.product.price;

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => setCart([]);

  const subtotal = cart.reduce(
    (sum, item) => sum + getUnitPrice(item) * item.quantity,
    0
  );
  const tax = 0;
  const total = subtotal;
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

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
      const creditDepositAmount =
        saleType === 'credit'
          ? Math.min(Math.max(parseFloat(creditDeposit) || 0, 0), total)
          : 0;
      const paymentTimestamp = new Date(`${invoiceDate}T12:00:00`).toISOString();
      const payments =
        saleType === 'credit'
          ? creditDepositAmount > 0
            ? [{
                method: paymentMethod,
                amount: creditDepositAmount,
                description:
                  creditPaymentDescription.trim() || 'Deposit at invoice creation',
                paid_at: paymentTimestamp,
              }]
            : []
          : [{ method: paymentMethod, amount: total, paid_at: paymentTimestamp }];

      const dueDate = saleType === 'credit'
        ? new Date(new Date(`${invoiceDate}T12:00:00`).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
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
        created_at: paymentTimestamp,
        due_date: dueDate,
        consignment_info: saleType === 'credit' ? consignmentInfo.trim() || undefined : undefined,
        items: cart.map((item) => ({
          product_id: item.product.id,
          product_name: item.product.name,
          product_image: item.product.image,
          unit_price: getUnitPrice(item),
          quantity: item.quantity,
          sku: item.product.sku,
          barcode: item.product.barcode,
        })),
        payments,
      });

      if (order) {
        setLastOrder(order);

        // Refetch customers so credit_balance reflects the DB trigger update,
        // then grab the fresh customer object from the returned array
        let freshCustomer: Customer | null = null;
        if (selectedCustomer) {
          const freshList = await refetchCustomers();
          freshCustomer = freshList.find((c) => c.id === selectedCustomer.id) ?? selectedCustomer;
        }
        setLastOrderCustomer(freshCustomer);

        const label = saleType === 'credit' ? 'Credit invoice' : 'Sale';
        toast.success(`${label} #${order.invoice_number || order.order_number} — ${fc(order.total)}`);

        // Send SMS notification for credit invoices (fire-and-forget)
        if (saleType === 'credit') {
          const overallBalance = freshCustomer?.credit_balance ?? order.total;
          const paidAtCreation = order.payments.reduce((s, p) => s + p.amount, 0);
          const netIncrease = Math.max(order.total - paidAtCreation, 0);
          const previousBalance = Math.max(overallBalance - netIncrease, 0);
          notifyInvoiceCreated(
            order,
            companyName,
            previousBalance,
            overallBalance,
            consignmentInfo,
          );
        }

        setIsInvoiceOpen(true);
        clearCart();
        setSelectedCustomer(null);
        setSaleType('cash');
        setCreditDeposit('');
        setCreditPaymentDescription('');
        setConsignmentInfo('');
        setInvoiceDate(new Date().toISOString().slice(0, 10));
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
            {/* Search + view mode */}
            <div className="p-2 sm:p-3 lg:p-4 pb-1 sm:pb-2 flex gap-2 sm:gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>
              <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1 shrink-0">
                <button
                  onClick={() => {
                    setProductViewMode('card');
                    if (typeof window !== 'undefined') {
                      window.localStorage.setItem(PRODUCT_VIEW_STORAGE_KEY, 'card');
                    }
                  }}
                  className={cn(
                    'h-7 px-2 rounded text-xs font-medium flex items-center gap-1',
                    productViewMode === 'card'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Card view"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Card</span>
                </button>
                <button
                  onClick={() => {
                    setProductViewMode('list');
                    if (typeof window !== 'undefined') {
                      window.localStorage.setItem(PRODUCT_VIEW_STORAGE_KEY, 'list');
                    }
                  }}
                  className={cn(
                    'h-7 px-2 rounded text-xs font-medium flex items-center gap-1',
                    productViewMode === 'list'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="List view"
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">List</span>
                </button>
              </div>
            </div>

            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-3 lg:p-4">
              {import.meta.env.DEV && (
                <div className="mb-2 rounded border border-dashed border-warning/40 bg-warning/5 px-2 py-1 text-[10px] text-muted-foreground">
                  Cache: {debugOfflineCacheKey} | Source: {debugLastDataSource}
                </div>
              )}
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Loading products...</p>
                  </div>
                </div>
              ) : (
              <>
              {productViewMode === 'card' ? (
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
                          'relative bg-card border rounded-lg p-2 sm:p-3 text-left transition-all group',
                          inCart > 0
                            ? 'border-primary shadow-md'
                            : 'border-border hover:border-primary/40',
                          isOutOfStock && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <div className="relative aspect-square rounded overflow-hidden bg-muted mb-2">
                          <img
                            src={product.image || generatePlaceholderUrl(product.name)}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          {isOutOfStock && (
                            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                              <Badge className="bg-destructive text-destructive-foreground text-[10px] sm:text-xs">
                                Out of Stock
                              </Badge>
                            </div>
                          )}
                          {isLowStock && !isOutOfStock && (
                            <div className="absolute top-1 right-1">
                              <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-warning" />
                            </div>
                          )}
                          {inCart > 0 && (
                            <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] sm:text-xs font-bold w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center">
                              {inCart}
                            </div>
                          )}
                          {product.discount && (
                            <div className="absolute bottom-1 left-1">
                              <Badge className="bg-destructive text-destructive-foreground text-[10px]">
                                {product.discount}% OFF
                              </Badge>
                            </div>
                          )}
                        </div>

                        <p className="text-xs sm:text-sm font-semibold text-foreground line-clamp-1 sm:line-clamp-2 mb-0.5">
                          {product.name}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-foreground">
                            {fc(product.price)}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] sm:text-xs',
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
              ) : (
                <div className="space-y-2">
                  {filteredProducts.map((product) => {
                    const cartItem = cart.find((c) => c.product.id === product.id);
                    const inCart = cartItem ? cartItem.quantity : 0;
                    const isOutOfStock = product.stock <= 0;
                    const isLowStock = product.stock > 0 && product.stock <= product.lowStockThreshold;

                    return (
                      <div
                        key={product.id}
                        className={cn(
                          'bg-card border rounded-lg p-2 flex items-center gap-3',
                          inCart > 0 ? 'border-primary' : 'border-border',
                          isOutOfStock && 'opacity-60'
                        )}
                      >
                        <img
                          src={product.image || generatePlaceholderUrl(product.name)}
                          alt={product.name}
                          className="w-12 h-12 rounded object-cover shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground truncate">{product.name}</p>
                            {isLowStock && !isOutOfStock && (
                              <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
                            )}
                            {product.discount && (
                              <Badge className="bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0">
                                {product.discount}% OFF
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs mt-0.5">
                            <span className="font-bold text-foreground">{fc(product.price)}</span>
                            <span
                              className={cn(
                                isOutOfStock
                                  ? 'text-destructive'
                                  : isLowStock
                                  ? 'text-warning'
                                  : 'text-muted-foreground'
                              )}
                            >
                              {product.stock} {product.unit}
                            </span>
                            {inCart > 0 && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                In cart: {inCart}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => addToCart(product)}
                          disabled={isOutOfStock}
                          className="h-8 px-3 shrink-0"
                        >
                          {isOutOfStock ? 'Out' : 'Add'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {filteredProducts.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No products found</p>
                </div>
              )}
              </>
              )}
            </div>
          </div>

          {/* ── Mobile Floating Cart Button ── */}
          {totalItems > 0 && !mobileCartOpen && (
            <button
              onClick={() => setMobileCartOpen(true)}
              className="lg:hidden fixed bottom-16 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground px-5 py-3 rounded-full shadow-xl flex items-center gap-3 active:scale-95 transition-transform"
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="font-semibold text-sm">
                View Cart ({totalItems})
              </span>
              <span className="font-bold text-sm">
                {fc(total)}
              </span>
            </button>
          )}

          {/* ── Mobile Cart Overlay (slide-up panel) ── */}
          {mobileCartOpen && (
            <div className="lg:hidden fixed inset-0 z-50 flex flex-col">
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => { if (!isProcessing) setMobileCartOpen(false); }}
              />
              {/* Panel */}
              <div className="relative mt-auto bg-card rounded-t-2xl border-t border-border flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-200">
                {/* Drag handle + header */}
                <div className="flex items-center justify-between p-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { if (!isProcessing) setMobileCartOpen(false); }}
                      className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
                      disabled={isProcessing}
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>
                    <h2 className="font-bold text-base text-foreground flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4" />
                      Cart
                      <Badge variant="secondary" className="text-xs ml-1">{totalItems}</Badge>
                    </h2>
                  </div>
                  {cart.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearCart}
                      className="text-destructive hover:text-destructive text-xs h-7"
                    >
                      Clear
                    </Button>
                  )}
                </div>

                {/* Sale Type Toggle */}
                <div className="px-3 py-2 border-b border-border space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSaleType('cash');
                        setCreditDeposit('');
                        setCreditPaymentDescription('');
                        setConsignmentInfo('');
                        setInvoiceDate(new Date().toISOString().slice(0, 10));
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
                  {saleType === 'credit' && !showCustomerPicker && (
                    <>
                      {selectedCustomer ? (
                        <div className="flex items-center justify-between p-2 bg-warning/5 border border-warning/20 rounded text-sm">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-warning" />
                            <div>
                              <p className="font-semibold text-foreground text-xs">
                                {getCustomerDisplayName(selectedCustomer)}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                Balance: {fc(selectedCustomer.credit_balance)}
                                {selectedCustomer.credit_limit > 0 &&
                                  ` / Limit: ${fc(selectedCustomer.credit_limit)}`}
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
                    </>
                  )}
                  {showCustomerPicker && (
                    <div className="border border-border rounded bg-card shadow-lg max-h-48 overflow-hidden">
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
                                    {fc(customer.credit_balance)}
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
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {cart.map((item) => {
                    const unitPrice = getUnitPrice(item);
                    return (
                      <div
                        key={item.product.id}
                        className="flex gap-2.5 p-2.5 rounded-lg border border-border"
                      >
                        <img
                          src={item.product.image || generatePlaceholderUrl(item.product.name)}
                          alt={item.product.name}
                          className="w-11 h-11 rounded object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {item.product.name}
                            </p>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 -mt-0.5 -mr-1 text-destructive hover:text-destructive shrink-0"
                              onClick={() => removeFromCart(item.product.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            {/* Editable unit price */}
                            <div className="relative w-24">
                              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{CURRENCY_SYMBOL}</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editingPrice[item.product.id] ?? unitPrice}
                                onChange={(e) => setEditingPrice((prev) => ({ ...prev, [item.product.id]: e.target.value }))}
                                onBlur={() => commitPrice(item.product.id)}
                                onKeyDown={(e) => { if (e.key === 'Enter') commitPrice(item.product.id); }}
                                className="w-full h-7 pl-8 pr-1 text-xs font-medium rounded border border-border bg-muted/50 text-foreground focus:outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              />
                            </div>
                            <span className="text-muted-foreground text-xs">×</span>
                            {/* Editable quantity */}
                            <input
                              type="number"
                              min="0"
                              value={editingQty[item.product.id] ?? item.quantity}
                              onChange={(e) => setEditingQty((prev) => ({ ...prev, [item.product.id]: e.target.value }))}
                              onBlur={() => commitQty(item.product.id)}
                              onKeyDown={(e) => { if (e.key === 'Enter') commitQty(item.product.id); }}
                              className="w-14 h-7 text-center text-xs font-semibold rounded border border-border bg-muted/50 text-foreground focus:outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                            {/* Line total */}
                            <span className="ml-auto text-sm font-bold text-foreground whitespace-nowrap tabular-nums">
                              {fc(unitPrice * item.quantity)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Totals + Payment + CTA */}
                <div className="p-3 border-t border-border space-y-3">
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between font-bold text-foreground text-lg">
                      <span>Total</span>
                      <span>{fc(total)}</span>
                    </div>
                  </div>

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

                  {saleType === 'credit' && (
                    <div className="p-2 bg-warning/5 border border-warning/20 rounded text-xs text-muted-foreground space-y-2">
                      <p className="font-semibold text-warning mb-0.5">Credit Sale</p>
                      <p>Invoice will be added to customer's balance less any deposit paid now.</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max={total}
                          placeholder="Deposit amount"
                          value={creditDeposit}
                          onChange={(e) => setCreditDeposit(e.target.value)}
                          className="h-8 text-xs"
                        />
                        <Input
                          placeholder="Payment description"
                          value={creditPaymentDescription}
                          onChange={(e) => setCreditPaymentDescription(e.target.value)}
                          className="h-8 text-xs"
                        />
                        <Input
                          placeholder="Consignment / plate no."
                          value={consignmentInfo}
                          onChange={(e) => setConsignmentInfo(e.target.value)}
                          className="h-8 text-xs col-span-2"
                        />
                        <div className="col-span-2 space-y-1">
                          <p className="text-[11px] text-muted-foreground">Invoice Date</p>
                          <Input
                            type="date"
                            value={invoiceDate}
                            onChange={(e) => setInvoiceDate(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
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
                              'flex items-center justify-center gap-1 py-1.5 rounded text-[11px] font-medium transition-all',
                              paymentMethod === id
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80',
                            )}
                          >
                            <Icon className="w-3 h-3" />
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    className={cn(
                      'w-full h-12 text-base font-semibold',
                      saleType === 'credit'
                        ? 'bg-warning hover:bg-warning/90 text-warning-foreground'
                        : ''
                    )}
                    onClick={async () => {
                      await handleCompleteSale();
                      setMobileCartOpen(false);
                    }}
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
                        Create Invoice — {fc(total)}
                      </>
                    ) : (
                      `Complete Sale — ${fc(total)}`
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Desktop Cart Sidebar (hidden on mobile) ── */}
          <div className="hidden lg:flex w-96 bg-card border-l border-border flex-col h-full shrink-0">
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
                    setCreditDeposit('');
                    setCreditPaymentDescription('');
                    setConsignmentInfo('');
                    setInvoiceDate(new Date().toISOString().slice(0, 10));
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
                            Balance: {fc(selectedCustomer.credit_balance)}
                            {selectedCustomer.credit_limit > 0 &&
                              ` / Limit: ${fc(selectedCustomer.credit_limit)}`}
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
                                {fc(customer.credit_balance)}
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

              {cart.map((item) => {
                const unitPrice = getUnitPrice(item);
                return (
                  <div
                    key={item.product.id}
                    className="flex gap-3 p-3 rounded border border-border"
                  >
                    <img
                      src={item.product.image || generatePlaceholderUrl(item.product.name)}
                      alt={item.product.name}
                      className="w-12 h-12 rounded object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {item.product.name}
                        </p>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 -mt-0.5 -mr-1 text-destructive hover:text-destructive shrink-0"
                          onClick={() => removeFromCart(item.product.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        {/* Editable unit price */}
                        <div className="relative flex-1 min-w-0">
                          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{CURRENCY_SYMBOL}</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editingPrice[item.product.id] ?? unitPrice}
                            onChange={(e) => setEditingPrice((prev) => ({ ...prev, [item.product.id]: e.target.value }))}
                            onBlur={() => commitPrice(item.product.id)}
                            onKeyDown={(e) => { if (e.key === 'Enter') commitPrice(item.product.id); }}
                            className="w-full h-7 pl-7 pr-1 text-xs font-medium rounded border border-border bg-muted/50 text-foreground focus:outline-none focus:ring-1 focus:ring-primary tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                        </div>
                        <span className="text-muted-foreground text-xs shrink-0">×</span>
                        {/* Editable quantity */}
                        <input
                          type="number"
                          min="0"
                          value={editingQty[item.product.id] ?? item.quantity}
                          onChange={(e) => setEditingQty((prev) => ({ ...prev, [item.product.id]: e.target.value }))}
                          onBlur={() => commitQty(item.product.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter') commitQty(item.product.id); }}
                          className="w-14 h-7 text-center text-xs font-semibold rounded border border-border bg-muted/50 text-foreground shrink-0 focus:outline-none focus:ring-1 focus:ring-primary tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        {/* Line total */}
                        <span className="text-sm font-bold text-foreground whitespace-nowrap tabular-nums shrink-0">
                          {fc(unitPrice * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Payment & Totals */}
            {cart.length > 0 && (
              <div className="p-4 border-t border-border space-y-4">
                {/* Totals */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between font-bold text-foreground text-lg">
                    <span>Total</span>
                    <span>{fc(total)}</span>
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
                  <div className="p-2 bg-warning/5 border border-warning/20 rounded text-xs text-muted-foreground space-y-2">
                    <p className="font-semibold text-warning mb-0.5">Credit Sale</p>
                    <p>Invoice will be added to customer's balance less any deposit paid now.</p>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max={total}
                      placeholder="Deposit amount"
                      value={creditDeposit}
                      onChange={(e) => setCreditDeposit(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <Input
                      placeholder="Payment description"
                      value={creditPaymentDescription}
                      onChange={(e) => setCreditPaymentDescription(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <Input
                      placeholder="Consignment / plate no."
                      value={consignmentInfo}
                      onChange={(e) => setConsignmentInfo(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <div className="space-y-1">
                      <p className="text-[11px] text-muted-foreground">Invoice Date</p>
                      <Input
                        type="date"
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
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
                            'flex items-center justify-center gap-1 py-1.5 rounded text-[11px] font-medium transition-all',
                            paymentMethod === id
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80',
                          )}
                        >
                          <Icon className="w-3 h-3" />
                          {label}
                        </button>
                      ))}
                    </div>
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
                      Create Invoice — {fc(total)}
                    </>
                  ) : (
                    `Complete Sale — ${fc(total)}`
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
