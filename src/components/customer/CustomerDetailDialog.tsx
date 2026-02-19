import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Customer } from '@/data/customerData';
import { mockOrderHistory } from '@/data/orderData';
import { format } from 'date-fns';
import { Edit, Star, Award, Mail, Phone, MapPin, Calendar, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CustomerDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer;
  onEdit: () => void;
}

export function CustomerDetailDialog({
  open,
  onOpenChange,
  customer,
  onEdit,
}: CustomerDetailDialogProps) {
  // Filter orders for this customer
  const customerOrders = mockOrderHistory.filter(
    (order) => order.customerName === `${customer.firstName} ${customer.lastName}`
  );

  const statusColors = {
    active: 'bg-success/10 text-success',
    vip: 'bg-warning/10 text-warning',
    inactive: 'bg-muted text-muted-foreground',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                {customer.firstName} {customer.lastName}
                {customer.status === 'vip' && (
                  <Star className="w-5 h-5 text-warning fill-warning" />
                )}
              </DialogTitle>
              <DialogDescription>
                Customer since {format(customer.createdAt, 'MMM dd, yyyy')}
              </DialogDescription>
            </div>
            <Button variant="outline" onClick={onEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="orders">Order History</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Contact Information */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-4">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  {customer.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{customer.email}</span>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{customer.phone}</span>
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex items-start gap-2 col-span-2">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div className="text-sm">
                        <p>{customer.address}</p>
                        {customer.city && (
                          <p>
                            {customer.city}
                            {customer.postalCode && `, ${customer.postalCode}`}
                            {customer.country && ` ${customer.country}`}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <ShoppingBag className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-2xl font-bold">{customer.totalOrders}</p>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Award className="w-6 h-6 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold text-primary">{customer.loyaltyPoints}</p>
                  <p className="text-sm text-muted-foreground">Loyalty Points</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">${customer.totalSpent.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">Total Spent</p>
                </CardContent>
              </Card>
            </div>

            {/* Status and Tags */}
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Status</p>
                <Badge className={cn(statusColors[customer.status])}>
                  {customer.status.toUpperCase()}
                </Badge>
              </div>
              {customer.tags && customer.tags.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Tags</p>
                  <div className="flex gap-2">
                    {customer.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            {customer.notes && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">Notes</h3>
                  <p className="text-sm text-muted-foreground">{customer.notes}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Order History Tab */}
          <TabsContent value="orders" className="space-y-4">
            {customerOrders.length > 0 ? (
              <div className="space-y-3">
                {customerOrders.map((order) => (
                  <Card key={order.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-semibold">Order #{order.orderNumber}</h4>
                            <Badge variant="outline" className="text-xs">
                              {format(order.createdAt, 'MMM dd, yyyy HH:mm')}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Items</p>
                              <p className="font-medium">{order.items.length}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Total</p>
                              <p className="font-medium">${order.total.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Status</p>
                              <Badge variant="outline" className="text-xs">
                                {order.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>No orders found for this customer</p>
              </div>
            )}
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences" className="space-y-4">
            {customer.preferences && customer.preferences.length > 0 ? (
              <div className="space-y-3">
                {customer.preferences.map((pref) => (
                  <Card key={pref.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="capitalize">
                              {pref.type}
                            </Badge>
                            <span className="font-medium">{pref.name}</span>
                          </div>
                          {pref.description && (
                            <p className="text-sm text-muted-foreground">{pref.description}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>No preferences recorded</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}





