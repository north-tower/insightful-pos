import { useState, useMemo } from 'react';
import { PageLayout } from '@/components/pos/PageLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, RotateCcw, Eye, Printer, X, Loader2, DollarSign, ShoppingBag, AlertTriangle, FileText, CreditCard, Banknote, CircleDollarSign, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { InvoiceDialog } from '@/components/receipt/InvoiceDialog';
import { PaymentDialog } from '@/components/payment/PaymentDialog';
import { EditPaymentDialog } from '@/components/payment/EditPaymentDialog';
import { ReceiptData } from '@/data/receiptData';
import { useOrders, SaleOrder, Payment } from '@/hooks/useOrders';
import { useCustomers, Customer } from '@/hooks/useCustomers';
import { toast } from 'sonner';
import { fc } from '@/lib/currency';

interface OrderHistoryProps {
  onNavigate: (tab: string) => void;
}

const statusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  preparing: 'bg-primary/10 text-primary',
  ready: 'bg-success/10 text-success',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
  voided: 'bg-muted text-muted-foreground line-through',
};

const paymentStatusColors: Record<string, string> = {
  unpaid: 'bg-warning/10 text-warning',
  partial: 'bg-info/10 text-info',
  paid: 'bg-success/10 text-success',
  refunded: 'bg-destructive/10 text-destructive',
  voided: 'bg-muted text-muted-foreground',
};

const saleTypeConfig: Record<string, { label: string; icon: typeof Banknote; className: string }> = {
  cash: { label: 'Cash Sale', icon: Banknote, className: 'bg-success/10 text-success' },
  credit: { label: 'Credit Sale', icon: CreditCard, className: 'bg-warning/10 text-warning' },
};

function orderToReceiptData(order: SaleOrder): ReceiptData {
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
      modifiers: item.modifiers || [],
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
    type: (order.order_type as 'dine-in' | 'takeaway' | 'delivery') || 'dine-in',
    orderNotes: order.notes,
    staffName: order.staff_name,
  };
}

