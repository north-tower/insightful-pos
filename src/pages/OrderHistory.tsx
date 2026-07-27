import { useState, useMemo, useEffect } from 'react';
import { PageLayout } from '@/components/pos/PageLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PaginationControls } from '@/components/ui/pagination-controls';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Search, RotateCcw, Eye, Printer, X, Loader2, ShoppingBag, AlertTriangle, FileText, CreditCard, Banknote, CircleDollarSign, Pencil, Trash2, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { CurrencyIcon } from '@/components/icons/CurrencyIcon';
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
import { useCompanySettings } from '@/context/BusinessSettingsContext';
import { notifyAccountPaymentReceived } from '@/lib/sendSms';
import { supabase } from '@/lib/supabase';
import { useBusinessMode } from '@/context/BusinessModeContext';

interface OrderHistoryProps {
  onNavigate: (tab: string) => void;
}

interface CustomerAccountPayment {
  id: string;
  customer_id: string;
  method: 'cash' | 'card' | 'qr';
  amount: number;
  reference?: string;
  notes?: string;
  created_at: string;
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
    customerPhone: order.customer_phone,
    customerAddress: order.customer_address,
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
  const { mode, isRestaurant } = useBusinessMode();
  const statusFilterOptions = isRestaurant
    ? ['all', 'completed', 'pending', 'preparing', 'cancelled', 'voided']
    : ['all', 'completed', 'pending', 'cancelled', 'voided'];
  const { orders, loading, voidOrder, refundOrder, updatePayment, deletePayment, todaysOrders, todaysRevenue, getOrderBalanceDue, recordPayment } = useOrders();
  const { customers, getCustomerById, makePaymentOnAccount } = useCustomers();
  const { companyName, settings } = useCompanySettings();
  const smsShopName = settings.fullName || settings.name || companyName;
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [saleTypeFilter, setSaleTypeFilter] = useState<string>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'all' | 'cash' | 'bank'>('all');
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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isTopPayOpen, setIsTopPayOpen] = useState(false);
  const [topPayCustomerId, setTopPayCustomerId] = useState<string>('');
  const [topPayAmount, setTopPayAmount] = useState('');
  const [topPayMethod, setTopPayMethod] = useState<'cash' | 'card' | 'qr'>('cash');
  const [topPayReference, setTopPayReference] = useState('');
  const [topPayDescription, setTopPayDescription] = useState('');
  const [topPayDate, setTopPayDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [isTopPaySaving, setIsTopPaySaving] = useState(false);
  const [accountPayments, setAccountPayments] = useState<CustomerAccountPayment[]>([]);
  const [accountPaymentsLoading, setAccountPaymentsLoading] = useState(false);
  const [reportFromDate, setReportFromDate] = useState(
    () => new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().slice(0, 10),
  );
  const [reportToDate, setReportToDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [reportOrders, setReportOrders] = useState<SaleOrder[] | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [isReportMode, setIsReportMode] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') count += 1;
    if (saleTypeFilter !== 'all') count += 1;
    if (paymentMethodFilter !== 'all') count += 1;
    return count;
  }, [statusFilter, saleTypeFilter, paymentMethodFilter]);

  const clearFilters = () => {
    setStatusFilter('all');
    setSaleTypeFilter('all');
    setPaymentMethodFilter('all');
  };

  const sourceOrders = useMemo(
    () => (isReportMode && reportOrders ? reportOrders : orders),
    [isReportMode, reportOrders, orders],
  );

  const orderMatchesPaymentMethod = (order: SaleOrder) => {
    if (paymentMethodFilter === 'all') return true;
    if (!order.payments || order.payments.length === 0) return false;

    if (paymentMethodFilter === 'cash') {
      return order.payments.some((p) => p.method === 'cash');
    }

    // "Bank" means all non-cash digital/bank channels.
    return order.payments.some(
      (p) => p.method === 'card' || p.method === 'qr' || p.method === 'mpesa',
    );
  };

  const filteredOrders = useMemo(() => {
    let result = sourceOrders;

    if (statusFilter !== 'all') {
      result = result.filter((o) => o.status === statusFilter);
    }

    if (saleTypeFilter !== 'all') {
      result = result.filter((o) => o.sale_type === saleTypeFilter);
    }

    result = result.filter(orderMatchesPaymentMethod);

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
  }, [sourceOrders, searchQuery, statusFilter, saleTypeFilter, paymentMethodFilter]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, saleTypeFilter, paymentMethodFilter]);

  // Drop restaurant-only status if mode is retail
  useEffect(() => {
    if (!isRestaurant && statusFilter === 'preparing') {
      setStatusFilter('all');
    }
  }, [isRestaurant, statusFilter]);

  // Keep order detail dialog in sync after payments/refetch (e.g. refund button visibility)
  useEffect(() => {
    if (!isDetailOpen || !selectedOrder) return;
    const fresh = orders.find((o) => o.id === selectedOrder.id);
    if (fresh) setSelectedOrder(fresh);
  }, [orders, isDetailOpen, selectedOrder?.id]);

  // Paginated slice
  const totalPages = Math.ceil(filteredOrders.length / pageSize);
  const paginatedOrders = useMemo(
    () => filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredOrders, currentPage, pageSize],
  );

  // Computed stats — use getOrderBalanceDue for single source of truth
  const unpaidCreditOrders = useMemo(
    () =>
      sourceOrders.filter(
        (o) =>
          o.sale_type === 'credit' &&
          (o.payment_status === 'unpaid' || o.payment_status === 'partial') &&
          o.status !== 'voided' &&
          o.status !== 'cancelled',
      ),
    [sourceOrders],
  );
  const totalCreditBalance = useMemo(
    () =>
      unpaidCreditOrders.reduce((sum, o) => {
        const paid = o.payments.reduce((s, p) => s + p.amount, 0);
        return sum + Math.max(o.total - paid, 0);
      }, 0),
    [unpaidCreditOrders],
  );
  const salesInView = useMemo(
    () => sourceOrders.reduce((sum, o) => sum + o.total, 0),
    [sourceOrders],
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

  /** Refund allowed once the sale is fully settled (incl. cash sales after post-hoc payment). */
  const canShowRefundForOrder = (order: SaleOrder) =>
    getOrderBalanceDue(order) <= 0 &&
    order.payment_status !== 'refunded' &&
    order.payment_status !== 'voided' &&
    order.status !== 'cancelled' &&
    order.status !== 'voided';

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

  const canRecordPaymentForOrder = (order: SaleOrder) =>
    (order.payment_status === 'unpaid' || order.payment_status === 'partial') &&
    order.status !== 'voided' &&
    order.status !== 'cancelled';

  /** Get other unpaid orders for the same customer (for payment distribution) */
  const getOtherUnpaidOrders = (order: SaleOrder): SaleOrder[] => {
    if (!order.customer_id) return [];
    return unpaidCreditOrders.filter(
      (o) => o.id !== order.id && o.customer_id === order.customer_id,
    );
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
    setDeletingPaymentId(paymentId);
    try {
      const ok = await deletePayment(paymentId);
      if (ok) {
        // DB trigger (trg_payment_delete_balance) already:
        // 1. Adds payment amount back to customer.credit_balance
        // 2. Recalculates order.payment_status
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

  const customersWithOutstanding = useMemo(
    () =>
      customers
        .filter((c) => c.credit_balance > 0)
        .sort((a, b) => b.credit_balance - a.credit_balance),
    [customers],
  );

  const selectedTopPayCustomer = useMemo(
    () => customers.find((c) => c.id === topPayCustomerId) || null,
    [customers, topPayCustomerId],
  );

  useEffect(() => {
    const fetchAccountPayments = async () => {
      if (!isTopPayOpen || !topPayCustomerId) {
        setAccountPayments([]);
        return;
      }
      setAccountPaymentsLoading(true);
      try {
        const { data, error } = await supabase
          .from('customer_account_payments')
          .select('id, customer_id, method, amount, reference, notes, created_at')
          .eq('customer_id', topPayCustomerId)
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        setAccountPayments(
          (data || []).map((p: any) => ({
            id: p.id,
            customer_id: p.customer_id,
            method: p.method,
            amount: Number(p.amount),
            reference: p.reference || undefined,
            notes: p.notes || undefined,
            created_at: p.created_at,
          })),
        );
      } catch (err) {
        console.error('Failed to fetch account payments:', err);
        setAccountPayments([]);
      } finally {
        setAccountPaymentsLoading(false);
      }
    };
    fetchAccountPayments();
  }, [isTopPayOpen, topPayCustomerId]);

  const handleSubmitTopPay = async () => {
    if (!selectedTopPayCustomer) {
      toast.error('Select a customer');
      return;
    }
    const amount = parseFloat(topPayAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    setIsTopPaySaving(true);
    const result = await makePaymentOnAccount(
      selectedTopPayCustomer.id,
      amount,
      topPayMethod,
      topPayReference.trim() || undefined,
      topPayDescription.trim() || undefined,
      new Date(`${topPayDate}T12:00:00`).toISOString(),
    );
    setIsTopPaySaving(false);

    if (result.success) {
      notifyAccountPaymentReceived(
        `${selectedTopPayCustomer.first_name} ${selectedTopPayCustomer.last_name}`.trim(),
        Number(result.appliedAmount ?? amount),
        Number(result.balanceBefore ?? selectedTopPayCustomer.credit_balance),
        Number(result.balanceAfter ?? Math.max(selectedTopPayCustomer.credit_balance - amount, 0)),
        smsShopName,
        selectedTopPayCustomer.phone,
        topPayDescription.trim() || undefined,
      );
      toast.success('Payment recorded');
      setTopPayAmount('');
      setTopPayReference('');
      setTopPayDescription('');
      setTopPayDate(new Date().toISOString().slice(0, 10));
      // refresh recent list
      if (topPayCustomerId) {
        const { data } = await supabase
          .from('customer_account_payments')
          .select('id, customer_id, method, amount, reference, notes, created_at')
          .eq('customer_id', topPayCustomerId)
          .order('created_at', { ascending: false })
          .limit(50);
        setAccountPayments(
          (data || []).map((p: any) => ({
            id: p.id,
            customer_id: p.customer_id,
            method: p.method,
            amount: Number(p.amount),
            reference: p.reference || undefined,
            notes: p.notes || undefined,
            created_at: p.created_at,
          })),
        );
      }
    } else {
      toast.error(result.error || 'Failed to record payment');
    }
  };

  const fetchSalesReport = async () => {
    if (!reportFromDate || !reportToDate) {
      toast.error('Select both from and to dates');
      return;
    }
    if (reportFromDate > reportToDate) {
      toast.error('From date cannot be after To date');
      return;
    }

    setIsReportLoading(true);
    try {
      const fromIso = new Date(`${reportFromDate}T00:00:00`).toISOString();
      const toIso = new Date(`${reportToDate}T23:59:59`).toISOString();

      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .select('*')
        .eq('business_mode', mode)
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at', { ascending: false })
        .limit(2000);

      if (orderErr) throw orderErr;

      if (!orderData || orderData.length === 0) {
        setReportOrders([]);
        setIsReportMode(true);
        setCurrentPage(1);
        toast.success('No sales found in selected timeframe');
        return;
      }

      const orderIds = orderData.map((o: any) => o.id);
      const [{ data: itemsData, error: itemsErr }, { data: paymentsData, error: paymentsErr }] =
        await Promise.all([
          supabase.from('order_items').select('*').in('order_id', orderIds),
          supabase.from('payments').select('*').in('order_id', orderIds),
        ]);

      if (itemsErr) throw itemsErr;
      if (paymentsErr) throw paymentsErr;

      const itemsByOrder = new Map<string, any[]>();
      (itemsData || []).forEach((item: any) => {
        const list = itemsByOrder.get(item.order_id) || [];
        list.push(item);
        itemsByOrder.set(item.order_id, list);
      });

      const paymentsByOrder = new Map<string, any[]>();
      (paymentsData || []).forEach((payment: any) => {
        const list = paymentsByOrder.get(payment.order_id) || [];
        list.push(payment);
        paymentsByOrder.set(payment.order_id, list);
      });

      const mappedOrders: SaleOrder[] = orderData.map((o: any) => ({
        id: o.id,
        order_number: o.order_number,
        business_mode: o.business_mode,
        order_type: o.order_type,
        source: o.source,
        sale_type: o.sale_type || 'cash',
        customer_id: o.customer_id,
        customer_name: o.customer_name,
        customer_email: o.customer_email,
        customer_phone: o.customer_phone,
        table_number: o.table_number,
        invoice_number: o.invoice_number,
        due_date: o.due_date,
        consignment_info: o.consignment_info,
        subtotal: Number(o.subtotal),
        tax_rate: Number(o.tax_rate),
        tax_amount: Number(o.tax_amount),
        discount_amount: Number(o.discount_amount),
        total: Number(o.total),
        status: o.status,
        payment_status: o.payment_status,
        notes: o.notes,
        staff_id: o.staff_id,
        staff_name: o.staff_name,
        created_at: o.created_at,
        completed_at: o.completed_at,
        items: (itemsByOrder.get(o.id) || []).map((item: any) => ({
          id: item.id,
          order_id: item.order_id,
          product_id: item.product_id,
          product_name: item.product_name,
          product_image: item.product_image,
          unit_price: Number(item.unit_price),
          quantity: item.quantity,
          line_total: Number(item.line_total),
          discount: Number(item.discount || 0),
          modifiers: item.modifiers || [],
          notes: item.notes,
          sku: item.sku,
          barcode: item.barcode,
        })),
        payments: (paymentsByOrder.get(o.id) || []).map((p: any) => ({
          id: p.id,
          order_id: p.order_id,
          method: p.method,
          amount: Number(p.amount),
          reference: p.reference,
          description: p.description,
          paid_at: p.paid_at,
        })),
      }));

      setReportOrders(mappedOrders);
      setIsReportMode(true);
      setCurrentPage(1);
      toast.success(`Fetched ${mappedOrders.length} sales for selected timeframe`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch sales report');
    } finally {
      setIsReportLoading(false);
    }
  };

  const clearSalesReport = () => {
    setIsReportMode(false);
    setReportOrders(null);
    setCurrentPage(1);
  };

  return (
    <PageLayout activeTab="order-history" onNavigate={onNavigate}>
          {/* Page Header with Stats */}
          <div className="mb-6 flex items-start justify-between gap-3">
            <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Order History</h1>
            <p className="text-muted-foreground">View and manage past orders</p>
            </div>
            <Button
              className="gap-2 bg-success hover:bg-success/90 text-white"
              onClick={() => setIsTopPayOpen(true)}
            >
              <CircleDollarSign className="w-4 h-4" />
              Pay
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {isReportMode ? 'Orders in Range' : "Today's Orders"}
                  </p>
                  <p className="text-xl font-bold">
                    {isReportMode ? sourceOrders.length : todaysOrders.length}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded bg-success/10 flex items-center justify-center">
                  <CurrencyIcon className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {isReportMode ? 'Revenue in Range' : "Today's Revenue"}
                  </p>
                  <p className="text-xl font-bold">{fc(isReportMode ? salesInView : todaysRevenue)}</p>
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
                  <p className="text-xl font-bold">{sourceOrders.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search, report & filters */}
          <div className="mb-4 space-y-3">
            <Collapsible open={reportOpen} onOpenChange={setReportOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 p-4 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">Sales report timeframe</h3>
                      {isReportMode && (
                        <Badge variant="outline" className="text-info border-info/30">
                          Report mode
                        </Badge>
                      )}
                    </div>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-muted-foreground transition-transform',
                        reportOpen && 'rotate-180',
                      )}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-3 border-t pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="report-from">From</Label>
                        <Input
                          id="report-from"
                          type="date"
                          value={reportFromDate}
                          onChange={(e) => setReportFromDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="report-to">To</Label>
                        <Input
                          id="report-to"
                          type="date"
                          value={reportToDate}
                          onChange={(e) => setReportToDate(e.target.value)}
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          className="w-full"
                          onClick={fetchSalesReport}
                          disabled={isReportLoading}
                        >
                          {isReportLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Fetch Report
                        </Button>
                      </div>
                      <div className="flex items-end">
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={clearSalesReport}
                          disabled={!isReportMode}
                        >
                          Clear Report
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1 sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setFiltersOpen(true)}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {statusFilter !== 'all' && (
                  <Badge variant="outline" className="capitalize">
                    Status: {statusFilter}
                  </Badge>
                )}
                {saleTypeFilter !== 'all' && (
                  <Badge variant="outline">
                    {saleTypeFilter === 'cash' ? 'Cash sales' : 'Credit sales'}
                  </Badge>
                )}
                {paymentMethodFilter !== 'all' && (
                  <Badge variant="outline" className="capitalize">
                    Payment: {paymentMethodFilter}
                  </Badge>
                )}
              </div>
            )}
          </div>

          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Filter transactions</SheetTitle>
                <SheetDescription>Narrow the list by status, sale type, or payment method.</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex flex-wrap gap-2">
                    {statusFilterOptions.map((s) => (
                      <Button
                        key={s}
                        variant={statusFilter === s ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setStatusFilter(s)}
                        className="capitalize"
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Sale type</Label>
                  <div className="flex flex-wrap gap-2">
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
                <div className="space-y-2">
                  <Label>Payment method</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'all', label: 'All' },
                      { key: 'cash', label: 'Cash', icon: Banknote },
                      { key: 'bank', label: 'Bank', icon: CreditCard },
                    ].map(({ key, label, icon: Icon }) => (
                      <Button
                        key={key}
                        variant={paymentMethodFilter === key ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPaymentMethodFilter(key as 'all' | 'cash' | 'bank')}
                        className="gap-1.5"
                      >
                        {Icon && <Icon className="w-3.5 h-3.5" />}
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={clearFilters}>
                    Reset
                  </Button>
                  <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
                    Apply
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Loading */}
          {(loading || isReportLoading) && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {/* Orders List */}
          {!loading && !isReportLoading && (
          <div className="space-y-3">
              {filteredOrders.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-base font-medium">No orders found</p>
                  <p className="text-sm mt-1">
                    {searchQuery || activeFilterCount > 0
                      ? 'Try adjusting your search or filters'
                      : 'Orders will appear here once sales are made'}
                  </p>
                </div>
              )}

              {paginatedOrders.length > 0 && (
                <Card className="hidden lg:block overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Items</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedOrders.map((order) => {
                        const saleConfig = saleTypeConfig[order.sale_type || 'cash'];
                        const balanceDue =
                          order.sale_type === 'credit' &&
                          (order.payment_status === 'unpaid' || order.payment_status === 'partial') &&
                          order.status !== 'voided' &&
                          order.status !== 'cancelled'
                            ? getOrderBalanceDue(order)
                            : null;

                        return (
                          <TableRow
                            key={order.id}
                            className={cn(
                              balanceDue !== null && balanceDue > 0 && 'bg-warning/5',
                            )}
                          >
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span>#{order.order_number}</span>
                                <span className="text-xs text-muted-foreground">
                                  {saleConfig?.label || 'Cash Sale'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[160px] truncate">
                              {order.customer_name || '—'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {format(new Date(order.created_at), 'MMM dd, HH:mm')}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {order.items.length}
                            </TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">
                              <div>{fc(order.total)}</div>
                              {balanceDue !== null && balanceDue > 0 && (
                                <div className="text-xs text-warning">
                                  Due {fc(balanceDue)}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={cn('text-xs capitalize', statusColors[order.status] || '')}>
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleViewOrder(order)}
                                  title="View"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handlePrintReceipt(order)}
                                  title={order.sale_type === 'credit' ? 'Invoice' : 'Receipt'}
                                >
                                  <FileText className="w-4 h-4" />
                                </Button>
                                {canRecordPaymentForOrder(order) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-success"
                                    onClick={() => handleRecordPayment(order)}
                                    title="Record payment"
                                  >
                                    <CircleDollarSign className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
              )}

              <div className="space-y-2 lg:hidden">
              {paginatedOrders.map((order) => {
                const primaryPayment =
                  order.payments.length > 1
                    ? 'split'
                    : order.payments[0]?.method || '—';
                const saleConfig = saleTypeConfig[order.sale_type || 'cash'];
                const SaleIcon = saleConfig?.icon || Banknote;

                return (
                  <Card
                    key={order.id}
                    className={cn(
                      order.sale_type === 'credit' && order.payment_status === 'unpaid' && 'border-l-4 border-l-warning',
                    )}
                  >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            <h3 className="font-semibold text-sm text-foreground">
                              #{order.order_number}
                            </h3>
                            <Badge className={cn('text-[10px]', statusColors[order.status] || '')}>
                          {order.status}
                        </Badge>
                            <Badge className={cn('text-[10px] gap-1', saleConfig?.className || '')}>
                              <SaleIcon className="w-3 h-3" />
                              {saleConfig?.label || 'Cash'}
                        </Badge>
                      </div>

                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            {order.customer_name && <span>{order.customer_name}</span>}
                            <span>{format(new Date(order.created_at), 'MMM dd, HH:mm')}</span>
                            <span>{order.items.length} items</span>
                            {primaryPayment !== 'split' && primaryPayment !== '—' && (
                              <span className="capitalize">{primaryPayment}</span>
                            )}
                      </div>
                      <p className="mt-1 text-sm font-bold tabular-nums">{fc(order.total)}</p>
                    </div>

                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleViewOrder(order)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                            onClick={() => handlePrintReceipt(order)}
                        >
                            <FileText className="w-4 h-4" />
                          </Button>
                          {canRecordPaymentForOrder(order) && (
                              <Button
                                size="icon"
                                className="h-8 w-8 bg-success hover:bg-success/90 text-white"
                                onClick={() => handleRecordPayment(order)}
                              >
                                <CircleDollarSign className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
                );
              })}
              </div>
            {/* Pagination */}
            {filteredOrders.length > 0 && (
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredOrders.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
              />
            )}
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
                          {payment.description && (
                            <p className="text-xs text-muted-foreground">
                              {payment.description}
                            </p>
                          )}
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
              {canRecordPaymentForOrder(selectedOrder) && (
                <div className="p-4 bg-warning/5 border border-warning/20 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-warning font-semibold">
                      <CreditCard className="w-4 h-4" />
                      {selectedOrder.sale_type === 'credit'
                        ? 'Credit Sale — Balance Due'
                        : 'Payment Pending — Set Method'}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleRecordPayment(selectedOrder)}
                      className="gap-1.5 bg-success hover:bg-success/90 text-white"
                    >
                      <CircleDollarSign className="w-4 h-4" />
                      {selectedOrder.sale_type === 'credit'
                        ? 'Record Payment'
                        : 'Set Payment Method'}
                    </Button>
                  </div>
                  <p className="text-lg font-bold text-warning">
                    {fc(getOrderBalanceDue(selectedOrder))}
                  </p>
                  {selectedOrder.sale_type === 'credit' && selectedOrder.due_date && (
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
                {canShowRefundForOrder(selectedOrder) && (
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
          variant={paymentOrder.sale_type === 'cash' ? 'methodOnly' : 'default'}
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
          otherUnpaidOrders={getOtherUnpaidOrders(paymentOrder)}
          onRecordPayment={recordPayment}
          onRecordAccountPayment={makePaymentOnAccount}
          onPaymentComplete={handlePaymentComplete}
          companyName={smsShopName}
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
          onUpdateComplete={handleEditPaymentComplete}
        />
      )}

      {/* Top Pay + Customer Payment History */}
      <Dialog
        open={isTopPayOpen}
        onOpenChange={(open) => {
          if (!isTopPaySaving) setIsTopPayOpen(open);
          if (!open) {
            setTopPayCustomerId('');
            setTopPayAmount('');
            setTopPayReference('');
            setTopPayDescription('');
            setTopPayDate(new Date().toISOString().slice(0, 10));
            setAccountPayments([]);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Customer Payment</DialogTitle>
            <DialogDescription>
              Best view for a particular customer: keep payments in chronological order with method, reference and amount.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select value={topPayCustomerId} onValueChange={setTopPayCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer with balance" />
                  </SelectTrigger>
                  <SelectContent>
                    {customersWithOutstanding.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {`${c.first_name} ${c.last_name}`.trim()} ({fc(c.credit_balance)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Method</Label>
                <Select
                  value={topPayMethod}
                  onValueChange={(v) => setTopPayMethod(v as 'cash' | 'card' | 'qr')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="qr">QR / Mobile</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedTopPayCustomer && (
              <div className="p-3 rounded-lg bg-muted/40 text-sm flex items-center justify-between">
                <span className="text-muted-foreground">Current Account Balance</span>
                <span className="font-semibold text-warning tabular-nums">
                  {fc(selectedTopPayCustomer.credit_balance)}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={topPayAmount}
                  onChange={(e) => setTopPayAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Date</Label>
                <Input
                  type="date"
                  value={topPayDate}
                  onChange={(e) => setTopPayDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Reference (optional)</Label>
                <Input
                  value={topPayReference}
                  onChange={(e) => setTopPayReference(e.target.value)}
                  placeholder="Txn ID / receipt no."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                value={topPayDescription}
                onChange={(e) => setTopPayDescription(e.target.value)}
                placeholder="e.g. Weekly settlement, bank transfer"
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleSubmitTopPay}
                disabled={isTopPaySaving || !topPayCustomerId}
                className="gap-2 bg-success hover:bg-success/90 text-white"
              >
                {isTopPaySaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CircleDollarSign className="w-4 h-4" />
                )}
                Record Payment
              </Button>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-2">Payments Received (Selected Customer)</h4>
              {accountPaymentsLoading ? (
                <div className="py-8 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : accountPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  {topPayCustomerId
                    ? 'No recorded account payments yet.'
                    : 'Select a customer to view payment history.'}
                </p>
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {accountPayments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2.5 rounded border bg-muted/30"
                    >
                      <div>
                        <p className="text-sm capitalize font-medium">
                          {p.method}
                          {p.reference && (
                            <span className="text-xs text-muted-foreground font-mono ml-2">
                              ({p.reference})
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(p.created_at), 'MMM dd, yyyy · HH:mm')}
                        </p>
                        {p.notes && (
                          <p className="text-xs text-muted-foreground">{p.notes}</p>
                        )}
                      </div>
                      <p className="font-semibold text-success tabular-nums">{fc(p.amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
