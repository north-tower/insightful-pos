import { useEffect, useMemo, useState } from 'react';
import {
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';
import {
  TrendingUp,
  TrendingDown,
  Loader2,
  Download,
  RefreshCw,
  Receipt,
  Package,
  Percent,
} from 'lucide-react';
import { PageLayout } from '@/components/pos/PageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useProfitReport } from '@/hooks/useProfitReport';
import { useAuth } from '@/context/AuthContext';
import { fc } from '@/lib/currency';
import { cn } from '@/lib/utils';

interface ProfitLossReportProps {
  onNavigate: (tab: string) => void;
}

type DatePreset = 'today' | 'week' | 'month' | 'last_month' | 'custom';

function presetRange(preset: DatePreset): { start: Date; end: Date } {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'week':
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case 'last_month': {
      const prev = subMonths(now, 1);
      return { start: startOfMonth(prev), end: endOfMonth(prev) };
    }
    case 'month':
    default:
      return { start: startOfMonth(now), end: endOfDay(now) };
  }
}

function toDateInputValue(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function rangeToIso(startDate: string, endDate: string): { start: string; end: string } {
  return {
    start: new Date(`${startDate}T00:00:00`).toISOString(),
    end: new Date(`${endDate}T23:59:59.999`).toISOString(),
  };
}

function exportSummaryCsv(
  summary: ReturnType<typeof useProfitReport>['summary'],
  startDate: string,
  endDate: string,
) {
  const rows = [
    ['Profit & Loss (Gross)', `${startDate} to ${endDate}`],
    ['Gross sales', summary.grossSales.toFixed(2)],
    ['Discounts', summary.discounts.toFixed(2)],
    ['Refunds', summary.refunds.toFixed(2)],
    ['Net revenue', summary.netRevenue.toFixed(2)],
    ['Cost of goods sold', summary.cogs.toFixed(2)],
    ['Gross profit', summary.grossProfit.toFixed(2)],
    ['Gross margin %', summary.grossMarginPct.toFixed(2)],
    ['Orders', String(summary.orderCount)],
    ['Refunded orders', String(summary.refundedOrderCount)],
  ];
  const csv = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `profit-report-${startDate}-${endDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ProfitLossReport({ onNavigate }: ProfitLossReportProps) {
  const { user } = useAuth();
  const canView = user?.role === 'admin' || user?.role === 'manager';
  const { summary, loading, error, fetchSummary } = useProfitReport();

  const initial = presetRange('month');
  const [preset, setPreset] = useState<DatePreset>('month');
  const [startDate, setStartDate] = useState(toDateInputValue(initial.start));
  const [endDate, setEndDate] = useState(toDateInputValue(initial.end));

  const periodLabel = useMemo(
    () => `${format(new Date(`${startDate}T12:00:00`), 'dd MMM yyyy')} – ${format(new Date(`${endDate}T12:00:00`), 'dd MMM yyyy')}`,
    [startDate, endDate],
  );

  useEffect(() => {
    if (!canView) return;
    const { start, end } = rangeToIso(startDate, endDate);
    void fetchSummary(start, end);
  }, [canView, startDate, endDate, fetchSummary]);

  const applyPreset = (p: DatePreset) => {
    setPreset(p);
    if (p === 'custom') return;
    const { start, end } = presetRange(p);
    setStartDate(toDateInputValue(start));
    setEndDate(toDateInputValue(end));
  };

  if (!canView) {
    return (
      <PageLayout activeTab="profit-loss" onNavigate={onNavigate}>
        <div className="max-w-lg mx-auto text-center py-20">
          <TrendingUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h1 className="text-xl font-bold text-foreground mb-2">Profit & Loss</h1>
          <p className="text-sm text-muted-foreground">
            This report is available to admins and managers only.
          </p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout activeTab="profit-loss" onNavigate={onNavigate}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
              Profit & Loss
            </h1>
            <p className="text-muted-foreground text-sm">
              Gross profit from sales (revenue minus product cost). {periodLabel}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const { start, end } = rangeToIso(startDate, endDate);
                void fetchSummary(start, end);
              }}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span className="ml-2 hidden sm:inline">Refresh</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportSummaryCsv(summary, startDate, endDate)}
              disabled={loading}
            >
              <Download className="w-4 h-4" />
              <span className="ml-2 hidden sm:inline">Export CSV</span>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Date range</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['today', 'Today'],
                  ['week', 'Last 7 days'],
                  ['month', 'This month'],
                  ['last_month', 'Last month'],
                  ['custom', 'Custom'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => applyPreset(id)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                    preset === id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="pl-start">From</Label>
                <Input
                  id="pl-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setPreset('custom');
                    setStartDate(e.target.value);
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pl-end">To</Label>
                <Input
                  id="pl-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setPreset('custom');
                    setEndDate(e.target.value);
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Net revenue</p>
                      <p className="text-2xl font-bold tabular-nums">{fc(summary.netRevenue)}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {summary.orderCount} orders
                      </p>
                    </div>
                    <Receipt className="w-8 h-8 text-primary opacity-40" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Cost of goods</p>
                      <p className="text-2xl font-bold tabular-nums">{fc(summary.cogs)}</p>
                    </div>
                    <Package className="w-8 h-8 text-warning opacity-40" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Gross profit</p>
                      <p
                        className={cn(
                          'text-2xl font-bold tabular-nums',
                          summary.grossProfit >= 0 ? 'text-success' : 'text-destructive',
                        )}
                      >
                        {fc(summary.grossProfit)}
                      </p>
                    </div>
                    {summary.grossProfit >= 0 ? (
                      <TrendingUp className="w-8 h-8 text-success opacity-40" />
                    ) : (
                      <TrendingDown className="w-8 h-8 text-destructive opacity-40" />
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Gross margin</p>
                      <p className="text-2xl font-bold tabular-nums">
                        {summary.grossMarginPct.toFixed(1)}%
                      </p>
                    </div>
                    <Percent className="w-8 h-8 text-info opacity-40" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Statement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between gap-4 tabular-nums">
                  <span className="text-muted-foreground">Gross sales</span>
                  <span className="font-medium">{fc(summary.grossSales)}</span>
                </div>
                {summary.discounts > 0 && (
                  <div className="flex justify-between gap-4 tabular-nums">
                    <span className="text-muted-foreground">Discounts (on orders)</span>
                    <span className="font-medium">{fc(summary.discounts)}</span>
                  </div>
                )}
                {summary.refunds > 0 && (
                  <div className="flex justify-between gap-4 tabular-nums text-destructive">
                    <span>Refunds ({summary.refundedOrderCount} orders)</span>
                    <span className="font-medium">− {fc(summary.refunds)}</span>
                  </div>
                )}
                <div className="border-t border-border pt-3 flex justify-between gap-4 tabular-nums font-semibold">
                  <span>Net revenue</span>
                  <span>{fc(summary.netRevenue)}</span>
                </div>
                <div className="flex justify-between gap-4 tabular-nums">
                  <span className="text-muted-foreground">Cost of goods sold</span>
                  <span className="font-medium">− {fc(summary.cogs)}</span>
                </div>
                <div className="border-t border-border pt-3 flex justify-between gap-4 tabular-nums text-base font-bold">
                  <span>Gross profit</span>
                  <span className={summary.grossProfit >= 0 ? 'text-success' : 'text-destructive'}>
                    {fc(summary.grossProfit)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground">
              Revenue is counted on order date (accrual). Credit invoices are included when
              created. COGS uses product cost captured at sale time; older orders without cost
              use the current product cost where available.
            </p>
          </>
        )}
      </div>
    </PageLayout>
  );
}
