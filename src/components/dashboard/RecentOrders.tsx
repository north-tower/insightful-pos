import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RecentOrder } from '@/data/dashboardData';
import { cn } from '@/lib/utils';

interface RecentOrdersProps {
  orders: RecentOrder[];
}

const statusStyles = {
  pending: { label: 'Pending', className: 'bg-warning/10 text-warning' },
  preparing: { label: 'Preparing', className: 'bg-primary/10 text-primary' },
  ready: { label: 'Ready', className: 'bg-success/10 text-success' },
  completed: { label: 'Completed', className: 'bg-muted text-muted-foreground' },
};

const typeStyles = {
  'dine-in': 'bg-primary/10 text-primary',
  'takeaway': 'bg-info/10 text-info',
  'delivery': 'bg-warning/10 text-warning',
};

export function RecentOrders({ orders }: RecentOrdersProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Tickets</CardTitle>
        <CardDescription>Latest tickets from today</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {orders.map((order) => {
            const status = statusStyles[order.status];
            return (
              <div
                key={order.id}
                  className="flex items-center justify-between p-4 rounded border border-border hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div>
                      <p className="font-semibold text-foreground">Order #{order.id}</p>
                      <p className="text-sm text-muted-foreground">{order.customerName}</p>
                    </div>
                    <Badge className={cn('text-xs', typeStyles[order.type])}>
                      {order.type.replace('-', ' ')}
                    </Badge>
                    <Badge className={cn('text-xs', status.className)}>
                      {status.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {order.tableNumber && (
                      <span>Table #{order.tableNumber}</span>
                    )}
                    <span>{order.items} items</span>
                    <span>{order.time}</span>
                  </div>
                </div>
                <div className="ml-4 text-right">
                  <p className="font-bold text-lg text-foreground">${order.total.toFixed(2)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}


