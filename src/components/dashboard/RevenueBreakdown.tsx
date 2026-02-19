import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Pie, PieChart, Cell } from 'recharts';
import { RevenueBreakdown } from '@/data/dashboardData';
import { cn } from '@/lib/utils';

interface RevenueBreakdownProps {
  data: RevenueBreakdown[];
}

const chartConfig = {
  'dine-in': {
    label: 'Dine In',
    color: 'hsl(var(--primary))',
  },
  takeaway: {
    label: 'Takeaway',
    color: 'hsl(var(--info))',
  },
  delivery: {
    label: 'Delivery',
    color: 'hsl(var(--warning))',
  },
};

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--info))',
  'hsl(var(--warning))',
];

export function RevenueBreakdownChart({ data }: RevenueBreakdownProps) {
  const chartData = data.map((item) => ({
    ...item,
    name: item.type.charAt(0).toUpperCase() + item.type.slice(1).replace('-', ' '),
  }));

  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue Breakdown</CardTitle>
        <CardDescription>Revenue by order type</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center">
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <PieChart>
              <ChartTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <div className="grid gap-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: payload[0].color }}
                            />
                            <span className="text-sm font-medium">{data.name}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Revenue: <span className="font-medium text-foreground">${data.revenue.toFixed(2)}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Percentage: <span className="font-medium text-foreground">{data.percentage.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ percentage }) => `${percentage.toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="revenue"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        </div>
        <div className="mt-4 space-y-2">
          {chartData.map((item, index) => (
            <div key={item.type} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-sm text-muted-foreground">{item.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">${item.revenue.toFixed(2)}</span>
                <span className="text-sm text-muted-foreground w-12 text-right">{item.percentage.toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

