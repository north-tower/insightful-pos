import { useOrderQueue } from '@/context/OrderQueueContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CustomerOrder } from '@/data/orderQueueData';
import { format, formatDistanceToNow } from 'date-fns';
import { Clock, ChefHat, Package, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/currency';
import { CustomerOrderStatus } from '@/data/orderQueueData';

interface ActiveCustomerOrdersProps {
  onOrderClick?: (order: CustomerOrder) => void;
}

const statusConfig: Record<CustomerOrderStatus, { label: string; icon: any; color: string }> = {
  accepted: { label: 'Accepted', icon: CheckCircle2, color: 'bg-info/10 text-info' },
  preparing: { label: 'Preparing', icon: ChefHat, color: 'bg-primary/10 text-primary' },
  ready: { label: 'Ready', icon: Package, color: 'bg-success/10 text-success' },
  pending: { label: 'Pending', icon: Clock, color: 'bg-warning/10 text-warning' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'bg-muted text-muted-foreground' },
  rejected: { label: 'Rejected', icon: Clock, color: 'bg-destructive/10 text-destructive' },
  cancelled: { label: 'Cancelled', icon: Clock, color: 'bg-muted text-muted-foreground' },
};

export function ActiveCustomerOrders({ onOrderClick }: ActiveCustomerOrdersProps) {
  const { activeOrders, updateOrderStatus } = useOrderQueue();

  const handleStatusUpdate = (orderId: string, newStatus: CustomerOrderStatus) => {
    updateOrderStatus(orderId, newStatus);
  };

  if (activeOrders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Active Customer Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <p>No active customer orders</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Active Customer Orders</CardTitle>
          <Badge variant="outline">{activeOrders.length} active</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activeOrders.map((order) => {
            const status = statusConfig[order.status];
            const StatusIcon = status.icon;
            const timeAgo = formatDistanceToNow(order.acceptedAt || order.createdAt, { addSuffix: true });

            return (
              <div
                key={order.id}
                className={cn(
                  'p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors',
                  onOrderClick && 'cursor-pointer'
                )}
                onClick={() => onOrderClick?.(order)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">Order #{order.orderNumber}</h3>
                      <Badge className={cn('text-xs', status.color)}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="capitalize">{order.type.replace('-', ' ')}</span>
                      {order.tableNumber && <span>Table #{order.tableNumber}</span>}
                      {order.customerName && <span>{order.customerName}</span>}
                      <span>{timeAgo}</span>
                    </div>
                  </div>
                </div>

                {/* Items Preview */}
                <div className="mb-3">
                  <p className="text-sm text-muted-foreground mb-2">
                    {order.items.length} items • {formatCurrency(order.total)}
                  </p>
                </div>

                {/* Status Actions */}
                <div className="flex gap-2 pt-3 border-t">
                  {order.status === 'accepted' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusUpdate(order.id, 'preparing');
                      }}
                      className="flex-1"
                    >
                      <ChefHat className="w-4 h-4 mr-2" />
                      Start Preparing
                    </Button>
                  )}
                  {order.status === 'preparing' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusUpdate(order.id, 'ready');
                      }}
                      className="flex-1"
                    >
                      <Package className="w-4 h-4 mr-2" />
                      Mark Ready
                    </Button>
                  )}
                  {order.status === 'ready' && (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusUpdate(order.id, 'completed');
                      }}
                      className="flex-1"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Complete
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}





