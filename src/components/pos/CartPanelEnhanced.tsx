import { Minus, Plus, Trash2, Printer, CreditCard, Banknote, QrCode, Edit2, Settings2, FileText, Save, Split, Loader2, UserPlus, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useCart } from '@/context/CartContext';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { SplitBillDialog } from '@/components/order/SplitBillDialog';
import { ItemModifierDialog } from '@/components/order/ItemModifierDialog';
import { HoldOrderDialog } from '@/components/order/HoldOrderDialog';
import { InvoiceDialog } from '@/components/receipt/InvoiceDialog';
import { KitchenTicket } from '@/components/receipt/KitchenTicket';
import { OrderModifier } from '@/data/orderData';
import { CartItem } from '@/context/CartContext';
import { Badge } from '@/components/ui/badge';
import { ReceiptData } from '@/data/receiptData';
import { useOrders, SaleOrder, SaleType } from '@/hooks/useOrders';
import { useCustomers, Customer } from '@/hooks/useCustomers';

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

  const { createOrder } = useOrders();
  const { customers, getCustomerDisplayName, refetch: refetchCustomers } = useCustomers();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [orderType, setOrderType] = useState<OrderType>('dine-in');
  const [saleType, setSaleType] = useState<SaleType>('cash');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [isSplitDialogOpen, setIsSplitDialogOpen] = useState(false);
  const [isModifierDialogOpen, setIsModifierDialogOpen] = useState(false);
  const [isHoldDialogOpen, setIsHoldDialogOpen] = useState(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CartItem | null>(null);
  const [partialPayment, setPartialPayment] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastOrder, setLastOrder] = useState<SaleOrder | null>(null);
  const [lastOrderCustomer, setLastOrderCustomer] = useState<Customer | null>(null);
  const [tableNumber, setTableNumber] = useState('04');

  // Filter customers by search
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

  const [splitPaymentMethods, setSplitPaymentMethods] = useState<any[]>([]);

  const handleSplitPayment = (splitPayments: any[]) => {
    setPaymentMethod('split');
    setSplitPaymentMethods(splitPayments);
    toast.success(`Split payment: ${splitPayments.length} methods`);
  };

  const handlePlaceOrder = async () => {
    if (items.length === 0) {
      toast.error('Please add items to your order');
      return;
    }

    if (saleType === 'credit' && !selectedCustomer) {
      toast.error('Please select a customer for credit sale');
      setShowCustomerPicker(true);
      return;
    }
    
    if (paymentMethod === 'split') {
      setIsSplitDialogOpen(true);
      return;
    }

    setIsProcessing(true);

    try {
      // For credit sales, no payment is made upfront
      const payments =
        saleType === 'credit'
          ? []
          : paymentMethod === 'split'
          ? splitPaymentMethods.map((sp: any) => ({
              method: sp.method as 'cash' | 'card' | 'qr',
              amount: sp.amount,
            }))
          : [{ method: paymentMethod as 'cash' | 'card' | 'qr', amount: total }];

      // Calculate due date for credit sales (30 days from now)
      const dueDate = saleType === 'credit'
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : undefined;

      const order = await createOrder({
        order_type: orderType,
        sale_type: saleType,
        customer_id: selectedCustomer?.id,
        customer_name: selectedCustomer
          ? getCustomerDisplayName(selectedCustomer)
          : undefined,
        customer_email: selectedCustomer?.email,
        customer_phone: selectedCustomer?.phone,
        table_number: orderType === 'dine-in' ? tableNumber : undefined,
        notes: orderNotes || undefined,
        due_date: dueDate,
        items: items.map((item) => ({
          product_id: item.id,
          product_name: item.name,
          product_image: item.image,
          unit_price: item.price,
          quantity: item.quantity,
          modifiers: (item.modifiers || []).map((m) => ({
            id: m.id,
            type: m.type,
            name: m.name,
            price: m.price,
          })),
          notes: item.notes,
        })),
        payments,
      });

      if (order) {
        setLastOrder(order);

        // Refetch customers so credit_balance reflects the DB trigger update
        let freshCustomer: Customer | null = null;
        if (selectedCustomer) {
          const freshList = await refetchCustomers();
          freshCustomer = freshList.find((c) => c.id === selectedCustomer.id) ?? selectedCustomer;
        }
        setLastOrderCustomer(freshCustomer);
        const saleLabel = saleType === 'credit' ? 'Credit invoice' : 'Order';
        toast.success(`${saleLabel} #${order.invoice_number || order.order_number} — $${order.total.toFixed(2)}`);
        setIsInvoiceOpen(true);
        clearCart();
        setPartialPayment(null);
        setSplitPaymentMethods([]);
        setSelectedCustomer(null);
        setSaleType('cash');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to place order');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePartialPayment = () => {
    setIsSplitDialogOpen(true);
  };

  const handleHoldOrder = (name: string) => {
    holdOrder(name);
    toast.success(`Order "${name}" saved`);
  };

  const generateReceiptData = (order?: SaleOrder | null): ReceiptData => {
    // If we have a completed order, build receipt from it
    if (order) {
      return {
        orderId: order.id,
        orderNumber: order.order_number,
        date: new Date(order.created_at),
        tableNumber: order.table_number,
        customerName: order.customer_name,
        items: order.items.map((item) => ({
          id: item.product_id || item.id,
          name: item.product_name,
          price: item.unit_price,
          category: '',
          image: item.product_image || '',
          quantity: item.quantity,
          modifiers: item.modifiers,
          notes: item.notes,
        })) as any,
        subtotal: order.subtotal,
        tax: order.tax_amount,
        discount: order.discount_amount > 0 ? order.discount_amount : undefined,
        total: order.total,
        paymentMethod:
          order.payments.length > 1
            ? 'split'
            : order.payments[0]?.method || 'cash',
        splitPayments:
          order.payments.length > 1
            ? order.payments.map((p) => ({ method: p.method, amount: p.amount }))
            : undefined,
        type: order.order_type as 'dine-in' | 'takeaway' | 'delivery',
        orderNotes: order.notes,
        staffName: order.staff_name,
      };
    }

    // Fallback: build from current cart (for pre-order preview)
    return {
      orderId: Date.now().toString(),
      orderNumber: `F${Date.now().toString().slice(-4)}`,
      date: new Date(),
      tableNumber: orderType === 'dine-in' ? tableNumber : undefined,
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
    if (items.length === 0 && !lastOrder) {
      toast.error('No items to print invoice for');
      return;
    }
    setIsInvoiceOpen(true);
  };

  const displayTotal = partialPayment !== null ? partialPayment : total;
  const remaining = total - (partialPayment || 0);

  return (
    <>
      <div className="w-full lg:w-80 bg-card border-t lg:border-t-0 lg:border-l border-border flex flex-col h-auto max-h-[50vh] lg:max-h-none lg:h-full shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-lg text-foreground">
                {orderType === 'dine-in' ? `Table No #${tableNumber}` : orderType === 'takeaway' ? 'Takeaway' : 'Delivery'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {lastOrder ? `Order #${lastOrder.order_number}` : 'New Order'} • {totalItems} items
              </p>
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

          {/* Sale Type Toggle */}
          <div className="flex gap-2 mt-2">
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

          {/* Customer selection for credit sales */}
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
                        {customer.status === 'vip' && (
                          <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30 ml-1">
                            VIP
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

          {/* Payment Method — hidden for credit sales */}
          {saleType === 'cash' && (
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
          )}

          {/* Credit sale info */}
          {saleType === 'credit' && (
            <div className="p-3 bg-warning/5 border border-warning/20 rounded text-xs">
              <p className="font-semibold text-warning mb-1">Credit Sale</p>
              <p className="text-muted-foreground">
                No payment required now. An invoice will be generated and the amount
                will be added to the customer's account balance.
              </p>
            </div>
          )}

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
                className={cn(
                  "w-full gap-2",
                  saleType === 'credit'
                    ? 'bg-warning hover:bg-warning/90 text-warning-foreground'
                    : 'bg-primary hover:bg-primary/90'
                )}
                disabled={items.length === 0 || isProcessing || (saleType === 'credit' && !selectedCustomer)}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing…
                  </>
                ) : saleType === 'credit' ? (
                  <>
                    <FileText className="w-4 h-4" />
                    Create Invoice — ${total.toFixed(2)}
                  </>
                ) : (
                  'Place Order'
                )}
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
    </>
  );
}

