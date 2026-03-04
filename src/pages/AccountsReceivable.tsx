import { useState, useMemo } from 'react';
import { PageLayout } from '@/components/pos/PageLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Loader2,
  CreditCard,
  CircleDollarSign,
  AlertTriangle,
  FileText,
  Users,
  Clock,
  ChevronDown,
  ChevronUp,
  ScrollText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, differenceInDays } from 'date-fns';
import { useOrders, SaleOrder } from '@/hooks/useOrders';
import { useCustomers, Customer } from '@/hooks/useCustomers';
import { PaymentDialog } from '@/components/payment/PaymentDialog';
import { InvoiceDialog } from '@/components/receipt/InvoiceDialog';
import { CustomerStatement } from '@/components/customer/CustomerStatement';
import { ReceiptData } from '@/data/receiptData';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currency';
import { useCompanySettings } from '@/context/BusinessSettingsContext';
import { PaymentMethod } from '@/hooks/useOrders';

interface AccountsReceivableProps {
  onNavigate: (tab: string) => void;
}

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
    type:
      (order.order_type as 'dine-in' | 'takeaway' | 'delivery') || 'dine-in',
    orderNotes: order.notes,
    staffName: order.staff_name,
  };
}

// Group unpaid orders by customer
interface CustomerAccount {
  customer: Customer | null;
  customerId: string | null;
  customerName: string;
  orders: SaleOrder[];
  invoiceOwed: number;
  openingOwed: number;
  totalOwed: number;
  oldestDue: Date | null;
  isOverdue: boolean;
}

