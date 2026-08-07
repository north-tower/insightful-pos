import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
  differenceInDays,
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
  Wallet,
  Plus,
  Trash2,
  PiggyBank,
} from 'lucide-react';
import { PageLayout } from '@/components/pos/PageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProfitReport, fetchProfitSummary, type ProfitSummary } from '@/hooks/useProfitReport';
import {
  ALL_EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
  ROUTE_EXPENSE_CATEGORIES,
  expenseCategoryLabel,
  expensePaymentMethodLabel,
  isRouteExpenseCategory,
  useOperatingExpenses,
  type ExpensePaymentMethod,
} from '@/hooks/useOperatingExpenses';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { fc } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useBusinessMode } from '@/context/BusinessModeContext';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from 'recharts';

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

function priorPeriodRange(startDate: string, endDate: string): { start: string; end: string } {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const days = Math.max(differenceInDays(end, start) + 1, 1);
  const priorEnd = subDays(start, 1);
  const priorStart = subDays(priorEnd, days - 1);
  return {
    start: toDateInputValue(priorStart),
    end: toDateInputValue(priorEnd),
  };
}

function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return current === 0 ? 0 : null;
  return ((current - prior) / Math.abs(prior)) * 100;
}

function ComparisonNote({
  current,
  prior,
  label = 'vs prior period',
}: {
  current: number;
  prior: number;
  label?: string;
}) {
  const change = pctChange(current, prior);
  if (change === null) return null;
  const positive = change >= 0;
  return (
    <p
      className={cn(
        'text-[11px] mt-1 flex items-center gap-1',
        positive ? 'text-success' : 'text-destructive',
      )}
    >
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {positive ? '+' : ''}
      {change.toFixed(1)}% {label}
    </p>
  );
}

const comparisonChartConfig = {
  current: { label: 'Current', color: 'hsl(var(--primary))' },
  previous: { label: 'Previous', color: 'hsl(var(--muted-foreground))' },
};

