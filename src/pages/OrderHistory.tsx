import { useState, useMemo, useEffect, useRef } from 'react';
import { PageLayout } from '@/components/pos/PageLayout';
import { StatusChip } from '@/components/ui/StatusChip';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Search,
  X,
  Loader2,
  CreditCard,
  Banknote,
  SlidersHorizontal,
  Undo2,
  MoreHorizontal,
  CalendarRange,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { OrderDetailDrawer } from '@/components/order/OrderDetailDrawer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { InvoiceDialog } from '@/components/receipt/InvoiceDialog';
import { PaymentDialog } from '@/components/payment/PaymentDialog';
import { EditPaymentDialog } from '@/components/payment/EditPaymentDialog';
import { ReceiptData } from '@/data/receiptData';
import { useOrders, SaleOrder, Payment, sumActivePaymentAmount } from '@/hooks/useOrders';
import { useCustomers, Customer } from '@/hooks/useCustomers';
import { toast } from 'sonner';
import { fc, CURRENCY_SYMBOL } from '@/lib/currency';
import { formatKES } from '@/lib/formatKES';
import { Money } from '@/components/ui/Money';
import { formatCompactDateRange, formatDate } from '@/lib/formatDate';
import {
  getPaymentMethodLabel,
  getPaymentReferenceFieldLabel,
} from '@/lib/paymentMethods';
import {
  RecordDialogShell,
  RECORD_OUTLINED_BTN,
  RECORD_PRIMARY_BTN,
} from '@/components/payment/RecordDialogShell';
import {
  ACCOUNT_QUICK_PAYMENT_TILES,
  PaymentMethodTiles,
} from '@/components/payment/PaymentMethodTiles';
import { getOrderListStatus } from '@/lib/orderListStatus';
import { TypedNumberHint } from '@/components/ui/typed-number-hint';
import { useCompanySettings } from '@/context/BusinessSettingsContext';
import { notifyAccountPaymentReceived, notifyInvoiceCancelled } from '@/lib/sendSms';
import { supabase } from '@/lib/supabase';
import { useBusinessMode } from '@/context/BusinessModeContext';
import { useAuth } from '@/context/AuthContext';

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

type PaymentReverseTarget =
  | {
      kind: 'order';
      paymentId: string;
      amount: number;
      method: string;
      paidAt: string;
      customerName?: string;
    }
  | {
      kind: 'account';
      paymentId: string;
      amount: number;
      method: string;
      customerId: string;
      paidAt: string;
      customerName: string;
    };

const ACCENT_BTN =
  'focus-ring inline-flex min-h-[var(--tap-min)] items-center justify-center rounded-[var(--radius)] bg-primary px-4 text-sm font-semibold text-primary-foreground active:scale-[0.98]';

const OUTLINED_BTN =
  'focus-ring inline-flex h-10 items-center justify-center rounded-[var(--radius)] border border-hairline bg-surface px-3 text-sm font-semibold text-ink active:scale-[0.98]';

const RECORD_PAYMENT_BTN =
  'focus-ring inline-flex h-10 min-h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-[var(--radius)] border border-hairline bg-surface px-3 text-sm font-semibold text-ink active:scale-[0.98]';

const ROW_MORE_BTN =
  'focus-ring inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] border border-hairline bg-surface text-ink';

const DATE_RANGE_BTN =
  'focus-ring inline-flex h-10 min-h-10 items-center justify-center gap-2 rounded-[var(--radius)] border border-hairline bg-surface px-3 text-sm font-semibold text-ink active:scale-[0.98]';

const PHONE_FILTER_BTN =
  'focus-ring inline-flex h-12 min-h-12 min-w-0 items-center justify-center gap-2 rounded-[var(--radius)] border border-hairline bg-surface px-3 text-sm font-semibold text-ink active:scale-[0.98]';

