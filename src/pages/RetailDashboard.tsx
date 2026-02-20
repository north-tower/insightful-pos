import { PageLayout } from '@/components/pos/PageLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { TopSellingChart } from '@/components/dashboard/TopSellingChart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useProducts } from '@/hooks/useProducts';
import {
  retailDashboardStats,
  retailWeeklySales,
  retailDailySales,
  topSellingProducts,
  recentSales,
} from '@/data/productData';
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
} from 'lucide-react';

interface RetailDashboardProps {
  onNavigate: (tab: string) => void;
}

// Convert retail sales data to match SalesChart's expected format
const weeklySalesData = retailWeeklySales.map((d) => ({
  date: d.date,
  revenue: d.revenue,
  orders: d.transactions,
}));

const dailySalesData = retailDailySales.map((d) => ({
  date: d.date,
  revenue: d.revenue,
  orders: d.transactions,
}));

// Convert top selling products to chart format
const topSellingChartData = topSellingProducts.map((p) => ({
  id: p.id,
  name: p.name,
  quantity: p.quantitySold,
  revenue: p.revenue,
  category: p.category,
}));

const paymentIcons = {
  cash: Banknote,
  card: CreditCard,
  qr: QrCode,
};

export default function RetailDashboard({ onNavigate }: RetailDashboardProps) {
  const { retailProducts, loading } = useProducts();

  // Calculate stock alerts from live data
  const lowStockProducts = retailProducts.filter(
    (p) => p.stock > 0 && p.stock <= p.lowStockThreshold
  );
  const outOfStockProducts = retailProducts.filter((p) => p.stock === 0);
  return (
    <PageLayout activeTab="dashboard" onNavigate={onNavigate}>
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Store Overview</h1>
            <p className="text-muted-foreground">
              {retailDashboardStats.todaySales} sales today
              {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
                <span className="text-warning ml-2">
                  • {lowStockProducts.length + outOfStockProducts.length} stock alerts
                </span>
              )}
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Revenue - BIGGEST */}
            <div className="lg:col-span-2">
              <StatsCard
                title="Today's Revenue"
                value={`$${retailDashboardStats.todayRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                change={retailDashboardStats.revenueChange}
                icon={<DollarSign className="w-6 h-6" />}
                description={`↑ ${Math.round(retailDashboardStats.revenueChange)}% from yesterday`}
                isLarge={true}
              />
            </div>

            {/* Sales count */}
            <StatsCard
              title="Sales Today"
              value={retailDashboardStats.todaySales}
              change={retailDashboardStats.salesChange}
              icon={<ShoppingCart className="w-5 h-5" />}
              description={`${retailDashboardStats.itemsSold} items sold`}
            />

            {/* Stock alerts */}
            <StatsCard
              title="Stock Alerts"
              value={retailDashboardStats.lowStockItems + retailDashboardStats.outOfStockItems}
              icon={<AlertTriangle className="w-5 h-5" />}
              description={`${retailDashboardStats.outOfStockItems} out of stock`}
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
                            ${sale.total.toFixed(2)}
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
              monthlyData={weeklySalesData}
            />
            <TopSellingChart data={topSellingChartData} />
          </div>
    </PageLayout>
  );
}
