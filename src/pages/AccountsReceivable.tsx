import { useState, useMemo } from 'react';
import { Sidebar } from '@/components/pos/Sidebar';
import { Header } from '@/components/pos/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, differenceInDays } from 'date-fns';
import { useOrders, SaleOrder } from '@/hooks/useOrders';
import { useCustomers, Customer } from '@/hooks/useCustomers';
import { PaymentDialog } from '@/components/payment/PaymentDialog';
import { InvoiceDialog } from '@/components/receipt/InvoiceDialog';
import { ReceiptData } from '@/data/receiptData';
import { toast } from 'sonner';

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
    totalOutstandingCredit,
    recordPayment,
    getOrderBalanceDue,
  } = useOrders();
  const { customers, getCustomerById, totalOutstanding } = useCustomers();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [filterOverdue, setFilterOverdue] = useState(false);

  // Payment dialog state
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<SaleOrder | null>(null);
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);

  // Invoice dialog state
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [invoiceOrder, setInvoiceOrder] = useState<SaleOrder | null>(null);
  const [invoiceCustomer, setInvoiceCustomer] = useState<Customer | null>(null);

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
          totalOwed: balanceDue,
          oldestDue: dueDate,
          isOverdue,
        });
      }
    });

    // Sort: overdue first, then by total owed descending
    return Array.from(accountMap.values()).sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return b.totalOwed - a.totalOwed;
    });
  }, [unpaidCreditOrders, getCustomerById, getOrderBalanceDue]);

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
        .reduce((sum, a) => sum + a.totalOwed, 0),
    [customerAccounts],
  );

  const handleRecordPayment = (order: SaleOrder, customer: Customer | null) => {
    setPaymentOrder(order);
    setPaymentCustomer(customer);
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

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar activeTab="accounts" onTabChange={onNavigate} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto p-6">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Accounts Receivable
            </h1>
            <p className="text-muted-foreground">
              Manage outstanding credit invoices and record payments
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded bg-warning/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Outstanding
                  </p>
                  <p className="text-xl font-bold text-warning">
                    ${totalOutstandingCredit.toFixed(2)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Overdue</p>
                  <p className="text-xl font-bold text-destructive">
                    ${overdueTotal.toFixed(2)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded bg-info/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Unpaid Invoices
                  </p>
                  <p className="text-xl font-bold">
                    {unpaidCreditOrders.length}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Accounts w/ Balance
                  </p>
                  <p className="text-xl font-bold">{customerAccounts.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search & Filters */}
          <div className="mb-6 flex gap-3 items-center">
            <div className="relative flex-1 max-w-md">
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
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
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

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">
                              Balance Owed
                            </p>
                            <p
                              className={cn(
                                'text-xl font-bold',
                                account.isOverdue
                                  ? 'text-destructive'
                                  : 'text-warning',
                              )}
                            >
                              ${account.totalOwed.toFixed(2)}
                            </p>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </button>

                      {/* Expanded: invoice list */}
                      {isExpanded && (
                        <div className="border-t px-5 pb-5 pt-3 space-y-3">
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
                                    'flex items-center justify-between p-4 rounded-lg border',
                                    isOverdue
                                      ? 'bg-destructive/5 border-destructive/20'
                                      : 'bg-muted/30 border-border',
                                  )}
                                >
                                  <div className="flex-1">
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
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                      <span>
                                        {format(
                                          new Date(order.created_at),
                                          'MMM dd, yyyy',
                                        )}
                                      </span>
                                      <span>
                                        Total: ${order.total.toFixed(2)}
                                      </span>
                                      {totalPaid > 0 && (
                                        <span className="text-success">
                                          Paid: ${totalPaid.toFixed(2)}
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

                                  <div className="flex items-center gap-3 ml-4">
                                    <div className="text-right mr-2">
                                      <p className="text-xs text-muted-foreground">
                                        Due
                                      </p>
                                      <p
                                        className={cn(
                                          'font-bold',
                                          isOverdue
                                            ? 'text-destructive'
                                            : 'text-warning',
                                        )}
                                      >
                                        ${balanceDue.toFixed(2)}
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
                                      Invoice
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        handleRecordPayment(
                                          order,
                                          account.customer,
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
        </div>
      </div>

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
          onPaymentComplete={handlePaymentComplete}
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
    </div>
  );
}
