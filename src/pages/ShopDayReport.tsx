import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Loader2,
  Download,
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  CalendarDays,
} from 'lucide-react';
import { PageLayout } from '@/components/pos/PageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import { useShopDayReport, type ShopDayReportData } from '@/hooks/useShopDayReport';
import { useShopDaySettlement } from '@/hooks/useShopDaySettlement';
import { ShopDayReportPrint } from '@/components/reports/ShopDayReportPrint';
import { expenseCategoryLabel, expensePaymentMethodLabel } from '@/hooks/useOperatingExpenses';
import { generateInvoicePdf } from '@/lib/generateInvoicePdf';
import { fc } from '@/lib/currency';
import { SHOP_CASH_FLOAT, formatShopCashFloat } from '@/lib/shopFloat';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ShopDayReportProps {
  onNavigate: (tab: string) => void;
}

function toDateInputValue(d: Date = new Date()): string {
  return format(d, 'yyyy-MM-dd');
}

function exportReportCsv(data: ShopDayReportData) {
  const rows: string[][] = [
    ['Shop Day Close', data.storeName, data.businessDateLabel],
    [],
    ['Sales'],
    ['Cash', data.salesBreakdown.cash.toFixed(2)],
    ['M-Pesa', data.salesBreakdown.mpesa.toFixed(2)],
    ['Bank', data.salesBreakdown.bank.toFixed(2)],
    ['Credit outstanding', data.totalOutstandingCredit.toFixed(2)],
    ['Collected excl. credit', data.salesBreakdown.totalCollected.toFixed(2)],
    ['Discounts', data.discountOut.toFixed(2)],
    ['Refunds', data.refunds.toFixed(2)],
    [],
    ['Expenses'],
    ['Description', 'Category', 'Paid via', 'Amount'],
    ...data.expenses.map((e) => [
      e.description,
      expenseCategoryLabel(e.category),
      expensePaymentMethodLabel(e.payment_method),
      e.amount.toFixed(2),
    ]),
    [
      'Total',
      '',
      '',
      data.expenseBreakdown.total.toFixed(2),
    ],
    [],
    ['Expected'],
    ['Till float (fixed)', String(SHOP_CASH_FLOAT)],
    ['Expected cash remittance', data.expected.cash.toFixed(2)],
    ['Expected M-Pesa', data.expected.mpesa.toFixed(2)],
    ['Expected bank', data.expected.bank.toFixed(2)],
    [],
    ['Stock movement'],
    ['Product', 'Opening', 'In', 'Sold', 'Adj out', 'Closing'],
    ...data.stockMovements.map((p) => [
      p.productName,
      p.opening == null ? '' : String(p.opening),
      String(p.stockIn),
      String(p.sold),
      String(p.adjustmentsOut),
      p.closing == null ? '' : String(p.closing),
    ]),
  ];

  if (data.settlement) {
    rows.push(
      [],
      ['Settlement'],
      ['Opening float (fixed)', data.settlement.opening_float.toFixed(2)],
      ['Closing float (fixed)', data.settlement.closing_float.toFixed(2)],
      ['Cash handed over', data.settlement.cash_counted.toFixed(2)],
      ['M-Pesa confirmed', data.settlement.mpesa_confirmed.toFixed(2)],
      ['Bank confirmed', data.settlement.bank_confirmed.toFixed(2)],
      ['Cash variance', data.settlement.cash_variance.toFixed(2)],
      ['M-Pesa variance', data.settlement.mpesa_variance.toFixed(2)],
      ['Bank variance', data.settlement.bank_variance.toFixed(2)],
    );
  }

  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `shop-day-${data.storeName.replace(/\s+/g, '-')}-${data.businessDate}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function VarianceBadge({ value, label }: { value: number; label: string }) {
  const balanced = Math.abs(value) < 0.005;
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium',
        balanced && 'bg-muted text-muted-foreground',
        !balanced && value > 0 && 'bg-success/10 text-success',
        !balanced && value < 0 && 'bg-destructive/10 text-destructive',
      )}
    >
      {value < 0 ? (
        <AlertCircle className="w-4 h-4 shrink-0" />
      ) : (
        <CheckCircle2 className="w-4 h-4 shrink-0" />
      )}
      <span>
        {label}: {balanced ? 'Balanced' : value > 0 ? 'Surplus' : 'Shortage'}{' '}
        <span className="tabular-nums">
          {value >= 0 ? '+' : ''}
          {fc(value)}
        </span>
      </span>
    </div>
  );
}

export default function ShopDayReport({ onNavigate }: ShopDayReportProps) {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'manager';
  const { fetchReport, loading, error } = useShopDayReport();
  const { saveSettlement, saving } = useShopDaySettlement();

  const [businessDate, setBusinessDate] = useState(toDateInputValue());
  const [report, setReport] = useState<ShopDayReportData | null>(null);

  const [cashCounted, setCashCounted] = useState('');
  const [mpesaConfirmed, setMpesaConfirmed] = useState('');
  const [bankConfirmed, setBankConfirmed] = useState('');
  const [notes, setNotes] = useState('');

  const loadReport = useCallback(
    async (date: string) => {
      const data = await fetchReport(date, {
        openingFloat: SHOP_CASH_FLOAT,
        closingFloat: SHOP_CASH_FLOAT,
      });
      setReport(data);
      if (data) {
        const s = data.settlement;
        setCashCounted(s ? String(s.cash_counted) : '');
        setMpesaConfirmed(
          s ? String(s.mpesa_confirmed) : String(data.salesBreakdown.mpesa),
        );
        setBankConfirmed(
          s ? String(s.bank_confirmed) : String(data.salesBreakdown.bank),
        );
        setNotes(s?.notes || '');
      }
    },
    [fetchReport],
  );

  useEffect(() => {
    if (!canManage) return;
    void loadReport(businessDate);
  }, [canManage, businessDate, loadReport]);

  const parsedCash = parseFloat(cashCounted) || 0;
  const parsedMpesa = parseFloat(mpesaConfirmed) || 0;
  const parsedBank = parseFloat(bankConfirmed) || 0;

  const liveExpected = useMemo(() => {
    if (!report) return { cash: 0, mpesa: 0, bank: 0 };
    // Float is fixed at SHOP_CASH_FLOAT open and close, so it nets to zero in expected cash.
    return report.expected;
  }, [report]);

  const expectedDrawerTotal = useMemo(() => {
    if (!report) return SHOP_CASH_FLOAT;
    return SHOP_CASH_FLOAT + liveExpected.cash;
  }, [report, liveExpected.cash]);

  const liveCashVariance = parsedCash - liveExpected.cash;
  const liveMpesaVariance = parsedMpesa - liveExpected.mpesa;
  const liveBankVariance = parsedBank - liveExpected.bank;
  const isFinalized = report?.settlement?.is_finalized ?? false;

  const handleSave = async (finalize: boolean) => {
    if (!report) return;
    if (parsedCash < 0) {
      toast.error('Enter a valid cash remittance amount');
      return;
    }
    try {
      await saveSettlement({
        business_date: businessDate,
        opening_float: SHOP_CASH_FLOAT,
        closing_float: SHOP_CASH_FLOAT,
        expected_cash: liveExpected.cash,
        expected_mpesa: liveExpected.mpesa,
        expected_bank: liveExpected.bank,
        cash_counted: parsedCash,
        mpesa_confirmed: parsedMpesa,
        bank_confirmed: parsedBank,
        notes,
        finalize,
      });
      toast.success(finalize ? 'Shop day finalized' : 'Settlement draft saved');
      await loadReport(businessDate);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settlement');
    }
  };

  const handlePdf = async () => {
    const pdf = await generateInvoicePdf('#shop-day-report');
    if (pdf) {
      pdf.save(`shop-day-${report?.storeName || 'store'}-${businessDate}.pdf`);
    } else {
      toast.error('Could not generate PDF');
    }
  };

  const displaySettlement = {
    opening_float: SHOP_CASH_FLOAT,
    closing_float: SHOP_CASH_FLOAT,
    expected_cash: liveExpected.cash,
    expected_mpesa: liveExpected.mpesa,
    expected_bank: liveExpected.bank,
    cash_counted: parsedCash,
    mpesa_confirmed: parsedMpesa,
    bank_confirmed: parsedBank,
    cash_variance: liveCashVariance,
    mpesa_variance: liveMpesaVariance,
    bank_variance: liveBankVariance,
    notes: notes || null,
  };

  if (!canManage) {
    return (
      <PageLayout activeTab="shop-day" onNavigate={onNavigate}>
        <div className="max-w-lg mx-auto text-center py-20">
          <CalendarDays className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h1 className="text-xl font-bold text-foreground mb-2">Shop Day Close</h1>
          <p className="text-sm text-muted-foreground">
            End-of-day till reconciliation is available to admins and managers only.
          </p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout activeTab="shop-day" onNavigate={onNavigate}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
              Shop Day Close
            </h1>
            <p className="text-muted-foreground text-sm">
              Daily stock movement, cash &amp; M-Pesa reconciliation, and expenses for this
              branch.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadReport(businessDate)}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span className="ml-2 hidden sm:inline">Refresh</span>
            </Button>
            {report && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportReportCsv(report)}
                  disabled={loading}
                >
                  <Download className="w-4 h-4" />
                  <span className="ml-2 hidden sm:inline">CSV</span>
                </Button>
                <Button size="sm" onClick={() => void handlePdf()} disabled={loading}>
                  <FileText className="w-4 h-4" />
                  <span className="ml-2 hidden sm:inline">PDF</span>
                </Button>
              </>
            )}
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Business date</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="shop-day-date">Date</Label>
              <Input
                id="shop-day-date"
                type="date"
                value={businessDate}
                onChange={(e) => setBusinessDate(e.target.value)}
                className="w-44"
              />
            </div>
            {isFinalized && (
              <Badge className="bg-success/15 text-success border-success/30 gap-1 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Finalized
              </Badge>
            )}
          </CardContent>
        </Card>

        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {error && !loading && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {report && !loading && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Cash sales</p>
                  <p className="text-xl font-bold tabular-nums">{fc(report.salesBreakdown.cash)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">M-Pesa sales</p>
                  <p className="text-xl font-bold tabular-nums">{fc(report.salesBreakdown.mpesa)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Expenses</p>
                  <p className="text-xl font-bold tabular-nums">
                    {fc(report.expenseBreakdown.total)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">SKUs moved</p>
                  <p className="text-xl font-bold tabular-nums">{report.stockMovements.length}</p>
                </CardContent>
              </Card>
            </div>

            {/* Settlement form */}
            <div className="print:hidden rounded-lg border border-border bg-muted/20 p-4 space-y-4">
              <div>
                <p className="text-sm font-semibold">Till settlement</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Standard float is KES {formatShopCashFloat()}. Start the day with that amount in
                  the register and leave KES {formatShopCashFloat()} at close. Hand over everything
                  above the float.
                </p>
              </div>

              <div className="rounded-md border border-border bg-background p-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Till float (fixed)</p>
                  <p className="text-lg font-bold tabular-nums">{fc(SHOP_CASH_FLOAT)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Drawer should hold (before remittance)</p>
                  <p className="text-lg font-bold tabular-nums">{fc(expectedDrawerTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cash to hand over</p>
                  <p className="text-lg font-bold tabular-nums">{fc(liveExpected.cash)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    = drawer − {formatShopCashFloat()} float left in till
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-md border border-border bg-background p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Expected cash remittance</p>
                  <p className="text-lg font-bold tabular-nums">{fc(liveExpected.cash)}</p>
                  <Label htmlFor="cash-counted" className="text-xs">
                    Cash handed over *
                  </Label>
                  <Input
                    id="cash-counted"
                    type="number"
                    min="0"
                    step="0.01"
                    value={cashCounted}
                    onChange={(e) => setCashCounted(e.target.value)}
                    disabled={isFinalized || saving}
                    placeholder="0.00"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Count the drawer, leave {formatShopCashFloat()} in the till, enter the rest here.
                  </p>
                </div>
                <div className="rounded-md border border-border bg-background p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Expected M-Pesa</p>
                  <p className="text-lg font-bold tabular-nums">{fc(liveExpected.mpesa)}</p>
                  <Label htmlFor="mpesa-confirmed" className="text-xs">
                    M-Pesa till statement
                  </Label>
                  <Input
                    id="mpesa-confirmed"
                    type="number"
                    min="0"
                    step="0.01"
                    value={mpesaConfirmed}
                    onChange={(e) => setMpesaConfirmed(e.target.value)}
                    disabled={isFinalized || saving}
                  />
                </div>
                <div className="rounded-md border border-border bg-background p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Expected bank</p>
                  <p className="text-lg font-bold tabular-nums">{fc(liveExpected.bank)}</p>
                  <Label htmlFor="bank-confirmed" className="text-xs">
                    Bank confirmed
                  </Label>
                  <Input
                    id="bank-confirmed"
                    type="number"
                    min="0"
                    step="0.01"
                    value={bankConfirmed}
                    onChange={(e) => setBankConfirmed(e.target.value)}
                    disabled={isFinalized || saving}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <VarianceBadge value={liveCashVariance} label="Cash" />
                <VarianceBadge value={liveMpesaVariance} label="M-Pesa" />
                <VarianceBadge value={liveBankVariance} label="Bank" />
              </div>

              <div>
                <Label htmlFor="settlement-notes">Notes</Label>
                <Textarea
                  id="settlement-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isFinalized || saving}
                  placeholder="e.g. Cash shortage explained, till statement ref..."
                  className="mt-1"
                />
              </div>

              {!isFinalized && (
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={saving || cashCounted === ''}
                    onClick={() => void handleSave(false)}
                  >
                    Save draft
                  </Button>
                  <Button
                    size="sm"
                    disabled={saving || cashCounted === ''}
                    onClick={() => void handleSave(true)}
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    )}
                    Finalize day
                  </Button>
                </div>
              )}

              {isFinalized && report.settlement?.finalized_by_name && (
                <p className="text-xs text-muted-foreground text-right">
                  Finalized by {report.settlement.finalized_by_name}
                  {report.settlement.finalized_at &&
                    ` · ${format(new Date(report.settlement.finalized_at), 'dd MMM yyyy HH:mm')}`}
                </p>
              )}
            </div>

            {report.expenses.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Expenses today</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {report.expenses.map((e) => (
                    <div
                      key={e.id}
                      className="flex justify-between gap-3 text-sm border-b border-border last:border-0 pb-2 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{e.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {expenseCategoryLabel(e.category)} ·{' '}
                          {expensePaymentMethodLabel(e.payment_method)}
                        </p>
                      </div>
                      <span className="font-semibold tabular-nums shrink-0">{fc(e.amount)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {report.stockMovements.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Stock movement</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b border-border">
                        <th className="pb-2 pr-2 font-medium">Product</th>
                        <th className="pb-2 px-2 font-medium text-right">Open</th>
                        <th className="pb-2 px-2 font-medium text-right">In</th>
                        <th className="pb-2 px-2 font-medium text-right">Sold</th>
                        <th className="pb-2 px-2 font-medium text-right">Adj</th>
                        <th className="pb-2 pl-2 font-medium text-right">Close</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.stockMovements.map((line) => (
                        <tr key={line.productId} className="border-b border-border/60 last:border-0">
                          <td className="py-2 pr-2">{line.productName}</td>
                          <td className="py-2 px-2 text-right tabular-nums">
                            {line.opening == null ? '—' : line.opening}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums">{line.stockIn}</td>
                          <td className="py-2 px-2 text-right tabular-nums">{line.sold}</td>
                          <td className="py-2 px-2 text-right tabular-nums">
                            {line.adjustmentsOut}
                          </td>
                          <td className="py-2 pl-2 text-right tabular-nums">
                            {line.closing == null ? '—' : line.closing}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            <div className="rounded-lg border border-[#D4AF37]/40 overflow-hidden shadow-sm">
              <ShopDayReportPrint report={report} displaySettlement={displaySettlement} />
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}
