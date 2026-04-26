import { PageLayout } from '@/components/pos/PageLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { TopSellingChart } from '@/components/dashboard/TopSellingChart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useProducts } from '@/hooks/useProducts';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import {
  DollarSign,
  ShoppingCart,
  Package,
  AlertTriangle,
  TrendingUp,
  CreditCard,
  Banknote,
  QrCode,
  XCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { Button } from '@/components/ui/button';

interface RetailDashboardProps {
  onNavigate: (tab: string) => void;
}

const paymentIcons = {
  cash: Banknote,
  card: CreditCard,
  qr: QrCode,
};

export default function RetailDashboard({ onNavigate }: RetailDashboardProps) {
  const { retailProducts, loading: productsLoading } = useProducts();
  const {
    loading: statsLoading,
    retailStats,
    dailySalesData,
    weeklySalesData,
    monthlySalesData,
    topSellingItems,
    recentSales,
    refetch,
    lastSyncedAt,
  } = useDashboardStats();

  const loading = productsLoading || statsLoading;

  // Calculate stock alerts from live product data
  const lowStockProducts = retailProducts.filter(
    (p) => p.stock > 0 && p.stock <= p.lowStockThreshold
  );
  const outOfStockProducts = retailProducts.filter((p) => p.stock === 0);

  if (loading) {
    return (
      <PageLayout activeTab="dashboard" onNavigate={onNavigate}>
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout activeTab="dashboard" onNavigate={onNavigate}>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Store Overview</h1>
          <p className="text-muted-foreground">
            {retailStats.todaySales} sales today
            {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
              <span className="text-warning ml-2">
                • {lowStockProducts.length + outOfStockProducts.length} stock alerts
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Last synced at {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : 'Not synced yet'}
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={refetch}
          disabled={statsLoading}
          className="shrink-0"
          title="Refresh dashboard"
        >
          <RefreshCw className={`w-4 h-4 ${statsLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Revenue - BIGGEST */}
        <div className="lg:col-span-2">
          <StatsCard
            title="Today's Revenue"
            value={formatCurrency(retailStats.todayRevenue)}
            change={retailStats.revenueChange}
            icon={<DollarSign className="w-6 h-6" />}
            description={
              retailStats.revenueChange
                ? `${retailStats.revenueChange >= 0 ? '↑' : '↓'} ${Math.abs(Math.round(retailStats.revenueChange))}% from yesterday`
                : undefined
            }
            isLarge={true}
          />
        </div>

        {/* Sales count */}
        <StatsCard
          title="Sales Today"
          value={retailStats.todaySales}
          change={retailStats.salesChange}
          icon={<ShoppingCart className="w-5 h-5" />}
          description={`${retailStats.itemsSold} items sold`}
        />

        {/* Stock alerts */}
        <StatsCard
          title="Stock Alerts"
          value={lowStockProducts.length + outOfStockProducts.length}
          icon={<AlertTriangle className="w-5 h-5" />}
          description={`${outOfStockProducts.length} out of stock`}
        />
      </div>

      {/* Stock Alerts + Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Stock Alerts Panel */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Stock Alerts</CardTitle>
                <CardDescription>Products needing attention</CardDescription>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  outOfStockProducts.length > 0
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-warning/10 text-warning'
                )}
              >
                {lowStockProducts.length + outOfStockProducts.length} alerts
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {outOfStockProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 rounded border-l-4 border-destructive bg-destructive/5"
                >
                  <div className="flex items-center gap-3">
                    <XCircle className="w-4 h-4 text-destructive" />
                    <div>
                      <p className="text-sm font-semibold">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        SKU: {product.sku}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-destructive/10 text-destructive text-xs">
                    Out of Stock
                  </Badge>
                </div>
              ))}
              {lowStockProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 rounded border-l-4 border-warning bg-warning/5"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-warning" />
                    <div>
                      <p className="text-sm font-semibold">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        SKU: {product.sku} • {product.stock} left
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-warning/10 text-warning text-xs">
                    Low Stock
                  </Badge>
                </div>
              ))}
              {lowStockProducts.length === 0 && outOfStockProducts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">All stock levels healthy</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Sales */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Recent Sales</CardTitle>
              <CardDescription>Latest transactions today</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentSales.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No sales yet today</p>
                </div>
              )}
              {recentSales.map((sale) => {
                const PayIcon = paymentIcons[sale.paymentMethod];
                return (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between p-3 rounded border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold">
                          #{sale.saleNumber}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {sale.items} items
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {sale.customerName && <span>{sale.customerName}</span>}
                        <span>•</span>
                        <span>{sale.time}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <PayIcon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-bold">
                        {formatCurrency(sale.total)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <SalesChart
          data={weeklySalesData}
          dailyData={dailySalesData}
          weeklyData={weeklySalesData}
          monthlyData={monthlySalesData}
        />
        <TopSellingChart data={topSellingItems} />
      </div>
    </PageLayout>
  );
}
