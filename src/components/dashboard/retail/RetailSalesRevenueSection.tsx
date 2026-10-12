import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import type { SalesData } from '@/data/dashboardData';
import { cn } from '@/lib/utils';
import { formatKES, formatKESAxis } from '@/lib/formatKES';

type TimeRange = 'daily' | 'weekly' | 'monthly';

interface RetailSalesRevenueSectionProps {
  dailyData: SalesData[];
  weeklyData: SalesData[];
  monthlyData: SalesData[];
}

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'hsl(var(--ink-2))',
  },
};

function hasMeaningfulRevenue(series: SalesData[]): boolean {
  return series.some((item) => (item.revenue ?? 0) > 0);
}

export function RetailSalesRevenueSection({
  dailyData,
  weeklyData,
  monthlyData,
}: RetailSalesRevenueSectionProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('weekly');

  const chartData = useMemo(() => {
    switch (timeRange) {
      case 'daily':
        return dailyData;
      case 'weekly':
        return weeklyData;
      case 'monthly':
        return monthlyData;
      default:
        return weeklyData;
    }
  }, [timeRange, dailyData, weeklyData, monthlyData]);

  const isEmpty = chartData.length === 0 || !hasMeaningfulRevenue(chartData);

  const highlightIndex = chartData.length > 0 ? chartData.length - 1 : -1;

  const bestPeriodLine = useMemo(() => {
    if (isEmpty) return null;
    const best = chartData.reduce((prev, cur) =>
      cur.revenue > prev.revenue ? cur : prev,
    );
    if (best.revenue <= 0) return null;
    return `${best.date} had the most revenue at ${formatKES(best.revenue)}`;
  }, [chartData, isEmpty]);

  return (
    <section aria-labelledby="sales-revenue-heading">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="sales-revenue-heading" className="text-lg font-semibold text-ink">
          Sales revenue
        </h2>
        <div
          className="grid grid-cols-3 gap-1 rounded-[var(--radius)] border border-hairline p-1"
          role="tablist"
          aria-label="Sales revenue period"
        >
          {(['daily', 'weekly', 'monthly'] as TimeRange[]).map((range) => {
            const selected = timeRange === range;
            return (
              <button
                key={range}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTimeRange(range)}
                className={cn(
                  'focus-ring min-h-[var(--tap-min)] rounded-[calc(var(--radius)-2px)] px-2 text-sm font-semibold capitalize text-ink-2',
                  selected &&
                    'border-2 border-primary bg-[hsl(var(--accent-soft))] text-ink',
                  !selected && 'border-2 border-transparent',
                )}
              >
                {range}
              </button>
            );
          })}
        </div>
      </div>

      {bestPeriodLine ? (
        <p className="mb-3 text-sm text-ink-2">{bestPeriodLine}</p>
      ) : null}

      {isEmpty ? (
        <p className="text-sm text-ink-2">No sales recorded yet.</p>
      ) : (
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[160px] w-full md:h-[240px] [&_.recharts-cartesian-axis-tick_text]:fill-[hsl(var(--ink-2))] [&_.recharts-cartesian-axis-tick_text]:text-xs"
        >
          <BarChart
            data={chartData}
            margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="hsl(var(--hairline))"
              strokeDasharray="0"
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--hairline))' }}
              tickMargin={8}
              minTickGap={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              width={72}
              tickFormatter={(v) => formatKESAxis(Number(v))}
            />
            <ChartTooltip
              cursor={{ fill: 'hsl(var(--hairline) / 0.35)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as SalesData;
                return (
                  <div className="rounded-[var(--radius)] border border-hairline bg-surface px-3 py-2 text-sm text-ink">
                    <div className="font-semibold">{point.date}</div>
                    <div className="font-mono num text-ink-2">
                      {formatKES(Number(payload[0].value) || 0)}
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    index === highlightIndex
                      ? 'hsl(var(--ink))'
                      : 'hsl(var(--ink-2))'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      )}
    </section>
  );
}
