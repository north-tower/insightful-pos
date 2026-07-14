import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: React.ReactNode;
  description?: string;
  isLarge?: boolean;
  /** Last-7-days values for an inline sparkline (hero card only). */
  sparklineData?: number[];
}

export function StatsCard({
  title,
  value,
  change,
  icon,
  description,
  isLarge = false,
  sparklineData,
}: StatsCardProps) {
  const isPositive = change !== undefined && change >= 0;
  const hasSparkline =
    isLarge &&
    Array.isArray(sparklineData) &&
    sparklineData.length > 0 &&
    sparklineData.some((v) => v > 0);

  const chartPoints = hasSparkline
    ? sparklineData!.map((v, i) => ({ i, value: v }))
    : [];

  return (
    <Card
      className={cn(
        'border-l-4 bg-card dark:bg-gray-800',
        isLarge
          ? 'border-warning shadow-sm'
          : 'border-border/60 dark:border-gray-700'
      )}
    >
      <CardContent className={cn(isLarge ? 'p-6 sm:p-8' : 'p-4 sm:p-5')}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                'mb-2 text-sm font-medium text-gray-500 dark:text-gray-400'
              )}
            >
              {title}
            </p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3
                className={cn(
                  'text-foreground tabular-nums truncate',
                  isLarge
                    ? 'text-4xl font-bold'
                    : 'text-2xl font-semibold'
                )}
              >
                {value}
              </h3>
              {change !== undefined && !isLarge && (
                <div
                  className={cn(
                    'flex items-center gap-1 text-sm font-medium shrink-0',
                    isPositive ? 'text-success' : 'text-destructive'
                  )}
                >
                  {isPositive ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  <span>{Math.abs(change).toFixed(1)}%</span>
                </div>
              )}
            </div>
            {description && (
              <p
                className={cn(
                  'mt-2 text-gray-500 dark:text-gray-400',
                  isLarge ? 'text-sm' : 'text-xs'
                )}
              >
                {description}
              </p>
            )}
            {hasSparkline && (
              <div className="mt-4 h-12 w-full max-w-[200px]" aria-hidden>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartPoints} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sparkRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--warning))" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="hsl(var(--warning))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--warning))"
                      strokeWidth={2}
                      fill="url(#sparkRevenue)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          {icon && (
            <div
              className={cn(
                'shrink-0 rounded-lg',
                isLarge
                  ? 'p-4 bg-warning/10 text-warning'
                  : 'p-3 bg-primary/10 text-primary dark:bg-primary/20'
              )}
            >
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
