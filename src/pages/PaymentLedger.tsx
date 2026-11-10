import { useEffect, useMemo, useState } from 'react';
import { PageLayout } from '@/components/pos/PageLayout';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  Loader2,
  Undo2,
  Pencil,
  RefreshCw,
  Receipt,
  MoreHorizontal,
  AlertCircle,
  Check,
  Banknote,
  Smartphone,
  Landmark,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Money } from '@/components/ui/Money';
import { StatusChip } from '@/components/ui/StatusChip';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/formatDate';
import { formatKES } from '@/lib/formatKES';
import { getPaymentMethodLabel } from '@/lib/paymentMethods';
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
const OUTLINED_BTN =
  'focus-ring inline-flex h-10 min-h-10 items-center justify-center gap-2 rounded-[var(--radius)] border border-hairline bg-surface px-3 text-sm font-semibold text-ink active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [@media(pointer:coarse)]:h-12 [@media(pointer:coarse)]:min-h-12';
const ROW_MORE_BTN =
  'focus-ring inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] border border-hairline bg-surface text-ink [@media(pointer:coarse)]:h-12 [@media(pointer:coarse)]:w-12';
const METHOD_CHIP =
  'focus-ring inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[var(--radius)] border border-hairline bg-surface px-3 text-sm font-semibold text-ink active:scale-[0.98] [@media(pointer:coarse)]:h-12 [@media(pointer:coarse)]:min-h-12';
