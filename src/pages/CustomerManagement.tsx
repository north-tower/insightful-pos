import { useState, useMemo, useEffect } from 'react';
import { PageLayout } from '@/components/pos/PageLayout';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  useCustomers,
  Customer,
  CreateCustomerParams,
} from '@/hooks/useCustomers';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  Star,
  Award,
  CreditCard,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CustomerDialog } from '@/components/customer/CustomerDialog';
import { CustomerDetailDialog } from '@/components/customer/CustomerDetailDialog';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currency';

interface CustomerManagementProps {
  onNavigate: (tab: string) => void;
}

const statusColors: Record<string, string> = {
  active: 'bg-success/10 text-success',
  vip: 'bg-warning/10 text-warning',
  inactive: 'bg-muted text-muted-foreground',
  suspended: 'bg-destructive/10 text-destructive',
};

export default function CustomerManagement({
  onNavigate,
}: CustomerManagementProps) {
  const {
    customers,
    loading,
    error,
    createCustomer,
    updateCustomer,
    totalOutstanding,
    getCustomerDisplayName,
  } = useCustomers();

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const matchesSearch =
        customer.first_name
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        customer.last_name
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        customer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.phone?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        filterStatus === 'all' || customer.status === filterStatus;

      return matchesSearch && matchesStatus;
    });
  }, [customers, searchQuery, filterStatus]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, filterStatus]);

  const totalPages = Math.ceil(filteredCustomers.length / pageSize);
  const paginatedCustomers = useMemo(
    () => filteredCustomers.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredCustomers, currentPage, pageSize],
  );

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

  const handleDeleteCustomer = async (customerId: string) => {
    if (confirm('Are you sure you want to delete this customer?')) {
      // useCustomers doesn't expose delete yet — for now we just show a toast
      toast.info('Customer deletion will be available when connected to Supabase');
    }
  };

  const handleSaveCustomer = async (customerData: CreateCustomerParams) => {
    setIsSaving(true);
    try {
      if (selectedCustomer) {
        // Update existing
        await updateCustomer(selectedCustomer.id, customerData);
        toast.success(
          `${customerData.first_name} ${customerData.last_name} updated`,
        );
        setIsEditDialogOpen(false);
      } else {
        // Create new
        const result = await createCustomer(customerData);
        if (result) {
          toast.success(
            `${customerData.first_name} ${customerData.last_name} created`,
          );
        } else {
          toast.error('Failed to create customer');
        }
        setIsCreateDialogOpen(false);
      }
      setSelectedCustomer(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save customer');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageLayout activeTab="customers" onNavigate={onNavigate}>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1 sm:mb-2">
                Customer Management
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Manage your customer database and loyalty program
              </p>
            </div>
            <Button onClick={handleCreateCustomer} className="gap-2 self-start sm:self-auto">
              <Plus className="w-4 h-4" />
              Add Customer
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {(['all', 'active', 'vip', 'inactive', 'suspended'] as const).map(
                (status) => (
                  <Button
                    key={status}
                    variant={filterStatus === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterStatus(status)}
                    className="capitalize shrink-0"
                  >
                    {status}
                  </Button>
                ),
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 mb-6">
            <Card>
              <CardContent className="p-4 min-w-0">
                <p className="text-sm text-muted-foreground mb-1">
                  Total Customers
                </p>
                <p className="text-2xl font-bold tabular-nums truncate">{customers.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 min-w-0">
                <p className="text-sm text-muted-foreground mb-1">
                  Active Customers
                </p>
                <p className="text-2xl font-bold text-success tabular-nums truncate">
                  {
                    customers.filter(
                      (c) => c.status === 'active' || c.status === 'vip',
                    ).length
                  }
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 min-w-0">
                <p className="text-sm text-muted-foreground mb-1">
                  VIP Members
                </p>
                <p className="text-2xl font-bold text-warning tabular-nums truncate">
                  {customers.filter((c) => c.status === 'vip').length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 min-w-0">
                <p className="text-sm text-muted-foreground mb-1">
                  Total Loyalty Points
                </p>
                <p className="text-2xl font-bold text-primary tabular-nums truncate">
                  {customers.reduce((sum, c) => sum + c.loyalty_points, 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="w-4 h-4 text-warning shrink-0" />
                  <p className="text-sm text-muted-foreground truncate">
                    Credit Outstanding
                  </p>
                </div>
                <p className="text-2xl font-bold text-warning tabular-nums truncate">
                  {formatCurrency(totalOutstanding)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-center py-8 text-destructive">
              <p>Failed to load customers: {error}</p>
            </div>
          )}

          {/* Customers List */}
          {!loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedCustomers.map((customer) => (
                <Card
                  key={customer.id}
                  className={cn(
                    'hover:shadow-md transition-shadow',
                    customer.credit_balance > 0 &&
                      'border-l-4 border-l-warning',
                  )}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 min-w-0">
                          <h3 className="font-bold text-lg truncate">
                            {getCustomerDisplayName(customer)}
                          </h3>
                          {customer.status === 'vip' && (
                            <Star className="w-4 h-4 text-warning fill-warning shrink-0" />
                          )}
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          {customer.email && <p className="truncate">{customer.email}</p>}
                          {customer.phone && <p className="truncate">{customer.phone}</p>}
                        </div>
                      </div>
                      <Badge
                        className={cn(
                          'text-xs shrink-0',
                          statusColors[customer.status] || '',
                        )}
                      >
                        {customer.status}
                      </Badge>
                    </div>

                    {/* Tags */}
                    {customer.tags && customer.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {customer.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="text-xs"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Orders</p>
                        <p className="font-semibold tabular-nums truncate">
                          {customer.total_orders.toLocaleString()}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Spent</p>
                        <p className="font-semibold tabular-nums truncate">
                          {formatCurrency(customer.total_spent)}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Points</p>
                        <p className="font-semibold text-primary tabular-nums truncate">
                          {customer.loyalty_points.toLocaleString()}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">
                          Credit Balance
                        </p>
                        <p
                          className={cn(
                            'font-semibold tabular-nums truncate',
                            customer.credit_balance > 0
                              ? 'text-warning'
                              : 'text-muted-foreground',
                          )}
                        >
                          {formatCurrency(customer.credit_balance)}
                        </p>
                      </div>
                    </div>

                    {/* Loyalty Points */}
                    {customer.loyalty_points > 0 && (
                      <div className="flex items-center gap-2 mb-4 p-2 bg-primary/10 rounded-lg min-w-0">
                        <Award className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm font-medium text-primary tabular-nums truncate">
                          {customer.loyalty_points.toLocaleString()} loyalty points
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
          )}

          {/* Pagination */}
          {!loading && !error && filteredCustomers.length > 0 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredCustomers.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
            />
          )}

          {!loading && !error && filteredCustomers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No customers found</p>
            </div>
          )}
      {/* Dialogs */}
      <CustomerDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSave={handleSaveCustomer}
        isSaving={isSaving}
      />

      {selectedCustomer && (
        <>
          <CustomerDialog
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            customer={selectedCustomer}
            onSave={handleSaveCustomer}
            isSaving={isSaving}
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
    </PageLayout>
  );
}