function exportSummaryCsv(
  summary: ReturnType<typeof useProfitReport>['summary'],
  startDate: string,
  endDate: string,
) {
  const rows = [
    ['Profit & Loss', `${startDate} to ${endDate}`],
    ['Gross sales', summary.grossSales.toFixed(2)],
    ['Discounts', summary.discounts.toFixed(2)],
    ['Refunds', summary.refunds.toFixed(2)],
    ['Net revenue', summary.netRevenue.toFixed(2)],
    ['Cost of goods sold', summary.cogs.toFixed(2)],
    ['Gross profit', summary.grossProfit.toFixed(2)],
    ['Gross margin %', summary.grossMarginPct.toFixed(2)],
    ['Operating expenses', summary.operatingExpenses.toFixed(2)],
    ['Net profit', summary.netProfit.toFixed(2)],
    ['Net margin %', summary.netMarginPct.toFixed(2)],
    ['Orders', String(summary.orderCount)],
    ['Refunded orders', String(summary.refundedOrderCount)],
    ['Expense entries', String(summary.expenseCount)],
  ];
  const csv = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `profit-loss-${startDate}-${endDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ProfitLossReport({ onNavigate }: ProfitLossReportProps) {
  const { user } = useAuth();
  const { mode } = useBusinessMode();
  const canView = user?.role === 'admin' || user?.role === 'manager';
  const { summary, loading, error, fetchSummary } = useProfitReport();
  const [priorSummary, setPriorSummary] = useState<ProfitSummary | null>(null);
  const {
    expenses,
    loading: expensesLoading,
    fetchInRange,
    addExpense,
    deleteExpense,
  } = useOperatingExpenses();

  const initial = presetRange('month');
  const [preset, setPreset] = useState<DatePreset>('month');
  const [startDate, setStartDate] = useState(toDateInputValue(initial.start));
  const [endDate, setEndDate] = useState(toDateInputValue(initial.end));

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState('other');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(toDateInputValue(new Date()));
  const [expenseReference, setExpenseReference] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');
  const [expensePaymentMethod, setExpensePaymentMethod] =
    useState<ExpensePaymentMethod>('cash');
  const [expenseAssignmentId, setExpenseAssignmentId] = useState('');
  const [routeAssignments, setRouteAssignments] = useState<
    Array<{ id: string; route_name: string; assignment_date: string; cashier_id: string }>
  >([]);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);

  const periodLabel = useMemo(
    () =>
      `${format(new Date(`${startDate}T12:00:00`), 'dd MMM yyyy')} – ${format(new Date(`${endDate}T12:00:00`), 'dd MMM yyyy')}`,
    [startDate, endDate],
  );

  const refreshReport = useCallback(async () => {
    const { start, end } = rangeToIso(startDate, endDate);
    const prior = priorPeriodRange(startDate, endDate);
    const priorIso = rangeToIso(prior.start, prior.end);
    await Promise.all([fetchSummary(start, end), fetchInRange(start, end)]);
    try {
      const priorData = await fetchProfitSummary(mode, priorIso.start, priorIso.end);
      setPriorSummary(priorData);
    } catch {
      setPriorSummary(null);
    }
  }, [startDate, endDate, fetchSummary, fetchInRange, mode]);

  const comparisonChartData = useMemo(
    () =>
      priorSummary
        ? [
            { metric: 'Revenue', current: summary.netRevenue, previous: priorSummary.netRevenue },
            {
              metric: 'Gross profit',
              current: summary.grossProfit,
              previous: priorSummary.grossProfit,
            },
            {
              metric: 'Expenses',
              current: summary.operatingExpenses,
              previous: priorSummary.operatingExpenses,
            },
            { metric: 'Net profit', current: summary.netProfit, previous: priorSummary.netProfit },
          ]
        : [],
    [summary, priorSummary],
  );

  useEffect(() => {
    if (!canView) return;
    void refreshReport();
  }, [canView, refreshReport]);

  useEffect(() => {
    if (!showExpenseForm || !canView) return;
    void (async () => {
      const { data } = await supabase
        .from('staff_inventory_assignments')
        .select('id, route_name, assignment_date, cashier_id')
        .order('assignment_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(30);
      setRouteAssignments(data || []);
    })();
  }, [showExpenseForm, canView]);

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
    return [...map.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  const applyPreset = (p: DatePreset) => {
    setPreset(p);
    if (p === 'custom') return;
    const { start, end } = presetRange(p);
    setStartDate(toDateInputValue(start));
    setEndDate(toDateInputValue(end));
  };

  const resetExpenseForm = () => {
    setExpenseCategory('other');
    setExpenseDescription('');
    setExpenseAmount('');
    setExpenseDate(toDateInputValue(new Date()));
    setExpenseReference('');
    setExpenseNotes('');
    setExpensePaymentMethod('cash');
    setExpenseAssignmentId('');
  };

  const handleAddExpense = async () => {
    const amount = parseFloat(expenseAmount);
    if (!expenseDescription.trim()) {
      toast.error('Enter a description');
      return;
    }
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (isRouteExpenseCategory(expenseCategory) && !expenseAssignmentId) {
      toast.error('Select a route assignment for route expenses');
      return;
    }

    setIsSavingExpense(true);
    try {
      const expenseTimestamp = new Date(`${expenseDate}T12:00:00`).toISOString();
      await addExpense({
        category: expenseCategory,
        description: expenseDescription.trim(),
        amount,
        expense_date: expenseTimestamp,
        payment_method: expensePaymentMethod,
        reference: expenseReference.trim() || undefined,
        notes: expenseNotes.trim() || undefined,
        assignment_id: expenseAssignmentId || undefined,
      });
      toast.success('Expense recorded');
      resetExpenseForm();
      setShowExpenseForm(false);
      await refreshReport();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save expense');
    } finally {
      setIsSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    setDeletingExpenseId(id);
    try {
      await deleteExpense(id);
      toast.success('Expense removed');
      await refreshReport();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete expense');
    } finally {
      setDeletingExpenseId(null);
    }
  };

  const isLoading = loading || expensesLoading;

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
              Full P&amp;L: sales, product cost, and operating expenses. {periodLabel}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => void refreshReport()} disabled={isLoading}>
              {isLoading ? (
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
              disabled={isLoading}
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

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Net revenue</p>
                      <p className="text-2xl font-bold tabular-nums">{fc(summary.netRevenue)}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {summary.orderCount} orders
                      </p>
                      {priorSummary && (
                        <ComparisonNote
                          current={summary.netRevenue}
                          prior={priorSummary.netRevenue}
                        />
                      )}
                    </div>
                    <Receipt className="w-8 h-8 text-primary opacity-40" />
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
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {summary.grossMarginPct.toFixed(1)}% margin
                      </p>
                      {priorSummary && (
                        <ComparisonNote
                          current={summary.grossProfit}
                          prior={priorSummary.grossProfit}
                        />
                      )}
                    </div>
                    <TrendingUp className="w-8 h-8 text-success opacity-40" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Operating expenses</p>
                      <p className="text-2xl font-bold tabular-nums">{fc(summary.operatingExpenses)}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {summary.expenseCount} entries
                      </p>
                      {priorSummary && (
                        <ComparisonNote
                          current={summary.operatingExpenses}
                          prior={priorSummary.operatingExpenses}
                        />
                      )}
                    </div>
                    <Wallet className="w-8 h-8 text-warning opacity-40" />
                  </div>
                </CardContent>
              </Card>
              <Card className="sm:col-span-2 lg:col-span-1">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Net profit</p>
                      <p
                        className={cn(
                          'text-2xl font-bold tabular-nums',
                          summary.netProfit >= 0 ? 'text-success' : 'text-destructive',
                        )}
                      >
                        {fc(summary.netProfit)}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {summary.netMarginPct.toFixed(1)}% net margin
                      </p>
                      {priorSummary && (
                        <ComparisonNote
                          current={summary.netProfit}
                          prior={priorSummary.netProfit}
                        />
                      )}
                    </div>
                    {summary.netProfit >= 0 ? (
                      <PiggyBank className="w-8 h-8 text-success opacity-40" />
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

            {comparisonChartData.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Period comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={comparisonChartConfig} className="h-[260px] w-full">
                    <BarChart data={comparisonChartData} margin={{ left: 8, right: 8, top: 8 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="metric" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                        tickFormatter={(v) => fc(Number(v))}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value) => fc(Number(value))}
                          />
                        }
                      />
                      <Legend />
                      <Bar dataKey="current" fill="var(--color-current)" radius={4} />
                      <Bar dataKey="previous" fill="var(--color-previous)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Income statement</CardTitle>
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
                <div className="border-t border-border pt-3 flex justify-between gap-4 tabular-nums font-semibold">
                  <span>Gross profit</span>
                  <span className={summary.grossProfit >= 0 ? 'text-success' : 'text-destructive'}>
                    {fc(summary.grossProfit)}
                  </span>
                </div>
                <div className="flex justify-between gap-4 tabular-nums">
                  <span className="text-muted-foreground">Operating expenses</span>
                  <span className="font-medium">− {fc(summary.operatingExpenses)}</span>
                </div>
                <div className="border-t-2 border-border pt-3 flex justify-between gap-4 tabular-nums text-base font-bold">
                  <span>Net profit</span>
                  <span className={summary.netProfit >= 0 ? 'text-success' : 'text-destructive'}>
                    {fc(summary.netProfit)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base">Operating expenses</CardTitle>
                <Button
                  size="sm"
                  variant={showExpenseForm ? 'secondary' : 'default'}
                  onClick={() => setShowExpenseForm((v) => !v)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Record expense
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {showExpenseForm && (
                  <div className="rounded-md border border-border p-4 space-y-3 bg-muted/20">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Category</Label>
                        <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ALL_EXPENSE_CATEGORIES.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {ROUTE_EXPENSE_CATEGORIES.some((r) => r.id === c.id)
                                  ? `Route: ${c.label}`
                                  : c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label>
                          Route assignment
                          {isRouteExpenseCategory(expenseCategory) ? ' *' : ' (optional)'}
                        </Label>
                        <Select
                          value={expenseAssignmentId || undefined}
                          onValueChange={setExpenseAssignmentId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select route assignment" />
                          </SelectTrigger>
                          <SelectContent>
                            {routeAssignments.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.route_name} · {a.assignment_date}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">
                          Link fuel, food, and other van-run costs to a route for the daily sales report.
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label>Date</Label>
                        <Input
                          type="date"
                          value={expenseDate}
                          onChange={(e) => setExpenseDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label>Description</Label>
                        <Input
                          placeholder="e.g. March shop rent"
                          value={expenseDescription}
                          onChange={(e) => setExpenseDescription(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Amount (KES)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={expenseAmount}
                          onChange={(e) => setExpenseAmount(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Paid via</Label>
                        <Select
                          value={expensePaymentMethod}
                          onValueChange={(v) =>
                            setExpensePaymentMethod(v as ExpensePaymentMethod)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EXPENSE_PAYMENT_METHODS.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">
                          Needed for cash / M-Pesa till reconciliation on Shop Day EOD.
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label>Reference (optional)</Label>
                        <Input
                          placeholder="Invoice / receipt no."
                          value={expenseReference}
                          onChange={(e) => setExpenseReference(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label>Notes (optional)</Label>
                        <Textarea
                          rows={2}
                          value={expenseNotes}
                          onChange={(e) => setExpenseNotes(e.target.value)}
                          className="min-h-[60px]"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowExpenseForm(false);
                          resetExpenseForm();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button size="sm" onClick={() => void handleAddExpense()} disabled={isSavingExpense}>
                        {isSavingExpense && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                        Save expense
                      </Button>
                    </div>
                  </div>
                )}

                {expenseByCategory.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      By category
                    </p>
                    {expenseByCategory.map(({ category, total }) => (
                      <div
                        key={category}
                        className="flex justify-between text-sm tabular-nums"
                      >
                        <span>{expenseCategoryLabel(category)}</span>
                        <span className="font-medium">{fc(total)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {expenses.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No operating expenses recorded for this period.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {expenses.map((e) => (
                      <div
                        key={e.id}
                        className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {e.description || expenseCategoryLabel(e.category)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {expenseCategoryLabel(e.category)} ·{' '}
                            {expensePaymentMethodLabel(e.payment_method)} ·{' '}
                            {format(new Date(e.expense_date), 'dd MMM yyyy')}
                            {e.reference ? ` · ${e.reference}` : ''}
                          </p>
                          {e.notes && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{e.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-semibold tabular-nums">{fc(e.amount)}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            disabled={deletingExpenseId === e.id}
                            onClick={() => void handleDeleteExpense(e.id)}
                          >
                            {deletingExpenseId === e.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground">
              Revenue uses order date (accrual). Expenses use the date you record on each entry.
              Inventory purchases are COGS, not operating expenses — record rent, salaries, utilities,
              and similar costs here.
            </p>
          </>
        )}
      </div>
    </PageLayout>
  );
}