export default function AccountsReceivable({
  onNavigate,
}: AccountsReceivableProps) {
  const {
    orders,
    loading: ordersLoading,
    unpaidCreditOrders,
    recordPayment,
    getOrderBalanceDue,
  } = useOrders();
  const {
    customers,
    getCustomerById,
    totalOutstanding,
    makePaymentOnAccount,
  } = useCustomers();
  const { companyName } = useCompanySettings();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [filterOverdue, setFilterOverdue] = useState(false);

  // Payment dialog state
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<SaleOrder | null>(null);
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [paymentOtherOrders, setPaymentOtherOrders] = useState<SaleOrder[]>([]);

  // Invoice dialog state
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [invoiceOrder, setInvoiceOrder] = useState<SaleOrder | null>(null);
  const [invoiceCustomer, setInvoiceCustomer] = useState<Customer | null>(null);

  // Statement dialog state
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);
  const [statementOrders, setStatementOrders] = useState<SaleOrder[]>([]);

  // Account-level payment dialog (for balances without open invoices)
  const [isAccountPaymentOpen, setIsAccountPaymentOpen] = useState(false);
  const [accountPaymentCustomer, setAccountPaymentCustomer] = useState<Customer | null>(null);
  const [accountPaymentAmount, setAccountPaymentAmount] = useState('');
  const [accountPaymentMethod, setAccountPaymentMethod] = useState<PaymentMethod>('cash');
  const [isAccountPaymentSaving, setIsAccountPaymentSaving] = useState(false);

  // Group unpaid orders by customer
  const customerAccounts = useMemo(() => {
    const accountMap = new Map<string, CustomerAccount>();

    unpaidCreditOrders.forEach((order) => {
      const key = order.customer_id || order.customer_name || 'walk-in';
      const existing = accountMap.get(key);
      const cust = order.customer_id
        ? getCustomerById(order.customer_id)
        : null;
      const balanceDue = getOrderBalanceDue(order);
      const dueDate = order.due_date ? new Date(order.due_date) : null;
      const isOverdue = dueDate
        ? differenceInDays(new Date(), dueDate) > 0
        : false;

      if (existing) {
        existing.orders.push(order);
        existing.invoiceOwed += balanceDue;
        existing.totalOwed += balanceDue;
        if (dueDate && (!existing.oldestDue || dueDate < existing.oldestDue)) {
          existing.oldestDue = dueDate;
        }
        if (isOverdue) existing.isOverdue = true;
      } else {
        accountMap.set(key, {
          customer: cust,
          customerId: order.customer_id || null,
          customerName: cust
            ? `${cust.first_name} ${cust.last_name}`.trim()
            : order.customer_name || 'Walk-in',
          orders: [order],
          invoiceOwed: balanceDue,
          openingOwed: 0,
          totalOwed: balanceDue,
          oldestDue: dueDate,
          isOverdue,
        });
      }
    });

    // Align account balances to the customer ledger and include opening balances.
    accountMap.forEach((account) => {
      if (!account.customer) return;
      const customerBalance = Math.max(account.customer.credit_balance || 0, 0);
      account.totalOwed = customerBalance;
      account.openingOwed = Math.max(customerBalance - account.invoiceOwed, 0);
    });

    // Include customers with balance but no currently unpaid invoices
    // (e.g., imported opening balance carried from a previous system).
    customers.forEach((customer) => {
      const customerBalance = Math.max(customer.credit_balance || 0, 0);
      if (customerBalance <= 0) return;

      const key = customer.id;
      if (accountMap.has(key)) return;

      accountMap.set(key, {
        customer,
        customerId: customer.id,
        customerName: `${customer.first_name} ${customer.last_name}`.trim(),
        orders: [],
        invoiceOwed: 0,
        openingOwed: customerBalance,
        totalOwed: customerBalance,
        oldestDue: null,
        isOverdue: false,
      });
    });

    // Sort: overdue first, then by total owed descending
    return Array.from(accountMap.values()).sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return b.totalOwed - a.totalOwed;
    });
  }, [unpaidCreditOrders, getCustomerById, getOrderBalanceDue, customers]);

  // Filtered accounts
  const filteredAccounts = useMemo(() => {
    let result = customerAccounts;

    if (filterOverdue) {
      result = result.filter((a) => a.isOverdue);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.customerName.toLowerCase().includes(query) ||
          a.orders.some(
            (o) =>
              o.order_number.toLowerCase().includes(query) ||
              o.invoice_number?.toLowerCase().includes(query),
          ),
      );
    }

    return result;
  }, [customerAccounts, searchQuery, filterOverdue]);

  const overdueCount = useMemo(
    () => customerAccounts.filter((a) => a.isOverdue).length,
    [customerAccounts],
  );

  const overdueTotal = useMemo(
    () =>
      customerAccounts
        .filter((a) => a.isOverdue)
        .reduce(
          (sum, a) =>
            sum +
            a.orders.reduce(
              (orderSum, order) => orderSum + getOrderBalanceDue(order),
              0,
            ),
          0,
        ),
    [customerAccounts, getOrderBalanceDue],
  );

  const handleRecordPayment = (order: SaleOrder, account: CustomerAccount) => {
    setPaymentOrder(order);
    setPaymentCustomer(account.customer);
    // Other unpaid orders for this customer (excluding the one we clicked)
    setPaymentOtherOrders(account.orders.filter((o) => o.id !== order.id));
    setIsPaymentOpen(true);
  };

  const handleViewInvoice = (order: SaleOrder, customer: Customer | null) => {
    setInvoiceOrder(order);
    setInvoiceCustomer(customer);
    setIsInvoiceOpen(true);
  };

  const handlePaymentComplete = () => {
    toast.success('Payment recorded successfully');
  };

  const handleOpenAccountPayment = (customer: Customer) => {
    setAccountPaymentCustomer(customer);
    setAccountPaymentAmount('');
    setAccountPaymentMethod('cash');
    setIsAccountPaymentOpen(true);
  };

  const handleSubmitAccountPayment = async () => {
    if (!accountPaymentCustomer) return;
    const amount = parseFloat(accountPaymentAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid payment amount');
      return;
    }

    const payable = Math.min(amount, accountPaymentCustomer.credit_balance);
    if (payable <= 0) {
      toast.error('This account has no balance to pay');
      return;
    }

    setIsAccountPaymentSaving(true);
    const result = await makePaymentOnAccount(
      accountPaymentCustomer.id,
      payable,
      accountPaymentMethod,
    );
    setIsAccountPaymentSaving(false);

    if (result.success) {
      toast.success('Payment applied to customer account');
      setIsAccountPaymentOpen(false);
      setAccountPaymentCustomer(null);
      setAccountPaymentAmount('');
    } else {
      toast.error(result.error || 'Failed to apply payment');
    }
  };

  const handleViewStatement = (account: CustomerAccount) => {
    if (!account.customer) return;
    // Get all credit orders for this customer (not just unpaid)
    const customerOrders = orders.filter(
      (o) =>
        (o.customer_id === account.customerId ||
          o.customer_name === account.customerName),
    );
    setStatementCustomer(account.customer);
    setStatementOrders(customerOrders);
    setIsStatementOpen(true);
  };

  return (
    <PageLayout activeTab="accounts" onNavigate={onNavigate}>
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              Accounts Receivable
            </h1>
            <p className="text-muted-foreground">
              Manage outstanding credit invoices and record payments
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <Card>
              <CardContent className="p-4 flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded bg-warning/10 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5 text-warning" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">
                    Total Outstanding
                  </p>
                  <p className="text-lg font-bold text-warning tabular-nums truncate">
                    {formatCurrency(totalOutstanding)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded bg-destructive/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Overdue</p>
                  <p className="text-lg font-bold text-destructive tabular-nums truncate">
                    {formatCurrency(overdueTotal)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded bg-info/10 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-info" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">
                    Unpaid Invoices
                  </p>
                  <p className="text-xl font-bold tabular-nums">
                    {unpaidCreditOrders.length}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">
                    Accounts w/ Balance
                  </p>
                  <p className="text-xl font-bold tabular-nums">{customerAccounts.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search & Filters */}
          <div className="mb-6 flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer, invoice #, or order #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant={filterOverdue ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterOverdue(!filterOverdue)}
              className={cn(
                'gap-1.5',
                filterOverdue && 'bg-destructive hover:bg-destructive/90',
              )}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Overdue ({overdueCount})
            </Button>
          </div>

          {/* Loading */}
          {ordersLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Loading accounts...</p>
              </div>
            </div>
          )}

          {/* Accounts List */}
          {!ordersLoading && (
            <div className="space-y-4">
              {filteredAccounts.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <CircleDollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No outstanding accounts</p>
                  <p className="text-sm mt-1">
                    {searchQuery || filterOverdue
                      ? 'Try adjusting your search or filters'
                      : 'All credit invoices have been paid'}
                  </p>
                </div>
              )}

              {filteredAccounts.map((account) => {
                const isExpanded = expandedCustomer === (account.customerId || account.customerName);

                return (
                  <Card
                    key={account.customerId || account.customerName}
                    className={cn(
                      'transition-shadow',
                      account.isOverdue && 'border-l-4 border-l-destructive',
                    )}
                  >
                    <CardContent className="p-0">
                      {/* Account Header — always visible */}
                      <button
                        onClick={() =>
                          setExpandedCustomer(
                            isExpanded
                              ? null
                              : account.customerId || account.customerName,
                          )
                        }
                        className="w-full p-5 flex items-center justify-between hover:bg-muted/30 transition-colors rounded-t"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                            {account.customerName.charAt(0).toUpperCase()}
                          </div>
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-lg text-foreground">
                                {account.customerName}
                              </h3>
                              {account.isOverdue && (
                                <Badge className="text-xs bg-destructive/10 text-destructive gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  OVERDUE
                                </Badge>
                              )}
                              {account.customer?.status === 'vip' && (
                                <Badge className="text-xs bg-warning/10 text-warning">
                                  VIP
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {account.orders.length} unpaid invoice
                              {account.orders.length > 1 ? 's' : ''}
                              {account.openingOwed > 0 && (
                                <>
                                  {' '}
                                  · Opening: {formatCurrency(account.openingOwed)}
                                </>
                              )}
                              {account.oldestDue && (
                                <>
                                  {' '}
                                  · Oldest due:{' '}
                                  {format(account.oldestDue, 'MMM dd, yyyy')}
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {account.customer && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 hidden sm:flex"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewStatement(account);
                              }}
                            >
                              <ScrollText className="w-3.5 h-3.5" />
                              Statement
                            </Button>
                          )}
                          {account.customer && account.orders.length === 0 && (
                            <Button
                              size="sm"
                              className="gap-1.5 bg-success hover:bg-success/90 text-white hidden sm:flex"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenAccountPayment(account.customer!);
                              }}
                            >
                              <CircleDollarSign className="w-3.5 h-3.5" />
                              Pay
                            </Button>
                          )}
                          <div className="text-right min-w-0">
                            <p className="text-sm text-muted-foreground">
                              Balance Owed
                            </p>
                            <p
                              className={cn(
                                'text-lg font-bold tabular-nums',
                                account.isOverdue
                                  ? 'text-destructive'
                                  : 'text-warning',
                              )}
                            >
                              {formatCurrency(account.totalOwed)}
                            </p>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                          )}
                        </div>
                      </button>

                      {/* Expanded: invoice list */}
                      {isExpanded && (
                        <div className="border-t px-5 pb-5 pt-3 space-y-3">
                          {/* Mobile statement button */}
                          {account.customer && (
                            <div className="sm:hidden">
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full gap-1.5"
                                onClick={() => handleViewStatement(account)}
                              >
                                <ScrollText className="w-3.5 h-3.5" />
                                View Statement
                              </Button>
                            </div>
                          )}
                          {account.orders.length === 0 && (
                            <div className="p-4 rounded-lg border bg-muted/30 text-sm text-muted-foreground flex items-center justify-between gap-3">
                              <p>
                                No unpaid credit invoices. Current receivable balance is from
                                opening balance/imported prior dues.
                              </p>
                              {account.customer && (
                                <Button
                                  size="sm"
                                  className="gap-1.5 bg-success hover:bg-success/90 text-white shrink-0"
                                  onClick={() => handleOpenAccountPayment(account.customer!)}
                                >
                                  <CircleDollarSign className="w-3.5 h-3.5" />
                                  Pay
                                </Button>
                              )}
                            </div>
                          )}
                          {account.orders
                            .sort(
                              (a, b) =>
                                new Date(a.created_at).getTime() -
                                new Date(b.created_at).getTime(),
                            )
                            .map((order) => {
                              const balanceDue = getOrderBalanceDue(order);
                              const totalPaid = order.payments.reduce(
                                (s, p) => s + p.amount,
                                0,
                              );
                              const dueDate = order.due_date
                                ? new Date(order.due_date)
                                : null;
                              const isOverdue = dueDate
                                ? differenceInDays(new Date(), dueDate) > 0
                                : false;
                              const daysOverdue = dueDate
                                ? differenceInDays(new Date(), dueDate)
                                : 0;

                              return (
                                <div
                                  key={order.id}
                                  className={cn(
                                    'flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border',
                                    isOverdue
                                      ? 'bg-destructive/5 border-destructive/20'
                                      : 'bg-muted/30 border-border',
                                  )}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                                      <span className="font-semibold">
                                        {order.invoice_number ||
                                          order.order_number}
                                      </span>
                                      <Badge
                                        className={cn(
                                          'text-xs',
                                          order.payment_status === 'partial'
                                            ? 'bg-info/10 text-info'
                                            : 'bg-warning/10 text-warning',
                                        )}
                                      >
                                        {order.payment_status === 'partial'
                                          ? 'Partial'
                                          : 'Unpaid'}
                                      </Badge>
                                      {isOverdue && (
                                        <span className="text-xs text-destructive font-medium flex items-center gap-1">
                                          <Clock className="w-3 h-3" />
                                          {daysOverdue}d overdue
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                                      <span>
                                        {format(
                                          new Date(order.created_at),
                                          'MMM dd, yyyy',
                                        )}
                                      </span>
                                      <span className="tabular-nums">
                                        Total: {formatCurrency(order.total)}
                                      </span>
                                      {totalPaid > 0 && (
                                        <span className="text-success tabular-nums">
                                          Paid: {formatCurrency(totalPaid)}
                                        </span>
                                      )}
                                      {dueDate && !isOverdue && (
                                        <span>
                                          Due:{' '}
                                          {format(dueDate, 'MMM dd, yyyy')}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3 shrink-0">
                                    <div className="text-right mr-2">
                                      <p className="text-xs text-muted-foreground">
                                        Due
                                      </p>
                                      <p
                                        className={cn(
                                          'font-bold tabular-nums',
                                          isOverdue
                                            ? 'text-destructive'
                                            : 'text-warning',
                                        )}
                                      >
                                        {formatCurrency(balanceDue)}
                                      </p>
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handleViewInvoice(
                                          order,
                                          account.customer,
                                        )
                                      }
                                      className="gap-1.5"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                      <span className="hidden sm:inline">Invoice</span>
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        handleRecordPayment(
                                          order,
                                          account,
                                        )
                                      }
                                      className="gap-1.5 bg-success hover:bg-success/90 text-white"
                                    >
                                      <CircleDollarSign className="w-3.5 h-3.5" />
                                      Pay
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
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
              setPaymentOtherOrders([]);
            }
          }}
          order={paymentOrder}
          customer={paymentCustomer}
          otherUnpaidOrders={paymentOtherOrders}
          onRecordPayment={recordPayment}
          onPaymentComplete={handlePaymentComplete}
          companyName={companyName}
        />
      )}

      {/* Invoice Dialog */}
      {invoiceOrder && (
        <InvoiceDialog
          open={isInvoiceOpen}
          onOpenChange={(open) => {
            setIsInvoiceOpen(open);
            if (!open) {
              setInvoiceOrder(null);
              setInvoiceCustomer(null);
            }
          }}
          order={invoiceOrder}
          customer={invoiceCustomer}
          receiptData={orderToReceiptData(invoiceOrder)}
          defaultView="invoice"
        />
      )}

      {/* Statement Dialog */}
      {statementCustomer && (
        <CustomerStatement
          open={isStatementOpen}
          onOpenChange={(open) => {
            setIsStatementOpen(open);
            if (!open) {
              setStatementCustomer(null);
              setStatementOrders([]);
            }
          }}
          customer={statementCustomer}
          orders={statementOrders}
        />
      )}

      {/* Account-level payment dialog */}
      <Dialog
        open={isAccountPaymentOpen}
        onOpenChange={(open) => {
          if (isAccountPaymentSaving) return;
          setIsAccountPaymentOpen(open);
          if (!open) {
            setAccountPaymentCustomer(null);
            setAccountPaymentAmount('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pay on Account</DialogTitle>
            <DialogDescription>
              {accountPaymentCustomer
                ? `Apply payment to ${accountPaymentCustomer.first_name} ${accountPaymentCustomer.last_name}`
                : 'Apply payment to customer account'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/40 text-sm flex items-center justify-between">
              <span className="text-muted-foreground">Current Balance</span>
              <span className="font-semibold tabular-nums text-warning">
                {formatCurrency(accountPaymentCustomer?.credit_balance || 0)}
              </span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-payment-method">Method</Label>
              <Select
                value={accountPaymentMethod}
                onValueChange={(value) => setAccountPaymentMethod(value as PaymentMethod)}
              >
                <SelectTrigger id="account-payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="qr">QR / Mobile</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-payment-amount">Amount</Label>
              <Input
                id="account-payment-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={accountPaymentAmount}
                onChange={(e) => setAccountPaymentAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsAccountPaymentOpen(false)}
                disabled={isAccountPaymentSaving}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 gap-1.5 bg-success hover:bg-success/90 text-white"
                onClick={handleSubmitAccountPayment}
                disabled={isAccountPaymentSaving}
              >
                {isAccountPaymentSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CircleDollarSign className="w-4 h-4" />
                )}
                Apply Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
