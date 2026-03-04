import { useMemo, useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Customer } from '@/hooks/useCustomers';
import { SaleOrder, Payment } from '@/hooks/useOrders';
import { format } from 'date-fns';
import {
  FileText,
  CircleDollarSign,
  Printer,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fc } from '@/lib/currency';
import { supabase } from '@/lib/supabase';

// ─── Types ──────────────────────────────────────────────────────────────────

interface StatementEntry {
  id: string;
  date: Date;
  type: 'opening' | 'invoice' | 'payment';
  reference: string;
  description: string;
  debit: number; // amount owed (invoices)
  credit: number; // amount paid (payments)
  balance: number; // running balance (computed)
  // Extra context
  orderId?: string;
  paymentMethod?: string;
}

interface CustomerStatementProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer;
  orders: SaleOrder[];
  loading?: boolean;
}

interface AccountPaymentEntry {
  id: string;
  customer_id: string;
  method: string;
  amount: number;
  reference?: string;
  created_at: string;
}

type DateRange = 'all' | '30' | '60' | '90' | 'this-month' | 'this-year';

// ─── Component ──────────────────────────────────────────────────────────────

export function CustomerStatement({
  open,
  onOpenChange,
  customer,
  orders,
  loading,
}: CustomerStatementProps) {
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const printRef = useRef<HTMLDivElement>(null);
  const [accountPayments, setAccountPayments] = useState<AccountPaymentEntry[]>([]);
  const [accountPaymentsLoading, setAccountPaymentsLoading] = useState(false);

  const displayName = `${customer.first_name} ${customer.last_name}`.trim();

  useEffect(() => {
    const fetchAccountPayments = async () => {
      if (!open || !customer.id) return;
      setAccountPaymentsLoading(true);
      try {
        const { data, error } = await supabase
          .from('customer_account_payments')
          .select('id, customer_id, method, amount, reference, created_at')
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: true });
        if (error) throw error;
        setAccountPayments(
          (data || []).map((p: any) => ({
            id: p.id,
            customer_id: p.customer_id,
            method: p.method,
            amount: Number(p.amount || 0),
            reference: p.reference || undefined,
            created_at: p.created_at,
          })),
        );
      } catch (err) {
        console.error('Failed to fetch customer account payments:', err);
        setAccountPayments([]);
      } finally {
        setAccountPaymentsLoading(false);
      }
    };

    fetchAccountPayments();
  }, [open, customer.id]);

  // Build the statement entries from orders + payments
  const { entries, summary } = useMemo(() => {
    // Only include credit orders for this customer
    const creditOrders = orders.filter(
      (o) =>
        o.sale_type === 'credit' &&
        o.status !== 'voided' &&
        o.status !== 'cancelled',
    );

    const raw: Omit<StatementEntry, 'balance'>[] = [];

    // Opening balance (migration/import baseline)
    if ((customer.opening_balance || 0) > 0) {
      raw.push({
        id: `opening-${customer.id}`,
        date: new Date(customer.created_at),
        type: 'opening',
        reference: 'OPENING',
        description: 'Opening Balance',
        debit: customer.opening_balance,
        credit: 0,
      });
    }

    // Add invoice entries
    creditOrders.forEach((order) => {
      raw.push({
        id: `inv-${order.id}`,
        date: new Date(order.created_at),
        type: 'invoice',
        reference: order.invoice_number || order.order_number,
        description: `Credit Sale — ${order.items.length} item${order.items.length > 1 ? 's' : ''}`,
        debit: order.total,
        credit: 0,
        orderId: order.id,
      });

      // Add payment entries for each payment on this order
      order.payments.forEach((payment) => {
        raw.push({
          id: `pay-${payment.id}`,
          date: new Date(payment.paid_at),
          type: 'payment',
          reference: payment.reference || `PAY-${payment.id.slice(0, 8).toUpperCase()}`,
          description: `Payment (${payment.method.charAt(0).toUpperCase() + payment.method.slice(1)})`,
          debit: 0,
          credit: payment.amount,
          orderId: order.id,
          paymentMethod: payment.method,
        });
      });
    });

    // Add account-level payments (not tied to specific invoices).
    accountPayments.forEach((payment) => {
      raw.push({
        id: `acct-pay-${payment.id}`,
        date: new Date(payment.created_at),
        type: 'payment',
        reference:
          payment.reference ||
          `APAY-${payment.id.slice(0, 8).toUpperCase()}`,
        description: `Account Payment (${payment.method.charAt(0).toUpperCase() + payment.method.slice(1)})`,
        debit: 0,
        credit: payment.amount,
        paymentMethod: payment.method,
      });
    });

    // Sort by date ascending
    raw.sort((a, b) => a.date.getTime() - b.date.getTime());

    const now = new Date();
    // Build period start for filtering while preserving accurate running balance.
    const periodStart =
      dateRange === '30'
        ? new Date(now.getTime() - 30 * 86400000)
        : dateRange === '60'
          ? new Date(now.getTime() - 60 * 86400000)
          : dateRange === '90'
            ? new Date(now.getTime() - 90 * 86400000)
            : dateRange === 'this-month'
              ? new Date(now.getFullYear(), now.getMonth(), 1)
              : dateRange === 'this-year'
                ? new Date(now.getFullYear(), 0, 1)
                : null;

    const openingCarriedForward = periodStart
      ? raw
          .filter((entry) => entry.date.getTime() < periodStart.getTime())
          .reduce((sum, entry) => sum + entry.debit - entry.credit, 0)
      : 0;

    const filtered = raw.filter(
      (entry) =>
        !periodStart || entry.date.getTime() >= periodStart.getTime(),
    );

    // Compute running balance (ascending order for correctness)
    let runningBalance = openingCarriedForward;
    const withBalance: StatementEntry[] = [];

    if (periodStart && openingCarriedForward !== 0) {
      withBalance.push({
        id: `bf-${dateRange}`,
        date: periodStart,
        type: 'opening',
        reference: 'B/F',
        description: 'Balance Brought Forward',
        debit: openingCarriedForward > 0 ? openingCarriedForward : 0,
        credit: openingCarriedForward < 0 ? Math.abs(openingCarriedForward) : 0,
        balance: openingCarriedForward,
      });
    }

    filtered.forEach((entry) => {
      runningBalance += entry.debit - entry.credit;
      withBalance.push({ ...entry, balance: runningBalance });
    });

    // Reverse to show newest first
    withBalance.reverse();

    // Compute totals
    const totalDebit = withBalance.reduce((s, e) => s + e.debit, 0);
    const totalCredit = withBalance.reduce((s, e) => s + e.credit, 0);
    const closingBalance = runningBalance;

    return {
      entries: withBalance,
      summary: {
        totalInvoices: filtered.filter((e) => e.type === 'invoice').length,
        totalPayments: filtered.filter((e) => e.type === 'payment').length,
        totalDebit,
        totalCredit,
        closingBalance,
      },
    };
  }, [
    orders,
    accountPayments,
    dateRange,
    customer.id,
    customer.created_at,
    customer.opening_balance,
  ]);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Statement — ${displayName}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #1a1a1a; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            h2 { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
            .subtitle { color: #666; font-size: 13px; margin-bottom: 20px; }
            .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; padding: 12px; background: #f8f8f8; border-radius: 8px; }
            .summary-item { text-align: center; }
            .summary-label { font-size: 11px; color: #666; text-transform: uppercase; }
            .summary-value { font-size: 18px; font-weight: 700; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            th { text-align: left; padding: 8px 12px; border-bottom: 2px solid #ddd; font-size: 11px; text-transform: uppercase; color: #666; }
            td { padding: 8px 12px; border-bottom: 1px solid #eee; }
            .text-right { text-align: right; }
            .bold { font-weight: 700; }
            .debit { color: #dc2626; }
            .credit { color: #16a34a; }
            .footer { margin-top: 24px; padding-top: 12px; border-top: 2px solid #ddd; font-size: 12px; color: #666; text-align: center; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>Statement of Account</h1>
          <p class="subtitle">${displayName} · Generated ${format(new Date(), 'MMMM dd, yyyy')}</p>
          
          <div class="summary">
            <div class="summary-item">
              <div class="summary-label">Total Invoiced</div>
              <div class="summary-value">${fc(summary.totalDebit)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Paid</div>
              <div class="summary-value credit">${fc(summary.totalCredit)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Balance</div>
              <div class="summary-value ${summary.closingBalance > 0 ? 'debit' : 'credit'}">${fc(Math.abs(summary.closingBalance))}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Transactions</div>
              <div class="summary-value">${entries.length}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Description</th>
                <th class="text-right">Debit</th>
                <th class="text-right">Credit</th>
                <th class="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              ${entries
                .map(
                  (e) => `
                <tr>
                  <td>${format(e.date, 'MMM dd, yyyy')}</td>
                  <td class="bold">${e.reference}</td>
                  <td>${e.description}</td>
                  <td class="text-right ${e.debit > 0 ? 'debit bold' : ''}">${e.debit > 0 ? fc(e.debit) : '—'}</td>
                  <td class="text-right ${e.credit > 0 ? 'credit bold' : ''}">${e.credit > 0 ? fc(e.credit) : '—'}</td>
                  <td class="text-right bold">${fc(e.balance)}</td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>

          <div class="footer">
            This is a computer-generated statement. Printed on ${format(new Date(), 'MMMM dd, yyyy HH:mm')}.
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <DialogTitle className="text-xl">Statement of Account</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {displayName} · Generated {format(new Date(), 'MMMM dd, yyyy')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={dateRange}
                onValueChange={(v) => setDateRange(v as DateRange)}
              >
                <SelectTrigger className="w-[150px] h-9">
                  <Calendar className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="30">Last 30 Days</SelectItem>
                  <SelectItem value="60">Last 60 Days</SelectItem>
                  <SelectItem value="90">Last 90 Days</SelectItem>
                  <SelectItem value="this-year">This Year</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
                <Printer className="w-3.5 h-3.5" />
                Print
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Summary Cards */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3 text-center min-w-0">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  Total Invoiced
                </p>
                <p className="text-base font-bold mt-0.5 tabular-nums truncate">
                  {fc(summary.totalDebit)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center min-w-0">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  Total Paid
                </p>
                <p className="text-base font-bold text-success mt-0.5 tabular-nums truncate">
                  {fc(summary.totalCredit)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center min-w-0">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  Closing Balance
                </p>
                <p
                  className={cn(
                    'text-base font-bold mt-0.5 tabular-nums truncate',
                    summary.closingBalance > 0
                      ? 'text-warning'
                      : summary.closingBalance < 0
                        ? 'text-success'
                        : '',
                  )}
                >
                  {fc(Math.abs(summary.closingBalance))}
                  {summary.closingBalance < 0 && ' CR'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  Transactions
                </p>
                <p className="text-lg font-bold mt-0.5 tabular-nums">{entries.length}</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Timeline / Ledger */}
        <div className="flex-1 overflow-y-auto px-6 py-4" ref={printRef}>
          {loading || accountPaymentsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No transactions found</p>
              <p className="text-sm mt-1">
                {dateRange !== 'all'
                  ? 'Try selecting a wider date range'
                  : 'This customer has no credit transactions yet'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table — hidden on mobile */}
              <div className="hidden md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-border">
                      <th className="text-left py-2 px-3 text-xs uppercase text-muted-foreground font-medium">
                        Date
                      </th>
                      <th className="text-left py-2 px-3 text-xs uppercase text-muted-foreground font-medium">
                        Reference
                      </th>
                      <th className="text-left py-2 px-3 text-xs uppercase text-muted-foreground font-medium">
                        Description
                      </th>
                      <th className="text-right py-2 px-3 text-xs uppercase text-muted-foreground font-medium">
                        Debit
                      </th>
                      <th className="text-right py-2 px-3 text-xs uppercase text-muted-foreground font-medium">
                        Credit
                      </th>
                      <th className="text-right py-2 px-3 text-xs uppercase text-muted-foreground font-medium">
                        Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                          {format(entry.date, 'MMM dd, yyyy')}
                        </td>
                        <td className="py-2.5 px-3 font-semibold whitespace-nowrap">
                          {entry.reference}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            {entry.type === 'payment' ? (
                              <ArrowDownRight className="w-3.5 h-3.5 text-success shrink-0" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5 text-destructive shrink-0" />
                            )}
                            {entry.description}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                          {entry.debit > 0 ? (
                            <span className="text-destructive font-semibold">
                              {fc(entry.debit)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                          {entry.credit > 0 ? (
                            <span className="text-success font-semibold">
                              {fc(entry.credit)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-bold whitespace-nowrap">
                          {fc(entry.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/30">
                      <td
                        colSpan={3}
                        className="py-2.5 px-3 font-semibold text-right"
                      >
                        Totals
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-destructive whitespace-nowrap">
                        {fc(summary.totalDebit)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-success whitespace-nowrap">
                        {fc(summary.totalCredit)}
                      </td>
                      <td
                        className={cn(
                          'py-2.5 px-3 text-right tabular-nums font-bold whitespace-nowrap',
                          summary.closingBalance > 0
                            ? 'text-warning'
                            : 'text-success',
                        )}
                      >
                        {fc(Math.abs(summary.closingBalance))}
                        {summary.closingBalance < 0 && ' CR'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile timeline — cards */}
              <div className="md:hidden space-y-3">
                {entries.map((entry, index) => (
                  <div key={entry.id} className="relative flex gap-3">
                    {/* Timeline line */}
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                          entry.type === 'payment'
                            ? 'bg-success/10'
                            : 'bg-destructive/10',
                        )}
                      >
                        {entry.type === 'payment' ? (
                          <CircleDollarSign className="w-3.5 h-3.5 text-success" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-destructive" />
                        )}
                      </div>
                      {index < entries.length - 1 && (
                        <div className="w-px flex-1 bg-border mt-1" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm">
                          {entry.reference}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs',
                            entry.type === 'payment'
                              ? 'border-success/30 text-success'
                              : 'border-destructive/30 text-destructive',
                          )}
                        >
                          {entry.type === 'opening'
                            ? 'Opening'
                            : entry.type === 'invoice'
                              ? 'Invoice'
                              : 'Payment'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1.5">
                        {format(entry.date, 'MMM dd, yyyy · h:mm a')}
                      </p>
                      <p className="text-sm text-muted-foreground mb-2">
                        {entry.description}
                      </p>
                      <div className="flex items-center justify-between text-sm gap-3">
                        <span className="tabular-nums">
                          {entry.type !== 'payment' ? (
                            <span className="text-destructive font-semibold">
                              +{fc(entry.debit > 0 ? entry.debit : 0)}
                            </span>
                          ) : (
                            <span className="text-success font-semibold">
                              −{fc(entry.credit > 0 ? entry.credit : 0)}
                            </span>
                          )}
                        </span>
                        <span className="font-bold text-foreground tabular-nums">
                          Bal: {fc(entry.balance)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Closing balance card */}
                <Card className="border-2">
                  <CardContent className="p-3 flex items-center justify-between gap-4">
                    <span className="text-sm font-semibold shrink-0">Closing Balance</span>
                    <span
                      className={cn(
                        'text-lg font-bold tabular-nums text-right',
                        summary.closingBalance > 0
                          ? 'text-warning'
                          : 'text-success',
                      )}
                    >
                      {fc(Math.abs(summary.closingBalance))}
                      {summary.closingBalance < 0 && ' CR'}
                    </span>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
