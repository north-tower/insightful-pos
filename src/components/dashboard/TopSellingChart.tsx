import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { TopSellingItem } from '@/data/dashboardData';
import { Package } from 'lucide-react';

interface TopSellingChartProps {
  data: TopSellingItem[];
}

const chartConfig = {
  quantity: {
    label: 'Quantity Sold',
    color: 'hsl(var(--primary))',
  },
};

export function TopSellingChart({ data }: TopSellingChartProps) {
  const chartData = data.map((item) => ({
    name: item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name,
    quantity: item.quantity,
    fullName: item.name,
  }));

  const isEmpty = chartData.length === 0;

  return (
    <Card className="bg-card dark:bg-gray-800 dark:border-gray-700">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">Top Selling Items</CardTitle>
        <CardDescription>Most ordered items today</CardDescription>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="flex h-[300px] flex-col items-center justify-center text-center px-4">
            <Package className="mb-3 h-10 w-10 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
            <p className="text-sm font-medium text-foreground">No top sellers yet today</p>
            <p className="mt-1 max-w-xs text-sm text-gray-500 dark:text-gray-400">
              Best-selling items will show up here after your first sales
            </p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart
              data={chartData}
              margin={{
                left: 12,
                right: 12,
                top: 12,
                bottom: 12,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const point = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                        <div className="grid gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">{point.fullName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-primary" />
                            <span className="text-sm text-muted-foreground">
                              Quantity:{' '}
                              <span className="font-medium text-foreground">{point.quantity}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="quantity" fill="var(--color-quantity)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
