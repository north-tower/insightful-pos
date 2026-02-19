import { useState } from 'react';
import { Sidebar } from '@/components/pos/Sidebar';
import { Header } from '@/components/pos/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { mockOrderHistory } from '@/data/orderData';
import { Order } from '@/data/orderData';
import { Search, RotateCcw, Eye, Printer, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ReceiptDialog } from '@/components/receipt/ReceiptDialog';
import { generateReceiptData } from '@/data/receiptData';

interface OrderHistoryProps {
  onNavigate: (tab: string) => void;
}

const statusColors = {
  pending: 'bg-warning/10 text-warning',
  preparing: 'bg-primary/10 text-primary',
  ready: 'bg-success/10 text-success',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
};

const paymentStatusColors = {
  pending: 'bg-warning/10 text-warning',
  partial: 'bg-info/10 text-info',
  paid: 'bg-success/10 text-success',
  refunded: 'bg-destructive/10 text-destructive',
  voided: 'bg-muted text-muted-foreground',
};

export default function OrderHistory({ onNavigate }: OrderHistoryProps) {
  const [orders] = useState<Order[]>(mockOrderHistory);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<Order | null>(null);

  const filteredOrders = orders.filter((order) => {
    const query = searchQuery.toLowerCase();
    return (
      order.orderNumber.toLowerCase().includes(query) ||
      order.customerName?.toLowerCase().includes(query) ||
      order.tableNumber?.toLowerCase().includes(query)
    );
  });

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setIsDetailOpen(true);
  };

  const handlePrintReceipt = (order: Order) => {
    setSelectedOrderForReceipt(order);
    setIsReceiptOpen(true);
  };

  const handleReorder = (order: Order) => {
    // TODO: Implement reorder functionality
    console.log('Reorder:', order);
  };

  const handleRefund = (order: Order) => {
    // TODO: Implement refund functionality
    console.log('Refund:', order);
  };

  const handleVoid = (order: Order) => {
    // TODO: Implement void functionality
    console.log('Void:', order);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar activeTab="order-history" onTabChange={onNavigate} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground mb-2">Order History</h1>
            <p className="text-muted-foreground">View and manage past orders</p>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by order number, customer, or table..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Orders List */}
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <Card key={order.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="font-bold text-lg text-foreground">Order #{order.orderNumber}</h3>
                        <Badge className={cn('text-xs', statusColors[order.status])}>
                          {order.status}
                        </Badge>
                        <Badge className={cn('text-xs', paymentStatusColors[order.paymentStatus])}>
                          {order.paymentStatus}
                        </Badge>
                        {order.paymentMethod === 'split' && (
                          <Badge className="text-xs bg-info/10 text-info">Split Payment</Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                        {order.tableNumber && (
                          <div>
                            <p className="text-muted-foreground">Table</p>
                            <p className="font-medium">#{order.tableNumber}</p>
                          </div>
                        )}
                        {order.customerName && (
                          <div>
                            <p className="text-muted-foreground">Customer</p>
                            <p className="font-medium">{order.customerName}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-muted-foreground">Date</p>
                          <p className="font-medium">{format(order.createdAt, 'MMM dd, yyyy HH:mm')}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total</p>
                          <p className="font-medium">${order.total.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                        <span>{order.items.length} items</span>
                        {order.type && (
                          <>
                            <span>•</span>
                            <span className="capitalize">{order.type.replace('-', ' ')}</span>
                          </>
                        )}
                        {order.paymentMethod && order.paymentMethod !== 'split' && (
                          <>
                            <span>•</span>
                            <span className="capitalize">{order.paymentMethod}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewOrder(order)}
                        className="gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </Button>
                      {order.status === 'completed' && order.paymentStatus !== 'refunded' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReorder(order)}
                          className="gap-2"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Reorder
                        </Button>
                      )}
                      {order.paymentStatus === 'paid' && order.status !== 'cancelled' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRefund(order)}
                          className="gap-2 text-destructive hover:text-destructive"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Refund
                        </Button>
                      )}
                      {order.status !== 'completed' && order.status !== 'cancelled' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVoid(order)}
                          className="gap-2 text-destructive hover:text-destructive"
                        >
                          <X className="w-4 h-4" />
                          Void
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details #{selectedOrder?.orderNumber}</DialogTitle>
            <DialogDescription>
              {format(selectedOrder?.createdAt || new Date(), 'MMM dd, yyyy HH:mm')}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={cn('mt-1', statusColors[selectedOrder.status])}>
                    {selectedOrder.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payment Status</p>
                  <Badge className={cn('mt-1', paymentStatusColors[selectedOrder.paymentStatus])}>
                    {selectedOrder.paymentStatus}
                  </Badge>
                </div>
                {selectedOrder.tableNumber && (
                  <div>
                    <p className="text-sm text-muted-foreground">Table</p>
                    <p className="font-medium">#{selectedOrder.tableNumber}</p>
                  </div>
                )}
                {selectedOrder.customerName && (
                  <div>
                    <p className="text-sm text-muted-foreground">Customer</p>
                    <p className="font-medium">{selectedOrder.customerName}</p>
                  </div>
                )}
              </div>

              {/* Items */}
              <div>
                <h4 className="font-semibold mb-3">Items</h4>
                <div className="space-y-3">
                  {selectedOrder.items.map((item, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
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
                          <p className="text-sm text-muted-foreground mt-1">Note: {item.notes}</p>
                        )}
                        {item.modifiers && item.modifiers.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {item.modifiers.map((mod) => (
                              <p key={mod.id} className="text-xs text-muted-foreground">
                                {mod.type}: {mod.name} {mod.price ? `(+$${mod.price.toFixed(2)})` : ''}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="font-medium">
                        ${(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Split Payments */}
              {selectedOrder.splitPayments && selectedOrder.splitPayments.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Split Payments</h4>
                  <div className="space-y-2">
                    {selectedOrder.splitPayments.map((payment) => (
                      <div key={payment.id} className="flex justify-between p-2 bg-muted/50 rounded">
                        <span className="capitalize">{payment.method}</span>
                        <span className="font-medium">${payment.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Order Notes */}
              {selectedOrder.notes && (
                <div>
                  <h4 className="font-semibold mb-2">Order Notes</h4>
                  <p className="text-sm text-muted-foreground">{selectedOrder.notes}</p>
                </div>
              )}

              {/* Summary */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${selectedOrder.subtotal.toFixed(2)}</span>
                </div>
                {selectedOrder.discount && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-success">-${selectedOrder.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>${selectedOrder.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total</span>
                  <span>${selectedOrder.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  variant="outline" 
                  className="flex-1 gap-2"
                  onClick={() => handlePrintReceipt(selectedOrder)}
                >
                  <Printer className="w-4 h-4" />
                  Print Receipt
                </Button>
                {selectedOrder.status === 'completed' && selectedOrder.paymentStatus !== 'refunded' && (
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => handleReorder(selectedOrder)}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reorder
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      {selectedOrderForReceipt && (
        <ReceiptDialog
          open={isReceiptOpen}
          onOpenChange={setIsReceiptOpen}
          receiptData={generateReceiptData(selectedOrderForReceipt)}
        />
      )}
    </div>
  );
}

