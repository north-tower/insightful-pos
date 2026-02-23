import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';
import { SalesData } from '@/data/dashboardData';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/currency';

interface SalesChartProps {
  data: SalesData[];
  dailyData?: SalesData[];
  weeklyData?: SalesData[];
  monthlyData?: SalesData[];
}

type TimeRange = 'daily' | 'weekly' | 'monthly';

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'hsl(var(--primary))',
  },
};

export function SalesChart({ data, dailyData, weeklyData, monthlyData }: SalesChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('weekly');

  const getChartData = () => {
    switch (timeRange) {
      case 'daily':
        return dailyData || data;
      case 'weekly':
        return weeklyData || data;
      case 'monthly':
        return monthlyData || data;
      default:
        return data;
    }
  };

  const chartData = getChartData();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Sales Revenue</CardTitle>
            <CardDescription>
              {timeRange === 'daily' && 'Today\'s hourly revenue'}
              {timeRange === 'weekly' && 'Last 7 days revenue'}
              {timeRange === 'monthly' && 'Last 30 days revenue'}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {(['daily', 'weekly', 'monthly'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all',
                  timeRange === range
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart
            data={chartData}
            margin={{
              left: 12,
              right: 12,
              top: 12,
              bottom: 12,
            }}
          >
            <defs>
              <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip
              cursor={false}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="grid gap-2">
                        <div className="font-medium">{payload[0].payload.date}</div>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                          <span className="text-sm text-muted-foreground">
                            Revenue: <span className="font-medium text-foreground">{formatCurrency(Number(payload[0].value) || 0)}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              dataKey="revenue"
              type="monotone"
              fill="url(#fillRevenue)"
              fillOpacity={0.4}
              stroke="var(--color-revenue)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
        <div className="mt-4 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-primary" />
            <span className="text-muted-foreground">Revenue</span>
          </div>
          <div className="text-muted-foreground">
            Total: {formatCurrency(chartData.reduce((sum, item) => sum + item.revenue, 0))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