export default function OrderHistory({ onNavigate }: OrderHistoryProps) {
  const { orders, loading, voidOrder, refundOrder, recordPayment, updatePayment, deletePayment, todaysOrders, todaysRevenue, getOrderBalanceDue } = useOrders();
  const { customers, getCustomerById, makePaymentOnAccount, adjustCustomerBalance, refetch: refetchCustomers } = useCustomers();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [saleTypeFilter, setSaleTypeFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<SaleOrder | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<SaleOrder | null>(null);
  const [selectedOrderCustomer, setSelectedOrderCustomer] = useState<Customer | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<SaleOrder | null>(null);
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [isEditPaymentOpen, setIsEditPaymentOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [voidingOrderId, setVoidingOrderId] = useState<string | null>(null);
  const [refundingOrderId, setRefundingOrderId] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    let result = orders;

    if (statusFilter !== 'all') {
      result = result.filter((o) => o.status === statusFilter);
    }

    if (saleTypeFilter !== 'all') {
      result = result.filter((o) => o.sale_type === saleTypeFilter);
    }

    if (searchQuery) {
    const query = searchQuery.toLowerCase();
      result = result.filter(
        (order) =>
          order.order_number.toLowerCase().includes(query) ||
          order.customer_name?.toLowerCase().includes(query) ||
          order.table_number?.toLowerCase().includes(query) ||
          order.invoice_number?.toLowerCase().includes(query),
      );
    }

    return result;
  }, [orders, searchQuery, statusFilter, saleTypeFilter]);

  // Computed stats
  const creditOrders = useMemo(() => orders.filter(o => o.sale_type === 'credit'), [orders]);
  const totalCreditBalance = useMemo(
    () => creditOrders.filter(o => o.payment_status === 'unpaid').reduce((sum, o) => sum + o.total, 0),
    [creditOrders],
  );

  const handleViewOrder = (order: SaleOrder) => {
    setSelectedOrder(order);
    setIsDetailOpen(true);
  };

  const handlePrintReceipt = (order: SaleOrder) => {
    setSelectedOrderForInvoice(order);
    const customer = order.customer_id ? getCustomerById(order.customer_id) : null;
    setSelectedOrderCustomer(customer || null);
    setIsInvoiceOpen(true);
  };

  const handleRefund = async (order: SaleOrder) => {
    setRefundingOrderId(order.id);
    try {
      await refundOrder(order.id);
      toast.success(`Order #${order.order_number} refunded`);
      setIsDetailOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to refund order');
    } finally {
      setRefundingOrderId(null);
    }
  };

  const handleVoid = async (order: SaleOrder) => {
    setVoidingOrderId(order.id);
    try {
      await voidOrder(order.id);
      toast.success(`Order #${order.order_number} voided`);
      setIsDetailOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to void order');
    } finally {
      setVoidingOrderId(null);
    }
  };

  const handleRecordPayment = (order: SaleOrder) => {
    const cust = order.customer_id ? getCustomerById(order.customer_id) : null;
    setPaymentOrder(order);
    setPaymentCustomer(cust);
    setIsPaymentOpen(true);
  };

  const handlePaymentComplete = () => {
    toast.success('Payment recorded successfully');
    // If the detail dialog was showing this order, refresh its data
    if (selectedOrder && paymentOrder && selectedOrder.id === paymentOrder.id) {
      // The orders list will re-render from the hook refetch
      setIsDetailOpen(false);
    }
  };

  const handleEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setIsEditPaymentOpen(true);
  };

  const handleEditPaymentComplete = () => {
    toast.success('Payment updated');
    // Close the detail dialog so it refreshes when reopened
    setIsDetailOpen(false);
  };

  const handleDeletePayment = async (paymentId: string) => {
    // Find the order & payment before deleting so we can adjust customer balance
    const order = orders.find((o) => o.payments.some((p) => p.id === paymentId));
    const payment = order?.payments.find((p) => p.id === paymentId);

    setDeletingPaymentId(paymentId);
    try {
      const ok = await deletePayment(paymentId);
      if (ok) {
        // Adjust customer balance (DB trigger also handles this server-side)
        if (order?.sale_type === 'credit' && order?.customer_id && payment) {
          await adjustCustomerBalance(order.customer_id, payment.amount);
        }
        toast.success('Payment deleted');
        setIsDetailOpen(false);
      } else {
        toast.error('Failed to delete payment');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete payment');
    } finally {
      setDeletingPaymentId(null);
    }
  };

  return (
    <PageLayout activeTab="order-history" onNavigate={onNavigate}>
          {/* Page Header with Stats */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Order History</h1>
            <p className="text-muted-foreground">View and manage past orders</p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Today's Orders</p>
                  <p className="text-xl font-bold">{todaysOrders.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded bg-success/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Today's Revenue</p>
                  <p className="text-xl font-bold">{fc(todaysRevenue)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded bg-warning/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Credit Outstanding</p>
                  <p className="text-xl font-bold text-warning">{fc(totalCreditBalance)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded bg-info/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="text-xl font-bold">{orders.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search & Filters */}
          <div className="mb-6 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                  placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {['all', 'completed', 'pending', 'preparing', 'cancelled', 'voided'].map((s) => (
                  <Button
                    key={s}
                    variant={statusFilter === s ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter(s)}
                    className="capitalize shrink-0"
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
            {/* Sale Type Filter */}
            <div className="flex gap-2 items-center overflow-x-auto pb-1 scrollbar-hide">
              <span className="text-sm text-muted-foreground font-medium shrink-0">Sale Type:</span>
              {[
                { key: 'all', label: 'All Sales' },
                { key: 'cash', label: 'Cash Sales', icon: Banknote },
                { key: 'credit', label: 'Credit Sales', icon: CreditCard },
              ].map(({ key, label, icon: Icon }) => (
                <Button
                  key={key}
                  variant={saleTypeFilter === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSaleTypeFilter(key)}
                  className="gap-1.5"
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {/* Orders List */}
          {!loading && (
          <div className="space-y-4">
              {filteredOrders.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No orders found</p>
                  <p className="text-sm mt-1">
                    {searchQuery || statusFilter !== 'all'
                      ? 'Try adjusting your search or filters'
                      : 'Orders will appear here once sales are made'}
                  </p>
                </div>
              )}

              {filteredOrders.map((order) => {
                const primaryPayment =
                  order.payments.length > 1
                    ? 'split'
                    : order.payments[0]?.method || '—';
                const saleConfig = saleTypeConfig[order.sale_type || 'cash'];
                const SaleIcon = saleConfig?.icon || Banknote;
                const orderCustomer = order.customer_id ? getCustomerById(order.customer_id) : null;

                return (
                  <Card
                    key={order.id}
                    className={cn(
                      'hover:shadow-md transition-shadow',
                      order.sale_type === 'credit' && order.payment_status === 'unpaid' && 'border-l-4 border-l-warning',
                    )}
                  >
                <CardContent className="p-3 sm:p-4 lg:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 sm:gap-3 mb-3 flex-wrap">
                            <h3 className="font-bold text-base sm:text-lg text-foreground">
                              Order #{order.order_number}
                            </h3>
                            {order.invoice_number && (
                              <span className="text-sm text-muted-foreground font-mono">
                                {order.invoice_number}
                              </span>
                            )}
                            <Badge className={cn('text-xs', statusColors[order.status] || '')}>
                          {order.status}
                        </Badge>
                            <Badge
                              className={cn(
                                'text-xs',
                                paymentStatusColors[order.payment_status] || '',
                              )}
                            >
                              {order.payment_status}
                            </Badge>
                            <Badge className={cn('text-xs gap-1', saleConfig?.className || '')}>
                              <SaleIcon className="w-3 h-3" />
                              {saleConfig?.label || 'Cash Sale'}
                        </Badge>
                            {primaryPayment === 'split' && (
                          <Badge className="text-xs bg-info/10 text-info">Split Payment</Badge>
                        )}
                      </div>

                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm mb-4">
                            {order.table_number && (
                          <div>
                            <p className="text-muted-foreground">Table</p>
                                <p className="font-medium">#{order.table_number}</p>
                          </div>
                        )}
                            {order.customer_name && (
                          <div>
                            <p className="text-muted-foreground">Customer</p>
                                <p className="font-medium">{order.customer_name}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-muted-foreground">Date</p>
                              <p className="font-medium">
                                {format(new Date(order.created_at), 'MMM dd, yyyy HH:mm')}
                              </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total</p>
                          <p className="font-medium">{fc(order.total)}</p>
                        </div>
                            {order.sale_type === 'credit' && order.payment_status === 'unpaid' && (
                              <div>
                                <p className="text-muted-foreground">Balance Due</p>
                                <p className="font-bold text-warning">{fc(order.total)}</p>
                              </div>
                            )}
                            {orderCustomer && orderCustomer.credit_balance > 0 && (
                              <div>
                                <p className="text-muted-foreground">Acct. Balance</p>
                                <p className="font-bold text-warning">{fc(orderCustomer.credit_balance)}</p>
                              </div>
                            )}
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                        <span>{order.items.length} items</span>
                            {order.order_type && (
                              <>
                                <span>•</span>
                                <span className="capitalize">
                                  {order.order_type.replace('-', ' ')}
                                </span>
                              </>
                            )}
                            {primaryPayment !== 'split' && primaryPayment !== '—' && (
                              <>
                                <span>•</span>
                                <span className="capitalize">{primaryPayment}</span>
                              </>
                            )}
                            {order.staff_name && (
                          <>
                            <span>•</span>
                                <span>by {order.staff_name}</span>
                          </>
                        )}
                            {order.due_date && (
                          <>
                            <span>•</span>
                                <span>Due: {format(new Date(order.due_date), 'MMM dd, yyyy')}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex sm:flex-col gap-2 sm:ml-4 overflow-x-auto scrollbar-hide shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewOrder(order)}
                        className="gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </Button>
                        <Button
                          variant="outline"
                          size="sm"
                            onClick={() => handlePrintReceipt(order)}
                          className="gap-2"
                        >
                            <FileText className="w-4 h-4" />
                            {order.sale_type === 'credit' ? 'Invoice' : 'Receipt'}
                          </Button>
                          {order.sale_type === 'credit' &&
                            (order.payment_status === 'unpaid' || order.payment_status === 'partial') &&
                            order.status !== 'voided' &&
                            order.status !== 'cancelled' && (
                              <Button
                                size="sm"
                                onClick={() => handleRecordPayment(order)}
                                className="gap-2 bg-success hover:bg-success/90 text-white"
                              >
                                <CircleDollarSign className="w-4 h-4" />
                                Pay
                        </Button>
                      )}
                          {order.payment_status === 'paid' &&
                            order.status !== 'cancelled' &&
                            order.status !== 'voided' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRefund(order)}
                          className="gap-2 text-destructive hover:text-destructive"
                          disabled={refundingOrderId === order.id}
                        >
                          {refundingOrderId === order.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RotateCcw className="w-4 h-4" />
                          )}
                          Refund
                        </Button>
                      )}
                          {order.status !== 'completed' &&
                            order.status !== 'cancelled' &&
                            order.status !== 'voided' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVoid(order)}
                          className="gap-2 text-destructive hover:text-destructive"
                          disabled={voidingOrderId === order.id}
                        >
                          {voidingOrderId === order.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <X className="w-4 h-4" />
                          )}
                          Void
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
                );
              })}
          </div>
          )}

      {/* Order Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details #{selectedOrder?.order_number}</DialogTitle>
            <DialogDescription>
              {selectedOrder
                ? format(new Date(selectedOrder.created_at), 'MMM dd, yyyy HH:mm')
                : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (() => {
            const detailCustomer = selectedOrder.customer_id ? getCustomerById(selectedOrder.customer_id) : null;
            const detailSaleConfig = saleTypeConfig[selectedOrder.sale_type || 'cash'];

            return (
            <div className="space-y-6">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={cn('mt-1', statusColors[selectedOrder.status] || '')}>
                    {selectedOrder.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payment Status</p>
                  <Badge
                    className={cn(
                      'mt-1',
                      paymentStatusColors[selectedOrder.payment_status] || '',
                    )}
                  >
                    {selectedOrder.payment_status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sale Type</p>
                  <Badge className={cn('mt-1 gap-1', detailSaleConfig?.className || '')}>
                    {detailSaleConfig?.label || 'Cash Sale'}
                  </Badge>
                </div>
                {selectedOrder.invoice_number && (
                  <div>
                    <p className="text-sm text-muted-foreground">Invoice #</p>
                    <p className="font-medium font-mono">{selectedOrder.invoice_number}</p>
                  </div>
                )}
                {selectedOrder.table_number && (
                  <div>
                    <p className="text-sm text-muted-foreground">Table</p>
                    <p className="font-medium">#{selectedOrder.table_number}</p>
                  </div>
                )}
                {selectedOrder.customer_name && (
                  <div>
                    <p className="text-sm text-muted-foreground">Customer</p>
                    <p className="font-medium">{selectedOrder.customer_name}</p>
                    {detailCustomer && detailCustomer.credit_balance > 0 && (
                      <p className="text-xs text-warning mt-0.5">
                        Account Balance: {fc(detailCustomer.credit_balance)}
                      </p>
                    )}
                  </div>
                )}
                {selectedOrder.staff_name && (
                  <div>
                    <p className="text-sm text-muted-foreground">Staff</p>
                    <p className="font-medium">{selectedOrder.staff_name}</p>
                  </div>
                )}
                {selectedOrder.due_date && (
                  <div>
                    <p className="text-sm text-muted-foreground">Due Date</p>
                    <p className="font-medium">{format(new Date(selectedOrder.due_date), 'MMM dd, yyyy')}</p>
                  </div>
                )}
              </div>

              {/* Items */}
              <div>
                <h4 className="font-semibold mb-3">Items</h4>
                <div className="space-y-3">
                  {selectedOrder.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                    >
                      {item.product_image && (
                        <img
                          src={item.product_image}
                          alt={item.product_name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                      )}
                      <div className="flex-1">
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {fc(item.unit_price)} × {item.quantity}
                        </p>
                        {item.sku && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            SKU: {item.sku}
                          </p>
                        )}
                        {item.notes && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Note: {item.notes}
                          </p>
                        )}
                        {item.modifiers && item.modifiers.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {item.modifiers.map((mod) => (
                              <p key={mod.id} className="text-xs text-muted-foreground">
                                {mod.type}: {mod.name}{' '}
                                {mod.price ? `(+${fc(mod.price)})` : ''}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="font-medium">{fc(item.line_total)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payments */}
              {selectedOrder.payments.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">
                    Payments ({selectedOrder.payments.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedOrder.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg group"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="capitalize font-medium">{payment.method}</span>
                            {payment.reference && (
                              <span className="text-xs text-muted-foreground font-mono">
                                ({payment.reference})
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(payment.paid_at), 'MMM dd, yyyy · HH:mm')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-base mr-2">
                            {fc(payment.amount)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleEditPayment(payment)}
                          >
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                            onClick={() => handleDeletePayment(payment.id)}
                            disabled={deletingPaymentId === payment.id}
                          >
                            {deletingPaymentId === payment.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                    {/* Payments total */}
                    <div className="flex justify-between pt-2 border-t border-border/50 text-sm">
                      <span className="text-muted-foreground">Total Paid</span>
                      <span className="font-semibold text-success">
                        {fc(selectedOrder.payments.reduce((s, p) => s + p.amount, 0))}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Order Notes */}
              {selectedOrder.notes && (
                <div>
                  <h4 className="font-semibold mb-2">Order Notes</h4>
                  <p className="text-sm text-muted-foreground">{selectedOrder.notes}</p>
                </div>
              )}

              {/* Summary */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{fc(selectedOrder.subtotal)}</span>
                </div>
                {selectedOrder.discount_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-success">
                      -{fc(selectedOrder.discount_amount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Tax ({(selectedOrder.tax_rate * 100).toFixed(0)}%)
                  </span>
                  <span>{fc(selectedOrder.tax_amount)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total</span>
                  <span>{fc(selectedOrder.total)}</span>
                </div>
              </div>

              {/* Credit Sale Balance Info */}
              {selectedOrder.sale_type === 'credit' &&
                (selectedOrder.payment_status === 'unpaid' || selectedOrder.payment_status === 'partial') &&
                selectedOrder.status !== 'voided' &&
                selectedOrder.status !== 'cancelled' && (
                <div className="p-4 bg-warning/5 border border-warning/20 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-warning font-semibold">
                      <CreditCard className="w-4 h-4" />
                      Credit Sale — Balance Due
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleRecordPayment(selectedOrder)}
                      className="gap-1.5 bg-success hover:bg-success/90 text-white"
                    >
                      <CircleDollarSign className="w-4 h-4" />
                      Record Payment
                    </Button>
                  </div>
                  <p className="text-lg font-bold text-warning">
                    {fc(getOrderBalanceDue(selectedOrder))}
                  </p>
                  {selectedOrder.due_date && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Due by {format(new Date(selectedOrder.due_date), 'MMMM dd, yyyy')}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  variant="outline" 
                  className="flex-1 gap-2"
                  onClick={() => handlePrintReceipt(selectedOrder)}
                >
                  <FileText className="w-4 h-4" />
                  {selectedOrder.sale_type === 'credit' ? 'View Invoice' : 'Print Receipt'}
                </Button>
                {selectedOrder.payment_status === 'paid' &&
                  selectedOrder.status !== 'cancelled' &&
                  selectedOrder.status !== 'voided' && (
                  <Button
                    variant="outline"
                      className="flex-1 gap-2 text-destructive hover:text-destructive"
                      onClick={() => handleRefund(selectedOrder)}
                      disabled={refundingOrderId === selectedOrder.id}
                  >
                    {refundingOrderId === selectedOrder.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                      Refund
                  </Button>
                )}
              </div>
            </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Invoice/Receipt Dialog */}
      {selectedOrderForInvoice && (
        <InvoiceDialog
          open={isInvoiceOpen}
          onOpenChange={(open) => {
            setIsInvoiceOpen(open);
            if (!open) {
              setSelectedOrderForInvoice(null);
              setSelectedOrderCustomer(null);
            }
          }}
          order={selectedOrderForInvoice}
          customer={selectedOrderCustomer}
          receiptData={orderToReceiptData(selectedOrderForInvoice)}
          defaultView={selectedOrderForInvoice.sale_type === 'credit' ? 'invoice' : 'receipt'}
        />
      )}

      {/* Payment Dialog */}
      {paymentOrder && (
        <PaymentDialog
          open={isPaymentOpen}
          onOpenChange={(open) => {
            setIsPaymentOpen(open);
            if (!open) {
              setPaymentOrder(null);
              setPaymentCustomer(null);
            }
          }}
          order={paymentOrder}
          customer={paymentCustomer}
          onRecordPayment={recordPayment}
          onDeductCustomerBalance={makePaymentOnAccount}
          onPaymentComplete={handlePaymentComplete}
        />
      )}

      {/* Edit Payment Dialog */}
      {editingPayment && (
        <EditPaymentDialog
          open={isEditPaymentOpen}
          onOpenChange={(open) => {
            setIsEditPaymentOpen(open);
            if (!open) setEditingPayment(null);
          }}
          payment={editingPayment}
          order={selectedOrder || undefined}
          onUpdate={updatePayment}
          onAdjustCustomerBalance={adjustCustomerBalance}
          onUpdateComplete={handleEditPaymentComplete}
        />
      )}
    </PageLayout>
  );
}
