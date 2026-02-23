import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: React.ReactNode;
  description?: string;
  isLarge?: boolean;
}

export function StatsCard({ title, value, change, icon, description, isLarge = false }: StatsCardProps) {
  const isPositive = change !== undefined && change >= 0;
  
  return (
    <Card className={cn("border-l-4", isLarge ? "border-warning" : "border-transparent")}>
      <CardContent className={cn(isLarge ? "p-8" : "p-5")}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className={cn("font-medium text-muted-foreground mb-2", isLarge ? "text-base" : "text-sm")}>{title}</p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3 className={cn("font-bold text-foreground tabular-nums truncate", isLarge ? "text-4xl xl:text-6xl" : "text-2xl xl:text-3xl")}>{value}</h3>
              {change !== undefined && !isLarge && (
                <div className={cn(
                  "flex items-center gap-1 text-sm font-medium shrink-0",
                  isPositive ? "text-success" : "text-destructive"
                )}>
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
              <p className={cn("text-muted-foreground mt-2", isLarge ? "text-sm" : "text-xs")}>{description}</p>
            )}
          </div>
          {icon && (
            <div className={cn(
              "ml-4 rounded-lg shrink-0",
              isLarge ? "p-4 bg-warning/10 text-warning" : "p-3 bg-primary/10 text-primary"
            )}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


