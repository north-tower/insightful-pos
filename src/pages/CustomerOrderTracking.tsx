import { useParams } from 'react-router-dom';
import { useOrderQueue } from '@/context/OrderQueueContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Clock, CheckCircle2, XCircle, ChefHat, Package, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function CustomerOrderTracking() {
  const { trackingCode } = useParams<{ trackingCode: string }>();
  const { getOrderByTrackingCode } = useOrderQueue();
  const navigate = useNavigate();

  const order = trackingCode ? getOrderByTrackingCode(trackingCode) : undefined;

  const statusConfig = {
    pending: {
      label: 'Pending',
      icon: Clock,
      color: 'bg-warning/10 text-warning',
      description: 'Your order is waiting for confirmation',
    },
    accepted: {
      label: 'Accepted',
      icon: CheckCircle2,
      color: 'bg-info/10 text-info',
      description: 'Order confirmed and being prepared',
    },
    preparing: {
      label: 'Preparing',
      icon: ChefHat,
      color: 'bg-primary/10 text-primary',
      description: 'Your order is being prepared',
    },
    ready: {
      label: 'Ready',
      icon: Package,
      color: 'bg-success/10 text-success',
      description: 'Your order is ready!',
    },
    completed: {
      label: 'Completed',
      icon: CheckCircle2,
      color: 'bg-success/10 text-success',
      description: 'Order completed',
    },
    rejected: {
      label: 'Rejected',
      icon: XCircle,
      color: 'bg-destructive/10 text-destructive',
      description: 'Order was rejected',
    },
    cancelled: {
      label: 'Cancelled',
      icon: XCircle,
      color: 'bg-muted text-muted-foreground',
      description: 'Order was cancelled',
    },
  };

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <XCircle className="w-16 h-16 mx-auto mb-4 text-destructive" />
            <h1 className="text-2xl font-bold mb-2">Order Not Found</h1>
            <p className="text-muted-foreground mb-6">
              We couldn't find an order with tracking code: {trackingCode}
            </p>
            <Button onClick={() => navigate('/order')}>Place New Order</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = statusConfig[order.status];
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-primary/5">
      <div className="max-w-2xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/order')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Menu
            </Button>
            <ThemeToggle />
          </div>
          <h1 className="text-3xl font-bold mb-2">Order Tracking</h1>
          <p className="text-muted-foreground">Track your order status in real-time</p>
        </div>

        {/* Order Status Card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <div className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4',
                status.color
              )}>
                <StatusIcon className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold mb-2">{status.label}</h2>
              <p className="text-muted-foreground">{status.description}</p>
            </div>

            {/* Order Info */}
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order Number</span>
                <span className="font-semibold">{order.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tracking Code</span>
                <span className="font-mono font-semibold">{order.trackingCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order Type</span>
                <span className="capitalize">{order.type.replace('-', ' ')}</span>
              </div>
              {order.tableNumber && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Table Number</span>
                  <span className="font-semibold">#{order.tableNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order Time</span>
                <span>{format(order.createdAt, 'MMM dd, yyyy HH:mm')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Amount</span>
                <span className="font-bold text-lg">${order.total.toFixed(2)}</span>
              </div>
            </div>

            {order.rejectedReason && (
              <div className="p-4 bg-destructive/10 rounded-lg mb-4">
                <p className="font-semibold text-destructive mb-1">Rejection Reason</p>
                <p className="text-sm">{order.rejectedReason}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold text-lg mb-4">Order Items</h3>
            <div className="space-y-4">
              {order.items.map((item, index) => (
                <div key={index} className="flex items-start gap-4">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      ${item.price.toFixed(2)} × {item.quantity}
                    </p>
                    {item.notes && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        Note: {item.notes}
                      </p>
                    )}
                  </div>
                  <p className="font-semibold">
                    ${(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>

            {order.orderNotes && (
              <div className="mt-6 pt-6 border-t">
                <p className="text-sm font-semibold mb-2">Special Instructions</p>
                <p className="text-sm text-muted-foreground">{order.orderNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


