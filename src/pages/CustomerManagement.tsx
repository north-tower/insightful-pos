import { useState, useMemo } from 'react';
import { Sidebar } from '@/components/pos/Sidebar';
import { Header } from '@/components/pos/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { mockCustomers, Customer } from '@/data/customerData';
import { Search, Plus, Edit, Trash2, Eye, Star, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CustomerDialog } from '@/components/customer/CustomerDialog';
import { CustomerDetailDialog } from '@/components/customer/CustomerDetailDialog';
import { format } from 'date-fns';

interface CustomerManagementProps {
  onNavigate: (tab: string) => void;
}

export default function CustomerManagement({ onNavigate }: CustomerManagementProps) {
  const [customers, setCustomers] = useState<Customer[]>(mockCustomers);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'vip' | 'inactive'>('all');

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const matchesSearch =
        customer.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.phone?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = filterStatus === 'all' || customer.status === filterStatus;

      return matchesSearch && matchesStatus;
    });
  }, [customers, searchQuery, filterStatus]);

  const handleCreateCustomer = () => {
    setSelectedCustomer(null);
    setIsCreateDialogOpen(true);
  };

  const handleEditCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsEditDialogOpen(true);
  };

  const handleViewCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDetailDialogOpen(true);
  };

  const handleDeleteCustomer = (customerId: string) => {
    if (confirm('Are you sure you want to delete this customer?')) {
      setCustomers(customers.filter((c) => c.id !== customerId));
    }
  };

  const handleSaveCustomer = (customerData: Partial<Customer>) => {
    if (selectedCustomer) {
      // Update existing customer
      setCustomers(
        customers.map((c) =>
          c.id === selectedCustomer.id
            ? { ...c, ...customerData, updatedAt: new Date() }
            : c
        )
      );
      setIsEditDialogOpen(false);
    } else {
      // Create new customer
      const newCustomer: Customer = {
        id: Date.now().toString(),
        firstName: customerData.firstName || '',
        lastName: customerData.lastName || '',
        email: customerData.email,
        phone: customerData.phone,
        address: customerData.address,
        city: customerData.city,
        postalCode: customerData.postalCode,
        country: customerData.country,
        loyaltyPoints: 0,
        totalSpent: 0,
        totalOrders: 0,
        notes: customerData.notes,
        preferences: customerData.preferences || [],
        tags: customerData.tags || [],
        status: customerData.status || 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setCustomers([...customers, newCustomer]);
      setIsCreateDialogOpen(false);
    }
    setSelectedCustomer(null);
  };

  const statusColors = {
    active: 'bg-success/10 text-success',
    vip: 'bg-warning/10 text-warning',
    inactive: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar activeTab="customers" onTabChange={onNavigate} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Customer Management</h1>
              <p className="text-muted-foreground">Manage your customer database and loyalty program</p>
            </div>
            <Button onClick={handleCreateCustomer} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Customer
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              {(['all', 'active', 'vip', 'inactive'] as const).map((status) => (
                <Button
                  key={status}
                  variant={filterStatus === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus(status)}
                  className="capitalize"
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground mb-1">Total Customers</p>
                <p className="text-2xl font-bold">{customers.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground mb-1">Active Customers</p>
                <p className="text-2xl font-bold text-success">
                  {customers.filter((c) => c.status === 'active' || c.status === 'vip').length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground mb-1">VIP Members</p>
                <p className="text-2xl font-bold text-warning">
                  {customers.filter((c) => c.status === 'vip').length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground mb-1">Total Loyalty Points</p>
                <p className="text-2xl font-bold text-primary">
                  {customers.reduce((sum, c) => sum + c.loyaltyPoints, 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Customers List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomers.map((customer) => (
              <Card key={customer.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-lg">
                          {customer.firstName} {customer.lastName}
                        </h3>
                        {customer.status === 'vip' && (
                          <Star className="w-4 h-4 text-warning fill-warning" />
                        )}
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {customer.email && <p>{customer.email}</p>}
                        {customer.phone && <p>{customer.phone}</p>}
                      </div>
                    </div>
                    <Badge className={cn('text-xs', statusColors[customer.status])}>
                      {customer.status}
                    </Badge>
                  </div>

                  {/* Tags */}
                  {customer.tags && customer.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {customer.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-xs text-muted-foreground">Orders</p>
                      <p className="font-semibold">{customer.totalOrders}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Spent</p>
                      <p className="font-semibold">${customer.totalSpent.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Points</p>
                      <p className="font-semibold text-primary">{customer.loyaltyPoints}</p>
                    </div>
                  </div>

                  {/* Loyalty Points */}
                  {customer.loyaltyPoints > 0 && (
                    <div className="flex items-center gap-2 mb-4 p-2 bg-primary/10 rounded-lg">
                      <Award className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-primary">
                        {customer.loyaltyPoints} loyalty points
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleViewCustomer(customer)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditCustomer(customer)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteCustomer(customer.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredCustomers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No customers found</p>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <CustomerDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSave={handleSaveCustomer}
      />

      {selectedCustomer && (
        <>
          <CustomerDialog
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            customer={selectedCustomer}
            onSave={handleSaveCustomer}
          />
          <CustomerDetailDialog
            open={isDetailDialogOpen}
            onOpenChange={setIsDetailDialogOpen}
            customer={selectedCustomer}
            onEdit={() => {
              setIsDetailDialogOpen(false);
              setIsEditDialogOpen(true);
            }}
          />
        </>
      )}
    </div>
  );
}





