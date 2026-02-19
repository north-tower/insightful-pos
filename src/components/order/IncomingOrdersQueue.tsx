import { useState, useMemo } from 'react';
import { useOrderQueue } from '@/context/OrderQueueContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CustomerOrder } from '@/data/orderQueueData';
import { format, formatDistanceToNow, differenceInSeconds } from 'date-fns';
import { Clock, CheckCircle2, XCircle, QrCode, Monitor, Globe, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { tables } from '@/data/tableData';

interface IncomingOrdersQueueProps {
  className?: string;
}

const sourceIcons = {
  kiosk: Monitor,
  qr: QrCode,
  web: Globe,
  pos: AlertCircle,
};

const sourceColors = {
  kiosk: 'bg-primary/10 text-primary',
  qr: 'bg-info/10 text-info',
  web: 'bg-success/10 text-success',
  pos: 'bg-muted text-muted-foreground',
};

// Helper function to format elapsed time as MM:SS
function formatElapsedTime(date: Date): string {
  const seconds = differenceInSeconds(new Date(), date);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function IncomingOrdersQueue({ className }: IncomingOrdersQueueProps) {
  const { pendingOrders, acceptOrder, rejectOrder } = useOrderQueue();
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);
  const [isAcceptDialogOpen, setIsAcceptDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [tableNumber, setTableNumber] = useState('');

  const availableTables = tables.filter((t) => t.status === 'available').map((t) => t.number);

  const handleAcceptClick = (order: CustomerOrder) => {
    setSelectedOrder(order);
    if (order.type === 'dine-in') {
      setIsAcceptDialogOpen(true);
    } else {
      acceptOrder(order.id);
      toast.success(`Order ${order.orderNumber} accepted`);
    }
  };

  const handleAcceptConfirm = () => {
    if (!selectedOrder) return;
    
    if (selectedOrder.type === 'dine-in' && !tableNumber) {
      toast.error('Please select a table');
      return;
    }

    acceptOrder(selectedOrder.id, tableNumber || undefined);
    toast.success(`Order ${selectedOrder.orderNumber} accepted`);
    setIsAcceptDialogOpen(false);
    setSelectedOrder(null);
    setTableNumber('');
  };

  const handleRejectClick = (order: CustomerOrder) => {
    setSelectedOrder(order);
    setIsRejectDialogOpen(true);
  };

  const handleRejectConfirm = () => {
    if (!selectedOrder || !rejectReason.trim()) {
      toast.error('Please provide a reason');
      return;
    }

    rejectOrder(selectedOrder.id, rejectReason);
    toast.success(`Order ${selectedOrder.orderNumber} rejected`);
    setIsRejectDialogOpen(false);
    setSelectedOrder(null);
    setRejectReason('');
  };

  if (pendingOrders.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Incoming Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No pending orders</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Incoming Orders</CardTitle>
            <Badge variant="outline" className="bg-warning/10 text-warning">
              {pendingOrders.length} pending
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {pendingOrders.map((order) => {
              const SourceIcon = sourceIcons[order.source];
              const elapsedSeconds = differenceInSeconds(new Date(), order.createdAt);
              const elapsedMinutes = Math.floor(elapsedSeconds / 60);
              const elapsedTime = formatElapsedTime(order.createdAt);
              const isUrgent = elapsedMinutes >= 5;
              
              // Determine order card class based on type and urgency
              const orderCardClass = useMemo(() => {
                if (isUrgent) {
                  return 'order-urgent order-urgent-pulse';
                }
                if (order.type === 'delivery') {
                  return 'order-delivery';
                }
                if (order.type === 'takeaway') {
                  return 'order-in-progress';
                }
                return 'order-urgent'; // Dine-in defaults to urgent (red)
              }, [order.type, isUrgent]);

              return (
                <div
                  key={order.id}
                  className={cn(
                    'p-4 border-0 rounded-none hover:opacity-90 transition-opacity',
                    orderCardClass
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      {/* Huge order number */}
                      <div className="flex items-baseline gap-3 mb-2">
                        <span className="text-4xl font-bold leading-none">#{order.orderNumber}</span>
                        {isUrgent && (
                          <Badge className="bg-destructive text-destructive-foreground text-xs font-bold px-2 py-1">
                            LATE
                          </Badge>
                        )}
                      </div>
                      
                      {/* Table number or order type - prominent */}
                      <div className="mb-2">
                        {order.tableNumber ? (
                          <span className="text-lg font-semibold">Table #{order.tableNumber}</span>
                        ) : (
                          <span className="text-base font-medium capitalize">{order.type.replace('-', ' ')}</span>
                        )}
                        {order.customerName && (
                          <span className="text-sm text-muted-foreground ml-2">• {order.customerName}</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Elapsed time - monospace, prominent */}
                    <div className="text-right">
                      <div className={cn(
                        'text-lg font-mono font-semibold',
                        isUrgent && 'text-destructive timer-critical'
                      )}>
                        {elapsedTime}
                      </div>
                      <Badge className={cn('text-xs mt-1', sourceColors[order.source])} variant="outline">
                        <SourceIcon className="w-3 h-3 mr-1" />
                        {order.source.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  {/* Order Items - bold and prominent */}
                  <div className="mb-3 space-y-1">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="text-base font-semibold">
                        {item.quantity}× {item.name}
                        {item.notes && (
                          <span className="text-sm font-normal text-warning ml-2">• {item.notes}</span>
                        )}
                      </div>
                    ))}
                    {order.orderNotes && (
                      <div className="text-sm text-muted-foreground italic mt-1">
                        Note: {order.orderNotes}
                      </div>
                    )}
                  </div>

                  {/* Total and item count */}
                  <div className="text-sm text-muted-foreground mb-3">
                    {order.items.length} items • ${order.total.toFixed(2)}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-border/50">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRejectClick(order)}
                      className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAcceptClick(order)}
                      className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      FIRE
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Accept Dialog */}
      <Dialog open={isAcceptDialogOpen} onOpenChange={setIsAcceptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept Order</DialogTitle>
            <DialogDescription>
              Assign a table for this dine-in order
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div>
                <Label>Order #{selectedOrder.orderNumber}</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedOrder.items.length} items • ${selectedOrder.total.toFixed(2)}
                </p>
              </div>
              {selectedOrder.type === 'dine-in' && (
                <div>
                  <Label htmlFor="tableNumber">Table Number *</Label>
                  <Select value={tableNumber} onValueChange={setTableNumber}>
                    <SelectTrigger id="tableNumber" className="mt-1">
                      <SelectValue placeholder="Select table" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTables.map((table) => (
                        <SelectItem key={table} value={String(table)}>
                          Table #{table}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsAcceptDialogOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button onClick={handleAcceptConfirm} className="flex-1">
                  Fire Order
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Order</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this order
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div>
                <Label>Order #{selectedOrder.orderNumber}</Label>
              </div>
              <div>
                <Label htmlFor="rejectReason">Reason *</Label>
                <Input
                  id="rejectReason"
                  placeholder="e.g., Out of stock, Invalid table number..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsRejectDialogOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRejectConfirm}
                  variant="destructive"
                  className="flex-1"
                >
                  Reject Order
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}