function formatOrderListDateTime(iso: string): string {
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${formatDate(date)}, ${time}`;
}

function orderItemsCaption(order: SaleOrder): string {
  const n = order.items.length;
  const items = n === 1 ? '1 item' : `${n} items`;
  if (order.sale_type === 'credit') {
    return `Credit · ${items}`;
  }
  return items;
}

function RuledPlaceholderRows({ count = 6 }: { count?: number }) {
  return (
    <div className="divide-y divide-hairline border-y border-hairline">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex min-h-[var(--tap-min)] items-center gap-3 py-2">
          <div className="h-3 flex-1 max-w-[40%] rounded-sm bg-hairline/80" aria-hidden />
          <div className="ml-auto h-3 w-16 rounded-sm bg-hairline/60" aria-hidden />
        </div>
      ))}
    </div>
  );
}

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
  const {
    orders,
    loading,
    error: ordersError,
    refetch: refetchOrders,
    refundOrder,
    cancelCreditInvoice,
    updatePayment,
    deletePayment,
    todaysOrders,
    todaysRevenue,
    unpaidCreditOrders,
    getOrderBalanceDue,
    recordPayment,
  } = useOrders();
  const {
    customers,
    totalOutstanding,
    getCustomerById,
    getCustomerDisplayName,
    makePaymentOnAccount,
    reverseCustomerAccountPayment,
    refetch: refetchCustomers,
  } = useCustomers();
  const { isAdmin, isManager } = useAuth();
  const canReversePayments = isAdmin || isManager;
  const canCancelCreditInvoices = canReversePayments;
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
  const [paymentReverseTarget, setPaymentReverseTarget] = useState<PaymentReverseTarget | null>(null);
  const [isReversingPayment, setIsReversingPayment] = useState(false);
  const [refundingOrderId, setRefundingOrderId] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [creditCancelTarget, setCreditCancelTarget] = useState<SaleOrder | null>(null);
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
  const [showAllAccountPayments, setShowAllAccountPayments] = useState(false);
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
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [isDesktopMd, setIsDesktopMd] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  );
  const detailReturnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => setIsDesktopMd(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Sales history';
    return () => {
      document.title = prevTitle;
    };
  }, []);

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

    const isCreditDueTab =
      saleTypeFilter === 'credit' &&
      statusFilter === 'all' &&
      paymentMethodFilter === 'all';

    if (isCreditDueTab) {
      result = result.filter(
        (o) =>
          o.sale_type === 'credit' &&
          o.status !== 'cancelled' &&
          getOrderBalanceDue(o) > 0,
      );
    } else if (saleTypeFilter !== 'all') {
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

    return [...result].sort((a, b) => {
      const byDate =
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (byDate !== 0) return byDate;
      return b.order_number.localeCompare(a.order_number, undefined, {
        numeric: true,
      });
    });
  }, [
    sourceOrders,
    searchQuery,
    statusFilter,
    saleTypeFilter,
    paymentMethodFilter,
    getOrderBalanceDue,
  ]);

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

  /** Credit due tab count matches list rows in view (balance due via getOrderBalanceDue). */
  const creditDueOrdersInView = useMemo(
    () =>
      sourceOrders.filter(
        (o) =>
          o.sale_type === 'credit' &&
          o.status !== 'cancelled' &&
          getOrderBalanceDue(o) > 0,
      ),
    [sourceOrders, getOrderBalanceDue],
  );
  const handleViewOrder = (order: SaleOrder, returnFocus?: HTMLElement | null) => {
    if (returnFocus) {
      detailReturnFocusRef.current = returnFocus;
    } else if (document.activeElement instanceof HTMLElement) {
      detailReturnFocusRef.current = document.activeElement;
    }
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

  const canCancelCreditInvoiceForOrder = (order: SaleOrder) =>
    canCancelCreditInvoices &&
    order.sale_type === 'credit' &&
    getOrderBalanceDue(order) > 0 &&
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

  const confirmCancelCreditInvoice = async () => {
    if (!creditCancelTarget) return;
    const order = creditCancelTarget;
    setCancellingOrderId(order.id);
    try {
      const customerBefore =
        order.customer_id != null
          ? getCustomerById(order.customer_id)
          : null;
      const result = await cancelCreditInvoice(order.id);
      const balanceBefore = Number(
        result?.balance_before ?? customerBefore?.credit_balance ?? 0,
      );
      const balanceAfter = Number(result?.balance_after ?? balanceBefore);
      const amountRemoved = Number(
        result?.amount_removed ?? getOrderBalanceDue(order),
      );
      const totalPaid = Number(
        result?.total_paid ??
          sumActivePaymentAmount(order.payments),
      );

      const freshCustomers = await refetchCustomers();
      const freshCustomer =
        order.customer_id != null
          ? freshCustomers.find((c) => c.id === order.customer_id)
          : null;

      notifyInvoiceCancelled(
        order,
        smsShopName,
        amountRemoved,
        balanceBefore,
        balanceAfter,
        totalPaid,
        freshCustomer?.phone || order.customer_phone,
      );

      toast.success(
        `Credit invoice #${order.invoice_number || order.order_number} cancelled`,
      );
      setCreditCancelTarget(null);
      setIsDetailOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel credit invoice');
    } finally {
      setCancellingOrderId(null);
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
  };

  const handleEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setIsEditPaymentOpen(true);
  };

  const handleEditPaymentComplete = () => {
    toast.success('Payment updated');
  };

  const canModifyOrderPayments = (order: SaleOrder) =>
    order.payment_status !== 'voided' &&
    order.payment_status !== 'refunded' &&
    order.status !== 'voided' &&
    order.status !== 'cancelled';

  const requestReverseOrderPayment = (payment: Payment) => {
    setPaymentReverseTarget({
      kind: 'order',
      paymentId: payment.id,
      amount: payment.amount,
      method: payment.method,
      paidAt: payment.paid_at,
      customerName: selectedOrder?.customer_name,
    });
  };

  const requestReverseAccountPayment = (payment: CustomerAccountPayment) => {
    const cust = getCustomerById(payment.customer_id);
    const name = cust
      ? `${cust.first_name} ${cust.last_name}`.trim()
      : getCustomerDisplayName(payment.customer_id);
    setPaymentReverseTarget({
      kind: 'account',
      paymentId: payment.id,
      amount: payment.amount,
      method: payment.method,
      customerId: payment.customer_id,
      paidAt: payment.created_at,
      customerName: name,
    });
  };

  const refreshAccountPaymentsForCustomer = async (customerId: string) => {
    const { data, error } = await supabase
      .from('customer_account_payments')
      .select('id, customer_id, method, amount, reference, notes, created_at')
      .eq('customer_id', customerId)
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
  };

  const confirmReversePayment = async () => {
    if (!paymentReverseTarget) return;
    setIsReversingPayment(true);
    try {
      if (paymentReverseTarget.kind === 'order') {
        setDeletingPaymentId(paymentReverseTarget.paymentId);
        const ok = await deletePayment(paymentReverseTarget.paymentId);
        if (ok) {
          toast.success('Payment reversed — order balance updated');
        } else {
          toast.error('Failed to reverse payment');
        }
      } else {
        setDeletingPaymentId(paymentReverseTarget.paymentId);
        const result = await reverseCustomerAccountPayment(paymentReverseTarget.paymentId);
        if (result.success) {
          toast.success('Payment reversed — customer balance restored');
          await refetchCustomers();
          if (topPayCustomerId === paymentReverseTarget.customerId) {
            await refreshAccountPaymentsForCustomer(paymentReverseTarget.customerId);
          }
        } else {
          toast.error(result.error || 'Failed to reverse payment');
        }
      }
      setPaymentReverseTarget(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reverse payment');
    } finally {
      setDeletingPaymentId(null);
      setIsReversingPayment(false);
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

  const cancelledTabCount = useMemo(
    () => sourceOrders.filter((o) => o.status === 'cancelled').length,
    [sourceOrders],
  );

  const toolbarTab = useMemo((): 'all' | 'credit' | 'cancelled' => {
    if (statusFilter === 'cancelled') return 'cancelled';
    if (
      saleTypeFilter === 'credit' &&
      statusFilter === 'all' &&
      paymentMethodFilter === 'all'
    ) {
      return 'credit';
    }
    return 'all';
  }, [statusFilter, saleTypeFilter, paymentMethodFilter]);

  const handleToolbarTab = (tab: 'all' | 'credit' | 'cancelled') => {
    if (tab === 'all') {
      clearFilters();
      return;
    }
    if (tab === 'cancelled') {
      setStatusFilter('cancelled');
      setSaleTypeFilter('all');
      setPaymentMethodFilter('all');
      return;
    }
    setSaleTypeFilter('credit');
    setStatusFilter('all');
    setPaymentMethodFilter('all');
  };

  const dateRangeLabel = useMemo(() => {
    const from = new Date(`${reportFromDate}T12:00:00`);
    const to = new Date(`${reportToDate}T12:00:00`);
    return formatCompactDateRange(from, to);
  }, [reportFromDate, reportToDate]);

  const dateRangeAriaLabel = useMemo(() => {
    const from = formatDate(new Date(`${reportFromDate}T12:00:00`));
    const to = formatDate(new Date(`${reportToDate}T12:00:00`));
    return `Date range, ${from} – ${to}`;
  }, [reportFromDate, reportToDate]);

  const listLoading = loading || isReportLoading;
  const filtersActive = activeFilterCount > 0 || Boolean(searchQuery);

  const dateRangeControls = (
    <div className="space-y-3">
      <p id="date-range-heading" className="sr-only">
        Date range
      </p>
      <section aria-labelledby="date-range-heading">
        {isReportMode ? (
          <p className="text-xs font-medium text-ink-2">Report mode — list and totals use this range.</p>
        ) : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className={cn('w-full sm:flex-1', ACCENT_BTN)}
            onClick={() => void fetchSalesReport()}
            disabled={isReportLoading}
          >
            {isReportLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            Fetch Report
          </Button>
          <Button
            variant="outline"
            className="w-full border-hairline sm:flex-1"
            onClick={clearSalesReport}
            disabled={!isReportMode}
          >
            Clear Report
          </Button>
        </div>
      </section>
    </div>
  );

  return (
    <PageLayout
      activeTab="order-history"
      onNavigate={onNavigate}
      headerTitle="Sales history"
    >
      <div className="mx-auto flex w-full min-w-0 max-w-[1280px] flex-col gap-6 md:gap-4">
        <header className="flex min-w-0 items-start justify-between gap-3 border-b border-hairline pb-6 md:pb-4">
          <h1 className="min-w-0 text-2xl font-bold text-ink md:text-3xl">Sales history</h1>
          <button type="button" className={ACCENT_BTN} onClick={() => setIsTopPayOpen(true)}>
            Record payment
          </button>
        </header>

        <section
          aria-labelledby="oh-summary-heading"
          className="border-b border-hairline pb-6 md:pb-4"
        >
          <h2 id="oh-summary-heading" className="sr-only">
            Summary
          </h2>
          {listLoading ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
              <div className="h-10 w-40 rounded-sm bg-hairline/80" aria-hidden />
              <div className="h-10 w-40 rounded-sm bg-hairline/80" aria-hidden />
            </div>
          ) : (
            <div className="flex flex-col gap-6 sm:flex-row sm:gap-12">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-2">Takings today</p>
                <p className="mt-1 text-[32px] font-bold leading-tight text-ink">
                  {formatKES(todaysRevenue)}
                </p>
                <p className="mt-1 text-sm text-ink-2">
                  {todaysOrders.length === 1
                    ? '1 order today'
                    : `${todaysOrders.length} orders today`}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-2">Credit outstanding</p>
                <p className="mt-1 text-[32px] font-bold leading-tight text-ink">
                  {formatKES(totalOutstanding)}
                </p>
                {customersWithOutstanding.length > 0 ? (
                  <p className="mt-1 text-sm text-ink-2">
                    {customersWithOutstanding.length === 1
                      ? '1 customer with account balance'
                      : `${customersWithOutstanding.length} customers with account balance`}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-ink-2">Customer ledger balances</p>
                )}
              </div>
            </div>
          )}
          {isReportMode && !listLoading ? (
            <p className="mt-4 text-sm text-ink-2">
              Range totals:{' '}
              {formatKES(sourceOrders.reduce((sum, o) => sum + o.total, 0))}
              {' · '}
              {sourceOrders.length === 1
                ? '1 order in range'
                : `${sourceOrders.length} orders in range`}
            </p>
          ) : null}
        </section>

        {ordersError && !listLoading ? (
          <div
            className="flex flex-wrap items-center gap-3 border-b border-hairline pb-4 text-sm text-ink"
            role="alert"
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0 text-fail" aria-hidden />
              {ordersError}
            </span>
            <button type="button" className={OUTLINED_BTN} onClick={() => void refetchOrders()}>
              Retry
            </button>
          </div>
        ) : null}

        <section aria-label="Sales history filters" className="space-y-3 border-b border-hairline pb-4">
          <div className="relative w-full min-w-0 md:max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2"
              aria-hidden
            />
            <Input
              type="search"
              placeholder="Search orders…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 min-h-10 border-hairline pl-10 [@media(pointer:coarse)]:h-12 [@media(pointer:coarse)]:min-h-12"
              aria-label="Search orders"
            />
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div
              className="scrollbar-hide -mx-1 flex min-w-0 gap-1 overflow-x-auto px-1 pb-0.5"
              role="tablist"
              aria-label="Sales list filters"
            >
              {(
                [
                  { id: 'all' as const, label: 'All', count: sourceOrders.length },
                  { id: 'credit' as const, label: 'Credit due', count: creditDueOrdersInView.length },
                  { id: 'cancelled' as const, label: 'Cancelled', count: cancelledTabCount },
                ] as const
              ).map((tab) => {
                const selected = toolbarTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    className={cn(
                      'focus-ring shrink-0 whitespace-nowrap border-b-2 px-3 pb-2 pt-1 text-sm text-ink-2 transition-colors',
                      '[@media(pointer:coarse)]:min-h-12',
                      selected
                        ? 'border-primary font-semibold text-ink'
                        : 'border-transparent font-medium hover:text-ink',
                    )}
                    onClick={() => handleToolbarTab(tab.id)}
                  >
                    {tab.label}
                    <span className="ml-1 font-mono text-xs font-normal tabular-nums">
                      ({tab.count})
                    </span>
                  </button>
                );
              })}
            </div>

            <div
              className={cn(
                'w-full shrink-0 gap-2 md:w-auto md:flex md:flex-row md:flex-wrap md:items-center',
                isDesktopMd ? 'flex flex-row flex-wrap items-center' : 'grid grid-cols-2',
              )}
            >
              {isDesktopMd ? (
                <Popover open={dateRangeOpen} onOpenChange={setDateRangeOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={DATE_RANGE_BTN}
                      aria-haspopup="dialog"
                      aria-label={dateRangeAriaLabel}
                    >
                      <CalendarRange className="h-4 w-4 shrink-0 text-ink-2" aria-hidden />
                      <span className="whitespace-nowrap">{dateRangeLabel}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 border-hairline" align="end">
                    {dateRangeControls}
                  </PopoverContent>
                </Popover>
              ) : (
                <>
                  <button
                    type="button"
                    className={cn(PHONE_FILTER_BTN, 'w-full')}
                    aria-haspopup="dialog"
                    aria-label={dateRangeAriaLabel}
                    onClick={() => setDateRangeOpen(true)}
                  >
                    <CalendarRange className="h-4 w-4 shrink-0 text-ink-2" aria-hidden />
                    <span className="min-w-0 truncate">{dateRangeLabel}</span>
                  </button>
                  <Sheet open={dateRangeOpen} onOpenChange={setDateRangeOpen}>
                    <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
                      <SheetHeader>
                        <SheetTitle>Date range</SheetTitle>
                        <SheetDescription>
                          Fetch sales for a custom date range into the list below.
                        </SheetDescription>
                      </SheetHeader>
                      <div className="mt-4">{dateRangeControls}</div>
                    </SheetContent>
                  </Sheet>
                </>
              )}

              <button
                type="button"
                className={cn(isDesktopMd ? DATE_RANGE_BTN : PHONE_FILTER_BTN, 'w-full')}
                onClick={() => setFiltersOpen(true)}
              >
                <SlidersHorizontal className="h-4 w-4 shrink-0 text-ink-2" aria-hidden />
                <span className="truncate">More filters</span>
                {activeFilterCount > 0 ? (
                  <span className="shrink-0 font-mono text-xs text-ink-2">
                    ({activeFilterCount})
                  </span>
                ) : null}
              </button>
            </div>
          </div>
        </section>

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

        {listLoading ? (
          <RuledPlaceholderRows count={8} />
        ) : (
          <div className="min-w-0 space-y-4">
            {paginatedOrders.length > 0 ? (
              <p className="text-sm text-ink-2">
                {filteredOrders.length === 1
                  ? '1 order'
                  : `${filteredOrders.length} orders`}
                {isReportMode ? ' in range' : null}
              </p>
            ) : null}

            {filteredOrders.length === 0 ? (
              <div className="flex flex-wrap items-center gap-3 border-b border-hairline py-4 text-sm text-ink">
                <span>No orders match these filters.</span>
                {filtersActive ? (
                  <button
                    type="button"
                    className="focus-ring text-sm font-semibold text-primary underline-offset-2 hover:underline"
                    onClick={() => {
                      clearFilters();
                      setSearchQuery('');
                    }}
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            ) : null}

            {paginatedOrders.length > 0 ? (
              <>
                <div className="hidden min-w-0 md:block">
                  <table className="w-full table-fixed border-collapse">
                    <colgroup>
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '20%' }} />
                      <col style={{ width: '20%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '220px' }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-hairline text-left text-xs font-semibold text-ink-2">
                        <th className="pb-2 pr-2 font-semibold">Order</th>
                        <th className="pb-2 pr-2 font-semibold">Customer</th>
                        <th className="pb-2 pr-2 font-semibold">Date</th>
                        <th className="pb-2 pr-2 text-right font-semibold">Total</th>
                        <th className="pb-2 pr-2 font-semibold">Status</th>
                        <th className="pb-2 font-semibold">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedOrders.map((order) => {
                        const balanceDue = getOrderBalanceDue(order);
                        const listStatus = getOrderListStatus(order, getOrderBalanceDue);
                        const showDue = balanceDue > 0 && order.status !== 'cancelled';
                        return (
                          <tr
                            key={order.id}
                            data-order-focus={order.id}
                            tabIndex={-1}
                            className="cursor-pointer border-b border-hairline [@media(hover:hover)]:hover:bg-[hsl(var(--accent-soft))]/40"
                            onClick={(e) =>
                              handleViewOrder(order, e.currentTarget as HTMLElement)
                            }
                          >
                            <td className="py-3 pr-2 align-top">
                              <button
                                type="button"
                                data-order-focus={order.id}
                                className="focus-ring font-mono text-sm font-semibold text-ink underline-offset-2 hover:underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewOrder(order, e.currentTarget as HTMLElement);
                                }}
                              >
                                #{order.order_number}
                              </button>
                              <p className="mt-0.5 text-xs text-ink-2">{orderItemsCaption(order)}</p>
                            </td>
                            <td className="max-w-0 py-3 pr-2 align-top">
                              <span className="block truncate text-sm text-ink">
                                {order.customer_name || '—'}
                              </span>
                            </td>
                            <td className="py-3 pr-2 align-top text-sm whitespace-nowrap text-ink-2">
                              {formatOrderListDateTime(order.created_at)}
                            </td>
                            <td className="py-3 pr-2 text-right align-top">
                              <span
                                className={cn(
                                  'font-mono text-sm font-semibold tabular-nums text-ink',
                                  order.status === 'cancelled' && 'line-through',
                                )}
                              >
                                {formatKES(order.total)}
                              </span>
                            </td>
                            <td className="py-3 pr-2 align-top">
                              <StatusChip status={listStatus} />
                              {showDue ? (
                                <p className="mt-1 font-mono text-[13px] text-ink">
                                  Due {formatKES(balanceDue)}
                                </p>
                              ) : null}
                            </td>
                            <td className="py-3 align-top">
                              <div
                                className="flex w-[220px] items-center justify-end gap-1"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                              >
                                {canRecordPaymentForOrder(order) ? (
                                  <button
                                    type="button"
                                    className={RECORD_PAYMENT_BTN}
                                    onClick={() => handleRecordPayment(order)}
                                  >
                                    Record payment
                                  </button>
                                ) : (
                                  <span
                                    className="inline-block h-10 w-[9.25rem] shrink-0"
                                    aria-hidden
                                  />
                                )}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      className={ROW_MORE_BTN}
                                      aria-label={`More actions for #${order.order_number}`}
                                    >
                                      <MoreHorizontal className="h-5 w-5" aria-hidden />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="border-hairline">
                                    <DropdownMenuItem
                                      className="cursor-pointer"
                                      onSelect={() => handleViewOrder(order)}
                                    >
                                      View details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="cursor-pointer"
                                      onSelect={() => handlePrintReceipt(order)}
                                    >
                                      View receipt
                                    </DropdownMenuItem>
                                    {canRecordPaymentForOrder(order) ? (
                                      <DropdownMenuItem
                                        className="cursor-pointer"
                                        onSelect={() => handleRecordPayment(order)}
                                      >
                                        Record payment
                                      </DropdownMenuItem>
                                    ) : null}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-hairline border-y border-hairline md:hidden">
                  {paginatedOrders.map((order) => {
                    const balanceDue = getOrderBalanceDue(order);
                    const listStatus = getOrderListStatus(order, getOrderBalanceDue);
                    const showDue = balanceDue > 0 && order.status !== 'cancelled';
                    const metaParts = [
                      `#${order.order_number}`,
                      ...(order.sale_type === 'credit' ? ['Credit'] : []),
                      formatDate(new Date(order.created_at)),
                    ];

                    return (
                      <button
                        key={order.id}
                        type="button"
                        data-order-focus={order.id}
                        className="focus-ring flex min-h-[5.5rem] w-full flex-col justify-center gap-1 bg-transparent py-3 text-left focus:bg-transparent focus-visible:bg-transparent [@media(hover:hover)]:hover:bg-[hsl(var(--accent-soft))]/40 active:bg-[hsl(var(--accent-soft))]/40"
                        onClick={(e) =>
                          handleViewOrder(order, e.currentTarget as HTMLElement)
                        }
                      >
                        <div className="flex min-w-0 items-baseline justify-between gap-2">
                          <span className="min-w-0 truncate text-sm font-semibold text-ink">
                            {order.customer_name || '—'}
                          </span>
                          <span
                            className={cn(
                              'shrink-0 font-mono text-sm font-semibold tabular-nums text-ink',
                              order.status === 'cancelled' && 'line-through',
                            )}
                          >
                            {formatKES(order.total)}
                          </span>
                        </div>
                        <p className="truncate text-xs text-ink-2">{metaParts.join(' · ')}</p>
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <StatusChip status={listStatus} />
                          {showDue ? (
                            <span className="font-mono text-[13px] text-ink">
                              Due {formatKES(balanceDue)}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}

            {filteredOrders.length > 0 ? (
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredOrders.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
              />
            ) : null}
          </div>
        )}
      </div>

      <OrderDetailDrawer
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        order={selectedOrder}
        isDesktopMd={isDesktopMd}
        customer={
          selectedOrder?.customer_id
            ? getCustomerById(selectedOrder.customer_id) ?? null
            : null
        }
        getOrderBalanceDue={getOrderBalanceDue}
        onPrintReceipt={handlePrintReceipt}
        onRecordPayment={handleRecordPayment}
        canRecordPayment={
          selectedOrder ? canRecordPaymentForOrder(selectedOrder) : false
        }
        onEditPayment={handleEditPayment}
        onReversePayment={requestReverseOrderPayment}
        canModifyPayments={
          selectedOrder ? canModifyOrderPayments(selectedOrder) : false
        }
        canReversePayments={canReversePayments}
        reversingPaymentId={deletingPaymentId}
        returnFocusRef={detailReturnFocusRef}
      />

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

      <RecordDialogShell
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
            setShowAllAccountPayments(false);
          }
        }}
        isDesktopMd={isDesktopMd}
        blockClose={isTopPaySaving}
        title="Record customer payment"
        subtitle="Choose a customer, then add the payment."
        titleId="record-customer-payment-title"
        descriptionId="record-customer-payment-desc"
        footer={
          <div className="space-y-2">
            {(!topPayAmount || parseFloat(topPayAmount) <= 0) && topPayCustomerId ? (
              <p className="text-center text-sm text-ink-2">Enter an amount</p>
            ) : null}
            <div className="flex gap-3">
              <button
                type="button"
                className={RECORD_OUTLINED_BTN}
                onClick={() => {
                  if (!isTopPaySaving) setIsTopPayOpen(false);
                }}
                disabled={isTopPaySaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={RECORD_PRIMARY_BTN}
                onClick={() => void handleSubmitTopPay()}
                disabled={
                  isTopPaySaving ||
                  !topPayCustomerId ||
                  !topPayAmount ||
                  parseFloat(topPayAmount) <= 0
                }
              >
                {isTopPaySaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Processing…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate font-sans tabular-nums">
                      Record{' '}
                      <Money
                        value={
                          parseFloat(topPayAmount) > 0
                            ? parseFloat(topPayAmount)
                            : 0
                        }
                        sansInline
                      />
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-ink">Customer</Label>
            <Select
              value={topPayCustomerId}
              onValueChange={(id) => {
                setTopPayCustomerId(id);
                setShowAllAccountPayments(false);
              }}
            >
              <SelectTrigger className="min-h-12 border-hairline">
                <SelectValue placeholder="Select customer with balance" />
              </SelectTrigger>
              <SelectContent>
                {customersWithOutstanding.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {`${c.first_name} ${c.last_name}`.trim()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTopPayCustomer ? (
              <p className="text-sm text-ink-2">
                Owes {formatKES(selectedTopPayCustomer.credit_balance)}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-ink">Payment method</Label>
            <PaymentMethodTiles
              methods={ACCOUNT_QUICK_PAYMENT_TILES}
              value={topPayMethod}
              onChange={setTopPayMethod}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="top-pay-amount" className="text-sm font-semibold text-ink">
                Amount
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-2">
                  KES
                </span>
                <Input
                  id="top-pay-amount"
                  type="text"
                  inputMode="decimal"
                  value={topPayAmount}
                  onChange={(e) => setTopPayAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-14 border-hairline pl-14 font-sans text-[28px] font-bold tabular-nums md:text-[28px]"
                />
              </div>
              <TypedNumberHint value={topPayAmount} prefix={`${CURRENCY_SYMBOL} `} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="top-pay-date" className="text-sm font-semibold text-ink">
                Payment date · {formatDate(new Date(`${topPayDate}T12:00:00`))}
              </Label>
              <Input
                id="top-pay-date"
                type="date"
                value={topPayDate}
                onChange={(e) => setTopPayDate(e.target.value)}
                className="min-h-12 border-hairline"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="top-pay-ref" className="text-sm font-semibold text-ink">
                {getPaymentReferenceFieldLabel(topPayMethod)}
              </Label>
              <Input
                id="top-pay-ref"
                value={topPayReference}
                onChange={(e) => setTopPayReference(e.target.value)}
                className="min-h-12 border-hairline"
                placeholder="Txn ID or receipt no."
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="top-pay-desc" className="text-sm font-semibold text-ink">
                Description (optional)
              </Label>
              <Input
                id="top-pay-desc"
                value={topPayDescription}
                onChange={(e) => setTopPayDescription(e.target.value)}
                className="min-h-12 border-hairline"
                placeholder="e.g. Weekly settlement"
              />
            </div>
          </div>

          <section className="border-t border-hairline pt-4" aria-labelledby="recent-payments-heading">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h3 id="recent-payments-heading" className="text-sm font-semibold text-ink">
                Recent payments ({accountPayments.length})
              </h3>
            </div>
            {accountPaymentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
              </div>
            ) : accountPayments.length === 0 ? (
              <p className="py-4 text-sm text-ink-2">
                {topPayCustomerId
                  ? 'No recorded account payments yet.'
                  : 'Select a customer to view payment history.'}
              </p>
            ) : (
              <>
                <ul className="divide-y divide-hairline border-y border-hairline">
                  {(showAllAccountPayments
                    ? accountPayments
                    : accountPayments.slice(0, 5)
                  ).map((p) => (
                    <li
                      key={p.id}
                      className="max-h-[72px] space-y-1 py-2"
                      title={p.notes || undefined}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-semibold text-ink">
                          {formatDate(new Date(p.created_at))}
                        </span>
                        <Money
                          value={p.amount}
                          className="text-sm font-semibold text-ink"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-sm text-ink-2">
                          {getPaymentMethodLabel(p.method)}
                          {p.reference ? (
                            <span className="ml-1 font-mono text-xs">
                              ({p.reference})
                            </span>
                          ) : null}
                        </span>
                        {canReversePayments ? (
                          <button
                            type="button"
                            className="focus-ring inline-flex h-12 min-h-12 shrink-0 items-center gap-1 px-2 text-sm font-semibold text-ink"
                            onClick={() => requestReverseAccountPayment(p)}
                            disabled={deletingPaymentId === p.id}
                          >
                            {deletingPaymentId === p.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : (
                              <Undo2 className="h-4 w-4 text-fail" aria-hidden />
                            )}
                            Reverse
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
                {accountPayments.length > 5 && !showAllAccountPayments ? (
                  <button
                    type="button"
                    className="focus-ring mt-3 inline-flex h-12 min-h-12 items-center text-sm font-semibold text-ink underline-offset-2 hover:underline"
                    onClick={() => setShowAllAccountPayments(true)}
                  >
                    Show all {accountPayments.length}
                  </button>
                ) : null}
              </>
            )}
          </section>
        </div>
      </RecordDialogShell>

      <AlertDialog
        open={!!paymentReverseTarget}
        onOpenChange={(open) => {
          if (!open && !isReversingPayment) setPaymentReverseTarget(null);
        }}
      >
        <AlertDialogContent className="border-hairline">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-ink">Reverse payment?</AlertDialogTitle>
            <AlertDialogDescription className="text-ink-2">
              {paymentReverseTarget ? (
                paymentReverseTarget.kind === 'account' ? (
                  <>
                    Reverse {formatKES(paymentReverseTarget.amount)} (
                    {getPaymentMethodLabel(paymentReverseTarget.method)},{' '}
                    {formatDate(new Date(paymentReverseTarget.paidAt))})? This adds{' '}
                    {formatKES(paymentReverseTarget.amount)} back to{' '}
                    {paymentReverseTarget.customerName}&apos;s balance.
                  </>
                ) : (
                  <>
                    Reverse {formatKES(paymentReverseTarget.amount)} (
                    {getPaymentMethodLabel(paymentReverseTarget.method)},{' '}
                    {formatDate(new Date(paymentReverseTarget.paidAt))})? The order payment
                    status and any customer credit balance will be recalculated.
                  </>
                )
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isReversingPayment}
              className="min-h-12 border-hairline"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-12 gap-2 bg-surface text-ink hover:bg-surface border border-hairline"
              disabled={isReversingPayment}
              onClick={(e) => {
                e.preventDefault();
                void confirmReversePayment();
              }}
            >
              {isReversingPayment ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Reversing…
                </>
              ) : (
                <>
                  <Undo2 className="h-4 w-4 text-fail" aria-hidden />
                  Reverse payment
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!creditCancelTarget}
        onOpenChange={(open) => {
          if (!open && !cancellingOrderId) setCreditCancelTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this credit invoice?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              {creditCancelTarget ? (
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Invoice{' '}
                    <span className="font-medium text-foreground">
                      #{creditCancelTarget.invoice_number || creditCancelTarget.order_number}
                    </span>{' '}
                    for{' '}
                    <span className="font-medium text-foreground">
                      {fc(creditCancelTarget.total)}
                    </span>{' '}
                    will be marked cancelled. Stock will be restored (retail).{' '}
                    <span className="font-medium text-foreground">
                      {fc(getOrderBalanceDue(creditCancelTarget))}
                    </span>{' '}
                    will be removed from the customer&apos;s account balance.
                  </p>
                  {creditCancelTarget.payments.length > 0 && (
                    <p>
                      Deposits totalling{' '}
                      <span className="font-medium text-foreground">
                        {fc(
                          sumActivePaymentAmount(creditCancelTarget.payments),
                        )}
                      </span>{' '}
                      stay on record; refund any cash or M-Pesa separately if needed.
                    </p>
                  )}
                  {creditCancelTarget.customer_phone && (
                    <p>The customer will receive an SMS confirmation (main store only).</p>
                  )}
                </div>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!cancellingOrderId}>Keep invoice</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!cancellingOrderId}
              onClick={(e) => {
                e.preventDefault();
                void confirmCancelCreditInvoice();
              }}
            >
              {cancellingOrderId ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Cancelling…
                </>
              ) : (
                'Cancel invoice'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}
