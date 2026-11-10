import { useMemo, useState } from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { PaginationControls } from '@/components/ui/pagination-controls';
import {
  Search,
  Loader2,
  Undo2,
  Pencil,
  RefreshCw,
  CircleDollarSign,
  Receipt,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Money } from '@/components/ui/Money';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useOrders, Payment, SaleOrder } from '@/hooks/useOrders';
import { useCustomers } from '@/hooks/useCustomers';
import {
  usePaymentLedger,
  LedgerPaymentRow,
  LedgerPaymentKind,
} from '@/hooks/usePaymentLedger';
import { EditPaymentDialog } from '@/components/payment/EditPaymentDialog';

interface PaymentLedgerProps {
  onNavigate: (tab: string) => void;
}

type KindFilter = 'all' | LedgerPaymentKind;

type ReverseTarget = {
  row: LedgerPaymentRow;
};

export default function PaymentLedger({ onNavigate }: PaymentLedgerProps) {
  const { rows, loading, refetch } = usePaymentLedger();
  const { deletePayment, updatePayment, orders } = useOrders();
  const { reverseCustomerAccountPayment } = useCustomers();
  const { isAdmin, isManager } = useAuth();
  const canReverse = isAdmin || isManager;

  const [searchQuery, setSearchQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [reverseTarget, setReverseTarget] = useState<ReverseTarget | null>(null);
  const [isReversing, setIsReversing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editOrder, setEditOrder] = useState<SaleOrder | null>(null);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      if (kindFilter !== 'all' && row.kind !== kindFilter) return false;
      if (methodFilter !== 'all' && row.method !== methodFilter) return false;
      if (!q) return true;
      const haystack = [
        row.order_number,
        row.customer_name,
        row.reference,
        row.description,
        row.method,
        row.amount.toString(),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, searchQuery, kindFilter, methodFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize],
  );

  const totalAmount = useMemo(
    () => filtered.reduce((sum, r) => sum + r.amount, 0),
    [filtered],
  );

  const canModifyOrderRow = (row: LedgerPaymentRow) =>
    row.kind === 'order' &&
    !row.reversed_at &&
    row.order_payment_status !== 'voided' &&
    row.order_payment_status !== 'refunded' &&
    row.order_status !== 'voided' &&
    row.order_status !== 'cancelled';

  const canReverseRow = (row: LedgerPaymentRow) =>
    canReverse && !row.reversed_at && (row.kind === 'account' || canModifyOrderRow(row));

  const openEdit = (row: LedgerPaymentRow) => {
    if (row.kind !== 'order' || !row.order_id) return;
    const order = orders.find((o) => o.id === row.order_id);
    const payment = order?.payments.find((p) => p.id === row.id);
    if (!payment || !order) {
      toast.error('Open Transactions and refresh if this payment is missing locally');
      return;
    }
    setEditOrder(order);
    setEditingPayment(payment);
  };

  const confirmReverse = async () => {
    if (!reverseTarget) return;
    const { row } = reverseTarget;
    setIsReversing(true);
    setBusyId(row.id);
    try {
      if (row.kind === 'order') {
        const ok = await deletePayment(row.id);
        if (ok) {
          toast.success('Payment reversed');
          await refetch();
        } else {
          toast.error('Failed to reverse payment');
        }
      } else {
        const result = await reverseCustomerAccountPayment(row.id);
        if (result.success) {
          toast.success('Account payment reversed');
          await refetch();
        } else {
          toast.error(result.error || 'Failed to reverse payment');
        }
      }
      setReverseTarget(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reverse payment');
    } finally {
      setIsReversing(false);
      setBusyId(null);
    }
  };

  return (
    <PageLayout activeTab="payments" onNavigate={onNavigate}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">Payments</h1>
          <p className="text-muted-foreground text-sm">
            All order and account payments in one place — reverse incorrect entries when needed.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => void refetch()} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </Button>
          <Button className="gap-2" variant="outline" onClick={() => onNavigate('order-history')}>
            <Receipt className="w-4 h-4" />
            Transactions
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded bg-success/10 flex items-center justify-center">
              <CircleDollarSign className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Payments in view</p>
              <p className="text-xl font-bold tabular-nums">{filtered.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
              <CircleDollarSign className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total amount</p>
              <Money value={totalAmount} variant="display" size="xl" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-4">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search order #, customer, reference…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Type</Label>
            <Select
              value={kindFilter}
              onValueChange={(v) => {
                setKindFilter(v as KindFilter);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="order">Order payment</SelectItem>
                <SelectItem value="account">Account payment</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Method</Label>
            <Select
              value={methodFilter}
              onValueChange={(v) => {
                setMethodFilter(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All methods</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="qr">QR / Mobile</SelectItem>
                <SelectItem value="mpesa">M-Pesa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading && rows.length === 0 ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-16">No payments match your filters.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Linked to</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right w-[140px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((row) => (
                      <TableRow key={`${row.kind}-${row.id}`}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {format(new Date(row.paid_at), 'MMM dd, yyyy · HH:mm')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {row.kind === 'order' ? 'Order' : 'Account'}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize text-sm">{row.method}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">
                          {row.kind === 'order' ? (
                            <span className="font-mono">#{row.order_number}</span>
                          ) : (
                            row.customer_name || 'Customer'
                          )}
                          {row.kind === 'order' && row.customer_name && (
                            <span className="block text-xs text-muted-foreground truncate">
                              {row.customer_name}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground max-w-[120px] truncate">
                          {row.reference || '—'}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          <Money value={row.amount} align="right" />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {row.kind === 'order' && canModifyOrderRow(row) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Edit payment"
                                onClick={() => openEdit(row)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {canReverseRow(row) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={cn(
                                    'h-8 w-8 text-destructive hover:text-destructive',
                                  )}
                                  title="Reverse payment"
                                  disabled={busyId === row.id}
                                  onClick={() => setReverseTarget({ row })}
                                >
                                  {busyId === row.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Undo2 className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                              )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="p-4 border-t">
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filtered.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {!canReverse && (
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Only admins and managers can reverse payments. You can still review the ledger here.
        </p>
      )}

      {editingPayment && editOrder && (
        <EditPaymentDialog
          open={!!editingPayment}
          onOpenChange={(open) => {
            if (!open) {
              setEditingPayment(null);
              setEditOrder(null);
            }
          }}
          payment={editingPayment}
          order={editOrder}
          onUpdate={updatePayment}
          onUpdateComplete={() => {
            toast.success('Payment updated');
            void refetch();
          }}
        />
      )}

      <AlertDialog
        open={!!reverseTarget}
        onOpenChange={(open) => {
          if (!open && !isReversing) setReverseTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reverse this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              {reverseTarget ? (
                <>
                  Remove the{' '}
                  <span className="font-medium capitalize">{reverseTarget.row.method}</span>{' '}
                  payment of <Money value={reverseTarget.row.amount} />
                  {reverseTarget.row.kind === 'order'
                    ? ` on order #${reverseTarget.row.order_number}. Balances will be recalculated.`
                    : ` for ${reverseTarget.row.customer_name || 'this customer'}. Account balance will increase.`}
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReversing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isReversing}
              onClick={(e) => {
                e.preventDefault();
                void confirmReverse();
              }}
            >
              {isReversing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Reversing…
                </>
              ) : (
                'Reverse payment'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}
