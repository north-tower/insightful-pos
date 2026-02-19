import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { PeakHoursData } from '@/data/dashboardData';

interface PeakHoursChartProps {
  data: PeakHoursData[];
}

const chartConfig = {
  orders: {
    label: 'Orders',
    color: 'hsl(var(--primary))',
  },
  revenue: {
    label: 'Revenue',
    color: 'hsl(var(--info))',
  },
};

export function PeakHoursChart({ data }: PeakHoursChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Peak Hours Analysis</CardTitle>
        <CardDescription>Orders and revenue by hour of the day</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart
            data={data}
            margin={{
              left: 12,
              right: 12,
              top: 12,
              bottom: 12,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="hour"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip
              cursor={false}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="grid gap-2">
                        <div className="font-medium">{data.hour}</div>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                          <span className="text-sm text-muted-foreground">
                            Orders: <span className="font-medium text-foreground">{data.orders}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-info" />
                          <span className="text-sm text-muted-foreground">
                            Revenue: <span className="font-medium text-foreground">${data.revenue.toLocaleString()}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar
              dataKey="orders"
              fill="var(--color-orders)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
        <div className="mt-4 flex items-center justify-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-primary" />
            <span className="text-muted-foreground">Orders per hour</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

