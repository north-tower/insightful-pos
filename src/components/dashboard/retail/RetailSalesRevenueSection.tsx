import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import type { SalesData } from '@/data/dashboardData';
import { cn } from '@/lib/utils';
import { formatKES, formatKESAxis, formatKESAxisTick } from '@/lib/formatKES';

const Y_AXIS_WIDTH_FULL = 76;
const Y_AXIS_WIDTH_COMPACT = 44;

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
  const [compactYAxis, setCompactYAxis] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 359px)');
    const update = () => setCompactYAxis(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

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

  const xAxisTicks = useMemo(() => {
    const len = chartData.length;
    if (len === 0) return undefined;
    const datesAt = (indices: number[]) =>
      [...new Set(indices.filter((i) => i >= 0 && i < len))].map((i) => chartData[i].date);

    if (timeRange === 'daily') {
      const step = len > 10 ? 3 : 2;
      const indices: number[] = [];
      for (let i = 0; i < len; i += step) indices.push(i);
      if (indices[indices.length - 1] !== len - 1) indices.push(len - 1);
      return datesAt(indices);
    }

    if (timeRange === 'monthly') {
      if (len <= 4) return datesAt(Array.from({ length: len }, (_, i) => i));
      const mid = Math.round((len - 1) / 2);
      return datesAt([0, mid, len - 1]);
    }

    return undefined;
  }, [chartData, timeRange]);

  return (
    <section aria-labelledby="sales-revenue-heading">
      <div className="mb-4 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="sales-revenue-heading" className="min-w-0 text-lg font-semibold text-ink">
          Sales revenue
        </h2>
        <div
          className="grid min-w-0 max-w-full grid-cols-3 gap-1 rounded-[var(--radius)] border border-hairline p-1 sm:shrink-0"
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
          className="relative block aspect-auto h-[160px] min-h-[160px] min-w-0 max-w-full overflow-hidden md:h-[240px] md:min-h-[240px] [&_.recharts-cartesian-axis-tick_text]:fill-[hsl(var(--ink-2))] [&_.recharts-cartesian-axis-tick_text]:text-[10px] sm:[&_.recharts-cartesian-axis-tick_text]:text-xs [&_.recharts-responsive-container]:!absolute [&_.recharts-responsive-container]:inset-0 [&_.recharts-responsive-container]:!h-full [&_.recharts-responsive-container]:!max-w-full [&_.recharts-responsive-container]:!w-full [&_.recharts-yAxis_.recharts-cartesian-axis-tick_text]:whitespace-nowrap [&_.recharts-yAxis_.recharts-cartesian-axis-tick_text]:text-xs"
        >
          {compactYAxis ? (
            <span
              className="pointer-events-none absolute left-0 top-0 z-[1] text-xs font-medium leading-none text-ink-2"
              aria-hidden
            >
              KES
            </span>
          ) : null}
          <BarChart
            data={chartData}
            margin={{ left: 0, right: 4, top: compactYAxis ? 18 : 14, bottom: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="hsl(var(--hairline))"
              strokeDasharray="0"
            />
            <XAxis
              dataKey="date"
              ticks={xAxisTicks}
              interval={xAxisTicks ? 0 : undefined}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--hairline))' }}
              tickMargin={8}
              minTickGap={16}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              width={compactYAxis ? Y_AXIS_WIDTH_COMPACT : Y_AXIS_WIDTH_FULL}
              tickFormatter={(v) =>
                compactYAxis
                  ? formatKESAxisTick(Number(v))
                  : formatKESAxis(Number(v))
              }
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
