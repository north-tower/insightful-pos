import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Customer } from '@/hooks/useCustomers';
import { useOrders, SaleOrder } from '@/hooks/useOrders';
import { format } from 'date-fns';
import {
  Edit,
  Star,
  Award,
  Mail,
  Phone,
  MapPin,
  ShoppingBag,
  CreditCard,
  Loader2,
  CircleDollarSign,
  ScrollText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMemo, useState } from 'react';
import { PaymentDialog } from '@/components/payment/PaymentDialog';
import { CustomerStatement } from '@/components/customer/CustomerStatement';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currency';
import { useCompanySettings } from '@/context/BusinessSettingsContext';

interface CustomerDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer;
  onEdit: () => void;
}

const statusColors: Record<string, string> = {
  active: 'bg-success/10 text-success',
  vip: 'bg-warning/10 text-warning',
  inactive: 'bg-muted text-muted-foreground',
  suspended: 'bg-destructive/10 text-destructive',
};

const orderStatusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  preparing: 'bg-primary/10 text-primary',
  ready: 'bg-success/10 text-success',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
  voided: 'bg-muted text-muted-foreground',
};

export function CustomerDetailDialog({
  open,
  onOpenChange,
  customer,
  onEdit,
}: CustomerDetailDialogProps) {
  const { orders, loading: ordersLoading, recordPayment, getOrderBalanceDue } = useOrders();
  const { companyName } = useCompanySettings();

  const [paymentOrder, setPaymentOrder] = useState<SaleOrder | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isStatementOpen, setIsStatementOpen] = useState(false);

  // Filter orders for this customer
  const customerOrders = useMemo(() => {
    const fullName = `${customer.first_name} ${customer.last_name}`.trim();
    return orders.filter(
      (order) =>
        order.customer_id === customer.id ||
        order.customer_name === fullName,
    );
  }, [orders, customer]);

  const unpaidOrders = useMemo(
    () =>
      customerOrders.filter(
        (o) =>
          o.sale_type === 'credit' &&
          (o.payment_status === 'unpaid' || o.payment_status === 'partial') &&
          o.status !== 'voided' &&
          o.status !== 'cancelled',
      ),
    [customerOrders],
  );

  const displayName = `${customer.first_name} ${customer.last_name}`.trim();

  const handleRecordPayment = (order: SaleOrder) => {
    setPaymentOrder(order);
    setIsPaymentOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                {displayName}
                {customer.status === 'vip' && (
                  <Star className="w-5 h-5 text-warning fill-warning" />
                )}
              </DialogTitle>
              <DialogDescription>
                Customer since{' '}
                {format(new Date(customer.created_at), 'MMM dd, yyyy')}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {customer.credit_balance > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setIsStatementOpen(true)}
                  className="gap-1.5"
                >
                  <ScrollText className="w-4 h-4" />
                  Statement
                </Button>
              )}
              <Button variant="outline" onClick={onEdit}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="orders">Order History</TabsTrigger>
            <TabsTrigger value="notes">Notes & Tags</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Contact Information */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-4">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  {customer.email && (
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{customer.email}</span>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center gap-2 min-w-0">
                      <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{customer.phone}</span>
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex items-start gap-2 col-span-2">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div className="text-sm">
                        <p>{customer.address}</p>
                        {customer.city && (
                          <p>
                            {customer.city}
                            {customer.postal_code &&
                              `, ${customer.postal_code}`}
                            {customer.country && ` ${customer.country}`}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center min-w-0">
                  <ShoppingBag className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-2xl font-bold tabular-nums truncate">{customer.total_orders.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center min-w-0">
                  <Award className="w-6 h-6 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold text-primary tabular-nums truncate">
                    {customer.loyalty_points.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Loyalty Points
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center min-w-0">
                  <p className="text-2xl font-bold tabular-nums truncate">
                    {formatCurrency(customer.total_spent)}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Spent</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center min-w-0">
                  <CreditCard
                    className={cn(
                      'w-6 h-6 mx-auto mb-2',
                      customer.credit_balance > 0
                        ? 'text-warning'
                        : 'text-muted-foreground',
                    )}
                  />
                  <p
                    className={cn(
                      'text-2xl font-bold tabular-nums truncate',
                      customer.credit_balance > 0 ? 'text-warning' : '',
                    )}
                  >
                    {formatCurrency(customer.credit_balance)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Credit Balance
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Credit limit */}
            {customer.credit_limit > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">Credit Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div className="min-w-0">
                      <p className="text-muted-foreground">Credit Limit</p>
                      <p className="font-medium tabular-nums truncate">
                        {formatCurrency(customer.credit_limit)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-muted-foreground">Outstanding</p>
                      <p
                        className={cn(
                          'font-medium tabular-nums truncate',
                          customer.credit_balance > 0 && 'text-warning',
                        )}
                      >
                        {formatCurrency(customer.credit_balance)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-muted-foreground">Available</p>
                      <p className="font-medium text-success tabular-nums truncate">
                        {formatCurrency(Math.max(
                          customer.credit_limit - customer.credit_balance,
                          0,
                        ))}
                      </p>
                    </div>
                  </div>
                  {/* Usage bar */}
                  <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        customer.credit_balance / customer.credit_limit > 0.8
                          ? 'bg-destructive'
                          : customer.credit_balance / customer.credit_limit >
                              0.5
                            ? 'bg-warning'
                            : 'bg-success',
                      )}
                      style={{
                        width: `${Math.min((customer.credit_balance / customer.credit_limit) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 text-right">
                    {((customer.credit_balance / customer.credit_limit) * 100).toFixed(0)}%
                    utilised
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Status and Tags */}
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Status</p>
                <Badge
                  className={cn(statusColors[customer.status] || '')}
                >
                  {customer.status.toUpperCase()}
                </Badge>
              </div>
              {customer.tags && customer.tags.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Tags</p>
                  <div className="flex gap-2 flex-wrap">
                    {customer.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            {customer.notes && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">Notes</h3>
                  <p className="text-sm text-muted-foreground">
                    {customer.notes}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Order History Tab */}
          <TabsContent value="orders" className="space-y-4">
            {/* Unpaid invoices banner */}
            {unpaidOrders.length > 0 && (
              <div className="p-3 bg-warning/5 border border-warning/20 rounded-lg">
                <div className="flex items-center gap-2 text-warning font-medium text-sm flex-wrap">
                  <CreditCard className="w-4 h-4 shrink-0" />
                  <span>{unpaidOrders.length} unpaid invoice{unpaidOrders.length > 1 ? 's' : ''}</span>
                  <span className="tabular-nums">— Total: {formatCurrency(unpaidOrders
                    .reduce((sum, o) => sum + getOrderBalanceDue(o), 0))}</span>
                </div>
              </div>
            )}

            {ordersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : customerOrders.length > 0 ? (
              <div className="space-y-3">
                {customerOrders.map((order) => {
                  const isUnpaid =
                    order.sale_type === 'credit' &&
                    (order.payment_status === 'unpaid' || order.payment_status === 'partial') &&
                    order.status !== 'voided' &&
                    order.status !== 'cancelled';
                  const balanceDue = getOrderBalanceDue(order);

                  return (
                    <Card
                      key={order.id}
                      className={cn(
                        isUnpaid && 'border-l-4 border-l-warning',
                      )}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h4 className="font-semibold">
                                Order #{order.order_number}
                              </h4>
                              {order.invoice_number && (
                                <span className="text-xs text-muted-foreground font-mono truncate">
                                  {order.invoice_number}
                                </span>
                              )}
                              <Badge
                                className={cn(
                                  'text-xs',
                                  orderStatusColors[order.status] || '',
                                )}
                              >
                                {order.status}
                              </Badge>
                              {order.sale_type === 'credit' && (
                                <Badge className="text-xs bg-warning/10 text-warning gap-1">
                                  <CreditCard className="w-3 h-3" />
                                  Credit
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs whitespace-nowrap">
                                {format(
                                  new Date(order.created_at),
                                  'MMM dd, yyyy HH:mm',
                                )}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                              <div className="min-w-0">
                                <p className="text-muted-foreground">Items</p>
                                <p className="font-medium tabular-nums">
                                  {order.items.length}
                                </p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-muted-foreground">Total</p>
                                <p className="font-medium tabular-nums truncate">
                                  {formatCurrency(order.total)}
                                </p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-muted-foreground">Payment</p>
                                <p className="font-medium capitalize truncate">
                                  {order.payment_status}
                                </p>
                              </div>
                              {isUnpaid && (
                                <div className="min-w-0">
                                  <p className="text-muted-foreground">Balance</p>
                                  <p className="font-bold text-warning tabular-nums truncate">
                                    {formatCurrency(balanceDue)}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                          {isUnpaid && (
                            <Button
                              size="sm"
                              onClick={() => handleRecordPayment(order)}
                              className="gap-1.5 bg-success hover:bg-success/90 text-white shrink-0"
                            >
                              <CircleDollarSign className="w-4 h-4" />
                              Pay
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingBag className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>No orders found for this customer</p>
              </div>
            )}
          </TabsContent>

          {/* Notes & Tags Tab */}
          <TabsContent value="notes" className="space-y-4">
            {/* Tags */}
            {customer.tags && customer.tags.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {customer.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {customer.notes ? (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3">Notes</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {customer.notes}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>No notes or tags recorded for this customer</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Payment Dialog */}
      {paymentOrder && (
        <PaymentDialog
          open={isPaymentOpen}
          onOpenChange={(open) => {
            setIsPaymentOpen(open);
            if (!open) setPaymentOrder(null);
          }}
          order={paymentOrder}
          customer={customer}
          otherUnpaidOrders={unpaidOrders.filter((o) => o.id !== paymentOrder.id)}
          onRecordPayment={recordPayment}
          onPaymentComplete={() => {
            toast.success('Payment recorded successfully');
          }}
          companyName={companyName}
        />
      )}

      {/* Statement Dialog */}
      <CustomerStatement
        open={isStatementOpen}
        onOpenChange={setIsStatementOpen}
        customer={customer}
        orders={customerOrders}
        loading={ordersLoading}
      />
    </Dialog>
  );
}