function getPaymentMethodIcon(method: string): LucideIcon {
  switch (method) {
    case 'cash':
      return Banknote;
    case 'card':
      return Landmark;
    case 'mpesa':
    case 'qr':
      return Smartphone;
    default:
      return Banknote;
  }
}
function formatPaymentDateTime(iso: string): string {
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${formatDate(date)}, ${time}`;
}
function paymentMoreActionsAriaLabel(row: LedgerPaymentRow): string {
  return `More actions for the payment of ${formatKES(row.amount)} on ${formatDate(new Date(row.paid_at))}`;
}
function rowMatchesSearch(row: LedgerPaymentRow, q: string): boolean {
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
}
function RuledPlaceholderRows({ count = 6 }: { count?: number }) {
  return (
    <div className="divide-y divide-hairline border-y border-hairline">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex min-h-[var(--tap-min)] items-center gap-3 py-2">
          <div className="h-3 max-w-[40%] flex-1 rounded-sm bg-hairline/80" aria-hidden />
          <div className="ml-auto h-3 w-16 rounded-sm bg-hairline/60" aria-hidden />
        </div>
      ))}
    </div>
  );
}
export default function PaymentLedger({ onNavigate }: PaymentLedgerProps) {
  const { rows, loading, error, refetch } = usePaymentLedger();
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

  useEffect(() => {
    document.title = 'Payments';
  }, []);

  const searchNorm = searchQuery.trim().toLowerCase();
  const rowsForKindCounts = useMemo(() => {
    return rows.filter((row) => {
      if (methodFilter !== 'all' && row.method !== methodFilter) return false;
      return rowMatchesSearch(row, searchNorm);
    });
  }, [rows, searchNorm, methodFilter]);
  const methodsInView = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      if (kindFilter !== 'all' && row.kind !== kindFilter) continue;
      if (!rowMatchesSearch(row, searchNorm)) continue;
      set.add(row.method);
    }
    return Array.from(set).sort((a, b) =>
      getPaymentMethodLabel(a).localeCompare(getPaymentMethodLabel(b)),
    );
  }, [rows, kindFilter, searchNorm]);
  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (kindFilter !== 'all' && row.kind !== kindFilter) return false;
      if (methodFilter !== 'all' && row.method !== methodFilter) return false;
      return rowMatchesSearch(row, searchNorm);
    });
  }, [rows, searchNorm, kindFilter, methodFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize],
  );
  const totalAmount = useMemo(
    () => filtered.reduce((sum, r) => sum + r.amount, 0),
    [filtered],
  );
  const methodTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filtered) {
      map.set(r.method, (map.get(r.method) || 0) + r.amount);
    }
    return [...map.entries()].sort((a, b) =>
      getPaymentMethodLabel(a[0]).localeCompare(getPaymentMethodLabel(b[0])),
    );
  }, [filtered]);
  const filtersActive =
    Boolean(searchQuery.trim()) || kindFilter !== 'all' || methodFilter !== 'all';
  const clearFilters = () => {
    setSearchQuery('');
    setKindFilter('all');
    setMethodFilter('all');
    setCurrentPage(1);
  };
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
  const visibleOnPage = paginated.length;
  const renderRowOverflowMenu = (row: LedgerPaymentRow) => {
    const showEdit = row.kind === 'order' && canModifyOrderRow(row);
    const showReverse = canReverseRow(row);
    if (!showEdit && !showReverse) {
      return <span className="inline-block h-10 w-10 shrink-0" aria-hidden />;
    }
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={ROW_MORE_BTN}
            aria-label={paymentMoreActionsAriaLabel(row)}
            disabled={busyId === row.id}
          >
            {busyId === row.id ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <MoreHorizontal className="h-5 w-5" aria-hidden />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="border-hairline">
          {showEdit ? (
            <DropdownMenuItem className="cursor-pointer" onSelect={() => openEdit(row)}>
              <Pencil className="mr-2 h-4 w-4" aria-hidden />
              Edit payment
            </DropdownMenuItem>
          ) : null}
          {showReverse ? (
            <DropdownMenuItem
              className="cursor-pointer text-ink focus:text-ink"
              onSelect={() => setReverseTarget({ row })}
            >
              <Undo2 className="mr-2 h-4 w-4 text-fail" aria-hidden />
              Reverse payment
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };
  const phoneLine1 = (row: LedgerPaymentRow) => {
    if (row.kind === 'order') {
      const num = row.order_number ? `#${row.order_number}` : 'Order';
      const name = row.customer_name?.trim();
      return name ? `${num} · ${name}` : num;
    }
    return row.customer_name?.trim() || 'Customer';
  };
  const phoneLine2 = (row: LedgerPaymentRow) => {
    const kindLabel = row.kind === 'order' ? 'Order payment' : 'Account payment';
    return `${kindLabel} · ${getPaymentMethodLabel(row.method)} · ${formatDate(new Date(row.paid_at))}`;
  };
  return (
  <PageLayout activeTab="payments" onNavigate={onNavigate} headerTitle="Payments">
    <div className="mx-auto flex w-full min-w-0 max-w-[1280px] flex-col gap-6 md:gap-4">
      <header className="flex min-w-0 flex-col gap-3 border-b border-hairline pb-6 sm:flex-row sm:items-start sm:justify-between md:pb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink md:text-3xl">Payments</h1>
          <p className="mt-1 text-sm text-ink-2">
            Money received against orders and customer accounts.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">
          <button
            type="button"
            className={OUTLINED_BTN}
            onClick={() => void refetch()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden />
            )}
            Refresh
          </button>
          <button
            type="button"
            className={OUTLINED_BTN}
            onClick={() => onNavigate('order-history')}
          >
            <Receipt className="h-4 w-4" aria-hidden />
            Sales history
          </button>
        </div>
      </header>
      <section aria-labelledby="payments-summary-heading" className="border-b border-hairline pb-6 md:pb-4">
        <h2 id="payments-summary-heading" className="sr-only">
          Summary
        </h2>
        {loading && rows.length === 0 ? (
          <div className="flex flex-col gap-2">
            <div className="h-10 w-48 rounded-sm bg-hairline/80" aria-hidden />
            <div className="h-4 w-32 rounded-sm bg-hairline/60" aria-hidden />
          </div>
        ) : (
          <div className="min-w-0 space-y-4">
            <div>
              <p className="text-sm font-semibold text-ink-2">Received</p>
              <div className="mt-1">
                <Money value={totalAmount} variant="display" size="xl" />
              </div>
              <p className="mt-1 text-sm text-ink-2">
                {filtered.length === 1 ? '1 payment' : `${filtered.length} payments`}
              </p>
            </div>
            {methodTotals.length > 0 ? (
              <p className="flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-1 text-sm text-ink">
                {methodTotals.map(([method, amount], i) => (
                  <span key={method} className="inline-flex flex-wrap items-baseline gap-1">
                    {i > 0 ? <span className="text-ink-2" aria-hidden>·</span> : null}
                    <span className="text-ink-2">{getPaymentMethodLabel(method)}</span>
                    <Money value={amount} className="inline text-sm font-semibold" />
                  </span>
                ))}
              </p>
            ) : null}
          </div>
        )}
      </section>
      {error && !loading ? (
        <div
          className="flex flex-wrap items-center gap-3 border-b border-hairline pb-4 text-sm text-ink"
          role="alert"
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0 text-fail" aria-hidden />
            {error}
          </span>
          <button type="button" className={OUTLINED_BTN} onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      ) : null}
      <section aria-label="Payments filters" className="space-y-3 border-b border-hairline pb-4">
        <div className="relative w-full min-w-0">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Search order #, customer or reference"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 min-h-10 border-hairline pl-10 [@media(pointer:coarse)]:h-12 [@media(pointer:coarse)]:min-h-12"
            aria-label="Search payments"
          />
        </div>
        <div
          className="scrollbar-hide -mx-1 flex min-w-0 gap-1 overflow-x-auto px-1 pb-0.5"
          role="tablist"
          aria-label="Payment type"
        >
          {(
            [
              { id: 'all' as const, label: 'All', count: rowsForKindCounts.length },
              {
                id: 'order' as const,
                label: 'Order payments',
                count: rowsForKindCounts.filter((r) => r.kind === 'order').length,
              },
              {
                id: 'account' as const,
                label: 'Account payments',
                count: rowsForKindCounts.filter((r) => r.kind === 'account').length,
              },
            ] as const
          ).map((tab) => {
            const selected = kindFilter === tab.id;
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
                onClick={() => {
                  setKindFilter(tab.id);
                  setCurrentPage(1);
                }}
              >
                {tab.label}
                <span className="ml-1 font-mono text-xs font-normal tabular-nums">
                  ({tab.count})
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="scrollbar-hide flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5"
            role="group"
            aria-label="Payment method"
          >
            <button
              type="button"
              className={cn(
                METHOD_CHIP,
                methodFilter === 'all' &&
                  'border-primary bg-[hsl(var(--accent-soft))] text-ink',
              )}
              aria-pressed={methodFilter === 'all'}
              onClick={() => {
                setMethodFilter('all');
                setCurrentPage(1);
              }}
            >
              {methodFilter === 'all' ? (
                <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              ) : null}
              All methods
            </button>
            {methodsInView.map((method) => {
              const selected = methodFilter === method;
              return (
                <button
                  key={method}
                  type="button"
                  className={cn(
                    METHOD_CHIP,
                    selected && 'border-primary bg-[hsl(var(--accent-soft))] text-ink',
                  )}
                  aria-pressed={selected}
                  onClick={() => {
                    setMethodFilter(method);
                    setCurrentPage(1);
                  }}
                >
                  {selected ? (
                    <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  ) : null}
                  {getPaymentMethodLabel(method)}
                </button>
              );
            })}
          </div>
          {filtersActive ? (
            <button
              type="button"
              className="focus-ring shrink-0 text-sm font-semibold text-primary underline-offset-2 hover:underline [@media(pointer:coarse)]:min-h-12 [@media(pointer:coarse)]:px-2"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </section>
      {loading && rows.length === 0 ? (
        <RuledPlaceholderRows count={8} />
      ) : (
        <div className="min-w-0 space-y-4">
          {filtered.length === 0 ? (
            <div className="flex flex-wrap items-center gap-3 border-b border-hairline py-4 text-sm text-ink">
              <span>No payments match these filters.</span>
              {filtersActive ? (
                <button
                  type="button"
                  className="focus-ring text-sm font-semibold text-primary underline-offset-2 hover:underline"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="hidden min-w-0 md:block">
                <table className="w-full table-fixed border-collapse">
                  <colgroup>
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '56px' }} />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-hairline text-left text-xs font-semibold text-ink-2">
                      <th className="pb-2 pr-2 font-semibold">Date</th>
                      <th className="pb-2 pr-2 font-semibold">Method</th>
                      <th className="pb-2 pr-2 font-semibold">Linked to</th>
                      <th className="pb-2 pr-2 font-semibold">Reference</th>
                      <th className="pb-2 pr-2 text-right font-semibold">Amount</th>
                      <th className="pb-2 font-semibold">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((row) => {
                      const MethodIcon = getPaymentMethodIcon(row.method);
                      const isReversed = Boolean(row.reversed_at);
                      return (
                        <tr
                          key={`${row.kind}-${row.id}`}
                          className="border-b border-hairline [@media(hover:hover)]:hover:bg-[hsl(var(--accent-soft))]/40"
                        >
                          <td className="py-3 pr-2 align-top text-sm whitespace-nowrap text-ink-2">
                            {formatPaymentDateTime(row.paid_at)}
                          </td>
                          <td className="py-3 pr-2 align-top">
                            <span className="inline-flex items-center gap-1.5 text-sm text-ink">
                              <MethodIcon className="h-4 w-4 shrink-0 text-ink-2" aria-hidden />
                              {getPaymentMethodLabel(row.method)}
                            </span>
                          </td>
                          <td className="max-w-0 py-3 pr-2 align-top">
                            {row.kind === 'order' ? (
                              <>
                                <span className="font-mono text-sm font-semibold text-ink">
                                  #{row.order_number}
                                </span>
                                {row.customer_name ? (
                                  <span className="mt-0.5 block truncate text-sm text-ink">
                                    {row.customer_name}
                                  </span>
                                ) : null}
                                <span className="mt-0.5 block text-xs text-ink-2">Order payment</span>
                              </>
                            ) : (
                              <>
                                <span className="block truncate text-sm font-semibold text-ink">
                                  {row.customer_name || 'Customer'}
                                </span>
                                <span className="mt-0.5 block text-xs text-ink-2">Account payment</span>
                              </>
                            )}
                            {isReversed ? (
                              <span className="mt-1 inline-block">
                                <StatusChip status="cancelled" label="Reversed" />
                              </span>
                            ) : null}
                          </td>
                          <td className="py-3 pr-2 align-top font-mono text-[13px] text-ink-2">
                            <span className="block truncate">{row.reference || '–'}</span>
                          </td>
                          <td className="py-3 pr-2 text-right align-top">
                            <Money
                              value={row.amount}
                              align="right"
                              strike={isReversed}
                              className="text-sm font-semibold"
                            />
                          </td>
                          <td className="py-3 align-top">{renderRowOverflowMenu(row)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-hairline border-y border-hairline md:hidden">
                {paginated.map((row) => {
                  const isReversed = Boolean(row.reversed_at);
                  return (
                    <div
                      key={`${row.kind}-${row.id}`}
                      className="flex min-h-[5.5rem] flex-col justify-center gap-1 py-3"
                    >
                      <div className="flex min-w-0 items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-semibold text-ink">
                          {phoneLine1(row)}
                        </span>
                        <Money
                          value={row.amount}
                          strike={isReversed}
                          className="shrink-0 text-sm font-semibold"
                        />
                      </div>
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-xs text-ink-2">{phoneLine2(row)}</p>
                        {renderRowOverflowMenu(row)}
                      </div>
                      {isReversed ? (
                        <StatusChip status="cancelled" label="Reversed" />
                      ) : null}
                      {row.reference ? (
                        <p className="font-mono text-xs text-ink-2">Ref {row.reference}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-col gap-3 border-t border-hairline pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-ink-2">
                  Showing {visibleOnPage} of {filtered.length}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {totalPages > 1 ? (
                    <>
                      <button
                        type="button"
                        className={OUTLINED_BTN}
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </button>
                      <span className="px-1 text-sm text-ink-2">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        type="button"
                        className={OUTLINED_BTN}
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Next
                      </button>
                    </>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-ink-2 whitespace-nowrap">Per page</span>
                    <Select
                      value={String(pageSize)}
                      onValueChange={(val) => {
                        setPageSize(Number(val));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="h-10 min-h-10 w-[70px] border-hairline [@media(pointer:coarse)]:h-12 [@media(pointer:coarse)]:min-h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[10, 25, 50, 100].map((size) => (
                          <SelectItem key={size} value={String(size)}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {!canReverse ? (
        <p className="text-xs text-ink-2">
          Only admins and managers can reverse payments. You can still review the ledger here.
        </p>
      ) : null}
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
        <AlertDialogContent className="border-hairline">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-ink">Reverse payment?</AlertDialogTitle>
            <AlertDialogDescription className="text-ink-2">
              {reverseTarget ? (
                reverseTarget.row.kind === 'account' ? (
                  <>
                    Reverse <Money value={reverseTarget.row.amount} className="inline" /> (
                    {getPaymentMethodLabel(reverseTarget.row.method)},{' '}
                    {formatDate(new Date(reverseTarget.row.paid_at))})? This adds{' '}
                    <Money value={reverseTarget.row.amount} className="inline" /> back to{' '}
                    {reverseTarget.row.customer_name || 'this customer'}&apos;s balance.
                  </>
                ) : (
                  <>
                    Reverse <Money value={reverseTarget.row.amount} className="inline" /> (
                    {getPaymentMethodLabel(reverseTarget.row.method)},{' '}
                    {formatDate(new Date(reverseTarget.row.paid_at))})? The order payment status
                    and any customer credit balance will be recalculated.
                  </>
                )
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReversing} className="min-h-12 border-hairline">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-12 gap-2 border border-hairline bg-surface text-ink hover:bg-surface"
              disabled={isReversing}
              onClick={(e) => {
                e.preventDefault();
                void confirmReverse();
              }}
            >
              {isReversing ? (
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
    </div>
  </PageLayout>
  );
}
