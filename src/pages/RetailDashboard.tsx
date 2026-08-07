import { useState } from 'react';
import { PageLayout } from '@/components/pos/PageLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { TopSellingChart } from '@/components/dashboard/TopSellingChart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useProducts } from '@/hooks/useProducts';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import {
  ShoppingCart,
  Package,
  AlertTriangle,
  CreditCard,
  Banknote,
  QrCode,
  Smartphone,
  XCircle,
  RefreshCw,
  ShoppingBag,
  Truck,
  ArrowRight,
  CalendarDays,
} from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { Button } from '@/components/ui/button';
import { useCompanySettings } from '@/context/BusinessSettingsContext';
import { useAuth } from '@/context/AuthContext';
import { ShopLogo } from '@/components/branding/ShopLogo';
import { getDisplaySku } from '@/lib/productSku';
import { CurrencyIcon } from '@/components/icons/CurrencyIcon';
import {
  addToPurchaseDraft,
  getPurchaseDraftCount,
  suggestReorderQty,
} from '@/lib/purchaseDraft';
import { toast } from 'sonner';

interface RetailDashboardProps {
  onNavigate: (tab: string) => void;
}

const paymentIcons = {
  cash: Banknote,
  card: CreditCard,
  qr: QrCode,
  mpesa: Smartphone,
};

function StatsCardSkeleton({ large = false }: { large?: boolean }) {
  return (
    <Card className={cn('border-l-4 bg-card dark:bg-gray-800 dark:border-gray-700', large ? 'border-warning' : 'border-border/60')}>
      <CardContent className={cn(large ? 'p-6 sm:p-8' : 'p-4 sm:p-5')}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className={cn(large ? 'h-10 w-40' : 'h-8 w-16')} />
            <Skeleton className="h-3 w-32" />
            {large && <Skeleton className="mt-2 h-12 w-full max-w-[200px]" />}
          </div>
          <Skeleton className={cn('shrink-0 rounded-lg', large ? 'h-14 w-14' : 'h-11 w-11')} />
        </div>
      </CardContent>
    </Card>
  );
}

function PanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card className="bg-card dark:bg-gray-800 dark:border-gray-700">
      <CardHeader className="pb-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-2 h-4 w-48" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3 rounded border border-border/60 p-3 dark:border-gray-700">
            <div className="flex flex-1 items-center gap-3">
              <Skeleton className="h-4 w-4 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <Card className="bg-card dark:bg-gray-800 dark:border-gray-700">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-14" />
            <Skeleton className="h-8 w-14" />
            <Skeleton className="h-8 w-14" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full rounded-md" />
      </CardContent>
    </Card>
  );
}

export default function RetailDashboard({ onNavigate }: RetailDashboardProps) {
  const { companyName, shopLogoUrl } = useCompanySettings();
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'manager';
  const { retailProducts, loading: productsLoading } = useProducts();
  const [purchaseDraftCount, setPurchaseDraftCount] = useState(() => getPurchaseDraftCount());
  const [markedProductIds, setMarkedProductIds] = useState<Set<string>>(() => new Set());
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

  const sparklineValues = weeklySalesData.map((d) => d.revenue);

  const handleMarkForPurchase = (product: (typeof retailProducts)[0]) => {
    const quantity = suggestReorderQty(product.stock, product.lowStockThreshold);
    addToPurchaseDraft({
      product_id: product.id,
      product_name: product.name,
      product_sku: product.sku || null,
      quantity,
      unit_cost: product.cost || 0,
    });
    setPurchaseDraftCount(getPurchaseDraftCount());
    setMarkedProductIds((prev) => new Set(prev).add(product.id));
    toast.success(`${product.name} added to purchase order`);
  };

  const handleOpenPurchases = () => {
    onNavigate('purchases');
  };

  const stockAlertCount = lowStockProducts.length + outOfStockProducts.length;

  return (
    <PageLayout activeTab="dashboard" onNavigate={onNavigate}>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          {shopLogoUrl && <ShopLogo size="lg" showFallback={false} className="hidden sm:block" />}
          <div className="min-w-0 space-y-1">
            <h1 className="truncate text-2xl font-bold text-foreground">
              {shopLogoUrl ? companyName : 'Store Overview'}
            </h1>
            {loading ? (
              <>
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-40" />
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {retailStats.todaySales} sales today
                  {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
                    <span className="ml-2 text-warning">
                      • {lowStockProducts.length + outOfStockProducts.length} stock alerts
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Last synced at{' '}
                  {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : 'Not synced yet'}
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('shop-day')}
              className="dark:border-gray-700 dark:bg-gray-800"
            >
              <CalendarDays className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Shop Day Close</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={refetch}
            disabled={statsLoading}
            className="shrink-0 dark:border-gray-700 dark:bg-gray-800"
            title="Refresh dashboard"
          >
            <RefreshCw className={`h-4 w-4 ${statsLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <>
            <div className="lg:col-span-2">
              <StatsCardSkeleton large />
            </div>
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </>
        ) : (
          <>
            <div className="lg:col-span-2">
              <StatsCard
                title="Today's Revenue"
                value={formatCurrency(retailStats.todayRevenue)}
                change={retailStats.revenueChange}
                icon={<CurrencyIcon className="h-6 w-6" />}
                description={
                  retailStats.revenueChange
                    ? `${retailStats.revenueChange >= 0 ? '↑' : '↓'} ${Math.abs(Math.round(retailStats.revenueChange))}% from yesterday`
                    : undefined
                }
                isLarge={true}
                sparklineData={sparklineValues}
              />
            </div>

            <StatsCard
              title="Sales Today"
              value={retailStats.todaySales}
              change={retailStats.salesChange}
              icon={<ShoppingCart className="h-5 w-5" />}
              description={`${retailStats.itemsSold} items sold`}
            />

            <StatsCard
              title="Stock Alerts"
              value={lowStockProducts.length + outOfStockProducts.length}
              icon={<AlertTriangle className="h-5 w-5" />}
              description={`${outOfStockProducts.length} out of stock`}
            />
          </>
        )}
      </div>

      {/* Stock Alerts + Recent Sales */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {loading ? (
          <>
            <PanelSkeleton rows={4} />
            <PanelSkeleton rows={4} />
          </>
        ) : (
          <>
            {/* Stock Alerts Panel */}
            <Card className="bg-card dark:bg-gray-800 dark:border-gray-700">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg font-semibold">Stock Alerts</CardTitle>
                    <CardDescription>Products needing attention</CardDescription>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {stockAlertCount > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="hidden sm:inline-flex"
                        onClick={() => onNavigate('inventory')}
                      >
                        Restock
                      </Button>
                    )}
                    {(purchaseDraftCount > 0 || stockAlertCount > 0) && (
                      <Button size="sm" onClick={handleOpenPurchases}>
                        <Truck className="mr-1.5 h-4 w-4" />
                        {purchaseDraftCount > 0 ? `Create PO (${purchaseDraftCount})` : 'Create PO'}
                      </Button>
                    )}
                    <Badge
                      variant="outline"
                      className={cn(
                        outOfStockProducts.length > 0
                          ? 'border-destructive/30 bg-destructive/10 text-destructive'
                          : lowStockProducts.length > 0
                            ? 'border-warning/30 bg-warning/10 text-warning'
                            : 'border-border bg-muted text-muted-foreground dark:border-gray-600',
                      )}
                    >
                      {stockAlertCount} alerts
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {outOfStockProducts.map((product) => {
                    const displaySku = getDisplaySku(product.sku);
                    return (
                      <div
                        key={product.id}
                        className="flex items-center justify-between gap-3 rounded border-l-4 border-destructive bg-destructive/5 p-3 dark:bg-destructive/10"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {product.name}
                            </p>
                            {displaySku ? (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                SKU: {displaySku}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => handleMarkForPurchase(product)}
                            disabled={markedProductIds.has(product.id)}
                          >
                            {markedProductIds.has(product.id) ? 'Added' : 'Mark for PO'}
                          </Button>
                          <Badge className="shrink-0 bg-destructive text-destructive-foreground text-xs hover:bg-destructive">
                            Out of Stock
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                  {lowStockProducts.map((product) => {
                    const displaySku = getDisplaySku(product.sku);
                    return (
                      <div
                        key={product.id}
                        className="flex items-center justify-between gap-3 rounded border-l-4 border-warning bg-warning/5 p-3 dark:bg-warning/10"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {product.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {displaySku ? (
                                <>
                                  SKU: {displaySku} • {product.stock} left
                                </>
                              ) : (
                                <>{product.stock} left</>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => handleMarkForPurchase(product)}
                            disabled={markedProductIds.has(product.id)}
                          >
                            {markedProductIds.has(product.id) ? 'Added' : 'Mark for PO'}
                          </Button>
                          <Badge className="shrink-0 border border-warning/30 bg-warning/15 text-warning text-xs hover:bg-warning/20">
                            Low Stock
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                  {lowStockProducts.length === 0 && outOfStockProducts.length === 0 && (
                    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                      <Package
                        className="mb-3 h-10 w-10 text-gray-400 dark:text-gray-500"
                        strokeWidth={1.5}
                      />
                      <p className="text-sm font-medium text-foreground">All stock levels healthy</p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Low and out-of-stock products will appear here
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Sales */}
            <Card className="bg-card dark:bg-gray-800 dark:border-gray-700">
              <CardHeader className="pb-4">
                <div>
                  <CardTitle className="text-lg font-semibold">Recent Sales</CardTitle>
                  <CardDescription>Latest transactions today</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentSales.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                      <ShoppingCart
                        className="mb-3 h-10 w-10 text-gray-400 dark:text-gray-500"
                        strokeWidth={1.5}
                      />
                      <p className="text-sm font-medium text-foreground">
                        No sales recorded yet today
                      </p>
                      <p className="mt-1 max-w-xs text-sm text-gray-500 dark:text-gray-400">
                        Sales will appear here once you make your first transaction
                      </p>
                      <Button className="mt-4" onClick={() => onNavigate('pos')}>
                        <ShoppingBag className="mr-2 h-4 w-4" />
                        Go to POS
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    recentSales.map((sale) => {
                      const PayIcon =
                        paymentIcons[sale.paymentMethod as keyof typeof paymentIcons] ?? Banknote;
                      return (
                        <div
                          key={sale.id}
                          className="flex items-center justify-between gap-3 rounded border border-border p-3 transition-colors hover:bg-muted/50 dark:border-gray-700 dark:hover:bg-gray-700/50"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">
                                #{sale.saleNumber}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {sale.items} items
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                              {sale.customerName && <span>{sale.customerName}</span>}
                              <span>•</span>
                              <span>{sale.time}</span>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <PayIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                            <span className="text-sm font-bold text-foreground">
                              {formatCurrency(sale.total)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Charts */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {loading ? (
          <>
            <ChartSkeleton />
            <ChartSkeleton />
          </>
        ) : (
          <>
            <SalesChart
              data={weeklySalesData}
              dailyData={dailySalesData}
              weeklyData={weeklySalesData}
              monthlyData={monthlySalesData}
            />
            <TopSellingChart data={topSellingItems} />
          </>
        )}
      </div>
    </PageLayout>
  );
}
