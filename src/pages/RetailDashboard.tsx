import { useMemo, useState } from 'react';
import { PageLayout } from '@/components/pos/PageLayout';
import { RetailSalesRevenueSection } from '@/components/dashboard/retail/RetailSalesRevenueSection';
import { StatusChip } from '@/components/ui/StatusChip';
import { cn } from '@/lib/utils';
import { useProducts } from '@/hooks/useProducts';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { formatKES, formatKESAmount } from '@/lib/formatKES';
import {
  formatDateWithWeekday,
  formatRecentSaleTime,
  formatSyncedDateTime,
} from '@/lib/formatDate';
import { useAuth } from '@/context/AuthContext';
import { getStockStatus } from '@/lib/stockStatus';
import {
  addToPurchaseDraft,
  getPurchaseDraftCount,
  suggestReorderQty,
} from '@/lib/purchaseDraft';
import { toast } from 'sonner';
import type { Product } from '@/hooks/useProducts';
import type { TopSellingItem } from '@/data/dashboardData';

interface RetailDashboardProps {
  onNavigate: (tab: string) => void;
}

const OUTLINED_BTN =
  'focus-ring inline-flex min-h-[var(--tap-min)] items-center justify-center rounded-[var(--radius)] border border-hairline bg-surface px-4 text-sm font-semibold text-ink active:scale-[0.98]';

const ACCENT_BTN =
  'focus-ring inline-flex min-h-[var(--tap-min)] items-center justify-center rounded-[var(--radius)] bg-primary px-4 text-sm font-semibold text-primary-foreground active:scale-[0.98]';

const ACCENT_BTN_FULL =
  'focus-ring inline-flex min-h-[var(--tap-min)] w-full items-center justify-center rounded-[var(--radius)] bg-primary px-4 text-sm font-semibold text-primary-foreground active:scale-[0.98]';

function RuledPlaceholderRows({ count = 4 }: { count?: number }) {
  return (
    <div className="divide-y divide-hairline border-y border-hairline">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex min-h-[var(--tap-min)] items-center gap-3 py-2">
          <div className="h-3 flex-1 max-w-[40%] rounded-sm bg-hairline/80" aria-hidden />
          <div className="ml-auto h-3 w-16 rounded-sm bg-hairline/60" aria-hidden />
        </div>
      ))}
    </div>
  );
}

function formatStockLeft(product: Product): string {
  const unit = (product.unit || 'pcs').toUpperCase();
  const stock = product.stock;
  const formatted =
    Number.isInteger(stock) || Math.abs(stock % 1) < 1e-9
      ? String(stock)
      : String(stock);
  return `${formatted} ${unit} left`;
}

export default function RetailDashboard({ onNavigate }: RetailDashboardProps) {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'manager';
  const { retailProducts, loading: productsLoading } = useProducts();
  const [, setPurchaseDraftCount] = useState(() => getPurchaseDraftCount());
  const [markedProductIds, setMarkedProductIds] = useState<Set<string>>(() => new Set());
  const {
    loading: statsLoading,
    error,
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
  const today = useMemo(() => new Date(), []);

  const lowStockProducts = retailProducts.filter(
    (p) => p.stock > 0 && p.stock <= p.lowStockThreshold,
  );
  const outOfStockProducts = retailProducts.filter((p) => p.stock === 0);

  const alertProducts = useMemo(() => {
    return [...outOfStockProducts, ...lowStockProducts];
  }, [outOfStockProducts, lowStockProducts]);

  const stockAlertCount = alertProducts.length;
  const visibleAlerts = alertProducts.slice(0, 5);

  const handleMarkForPurchase = (product: Product) => {
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

  const revenueComparison = useMemo(() => {
    if (loading) return null;
    const current = retailStats.todayRevenue;
    const previous = retailStats.yesterdayRevenue;
    if (typeof previous === 'number') {
      return `${formatKES(previous)} yesterday`;
    }
    const change = retailStats.revenueChange;
    if (change === 0 || Math.abs(change) < 0.05) return null;
    const estimatedPrevious =
      change !== -100 ? current / (1 + change / 100) : 0;
    if (estimatedPrevious > 0 && estimatedPrevious < current * 0.1) return null;
    return `${change >= 0 ? '+' : ''}${Math.round(change)}% vs yesterday`;
  }, [loading, retailStats]);

  const topFiveItems: TopSellingItem[] = topSellingItems.slice(0, 5);
  const topItemQty = topFiveItems[0]?.quantity ?? 0;

  const recentFive = recentSales.slice(0, 5);

  const headerPrimaryActions = (
    <>
      <button type="button" className={ACCENT_BTN} onClick={() => onNavigate('pos')}>
        New sale
      </button>
      {canManage ? (
        <button
          type="button"
          className={OUTLINED_BTN}
          onClick={() => onNavigate('shop-day')}
        >
          Shop Day Close
        </button>
      ) : null}
    </>
  );

  const mobileDashboardActions = (
    <div className="flex min-w-0 flex-col gap-3 md:hidden">
      <button type="button" className={ACCENT_BTN_FULL} onClick={() => onNavigate('pos')}>
        New sale
      </button>
      {canManage ? (
        <button
          type="button"
          className={cn(OUTLINED_BTN, 'w-full')}
          onClick={() => onNavigate('shop-day')}
        >
          Shop Day Close
        </button>
      ) : null}
    </div>
  );

  return (
    <PageLayout activeTab="dashboard" onNavigate={onNavigate}>
      <div className="mx-auto flex w-full min-w-0 max-w-[1280px] flex-col gap-6 md:gap-4">
        <header className="order-1 border-b border-hairline pb-6 md:pb-4">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="min-w-0 text-2xl font-bold text-ink md:text-3xl">Today</h1>
              <div className="mt-1 flex min-w-0 items-center gap-2">
                {loading ? (
                  <div className="h-4 min-w-0 max-w-xs flex-1 rounded-sm bg-hairline/80" aria-hidden />
                ) : (
                  <p className="min-w-0 text-sm text-ink-2">
                    {formatDateWithWeekday(today)}
                    {' · '}
                    Synced{' '}
                    {lastSyncedAt ? formatSyncedDateTime(lastSyncedAt) : 'Not synced yet'}
                  </p>
                )}
                <button
                  type="button"
                  onClick={refetch}
                  disabled={statsLoading}
                  className={cn(
                    'focus-ring inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] border border-hairline bg-surface text-ink active:scale-[0.98]',
                    '[@media(pointer:coarse)]:h-12 [@media(pointer:coarse)]:w-12',
                  )}
                  title="Refresh dashboard"
                  aria-label="Refresh dashboard"
                >
                  <RefreshCw
                    className={cn('h-5 w-5', statsLoading && 'motion-safe:animate-spin')}
                    aria-hidden
                  />
                </button>
              </div>
            </div>
            <div className="hidden shrink-0 flex-wrap items-center justify-end gap-2 md:flex">
              {headerPrimaryActions}
            </div>
          </div>
        </header>

        {error && !loading ? (
          <div
            className="order-2 flex flex-wrap items-center gap-3 border-b border-hairline pb-4 text-sm text-ink"
            role="alert"
          >
            <span className="inline-flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0 text-fail" aria-hidden />
              {error}
            </span>
            <button type="button" className={OUTLINED_BTN} onClick={() => refetch()}>
              Retry
            </button>
          </div>
        ) : null}

        {/* Takings hero — before actions on phone */}
        <section
          aria-labelledby="takings-heading"
          className="order-3 border-b border-hairline pb-6 md:order-2 md:pb-4"
        >
          {loading ? (
            <div className="space-y-3">
              <div className="h-4 w-28 rounded-sm bg-hairline/80" aria-hidden />
              <div className="h-12 w-48 rounded-sm bg-hairline/70 md:h-14" aria-hidden />
              <div className="h-3 w-36 rounded-sm bg-hairline/60" aria-hidden />
            </div>
          ) : (
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <p id="takings-heading" className="text-sm font-semibold text-ink-2">
                  Takings today
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-ink-2 md:text-base">KES</span>
                  <span className="font-sans text-[40px] font-semibold leading-none tracking-tight text-ink tabular-nums md:text-[56px]">
                    {formatKESAmount(retailStats.todayRevenue)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-ink-2">
                  {retailStats.todaySales} sales · {retailStats.itemsSold} items sold
                </p>
                {revenueComparison ? (
                  <p className="mt-1 text-sm text-ink-2">{revenueComparison}</p>
                ) : null}
              </div>
            </div>
          )}
        </section>

        <div className="order-4 min-w-0 md:order-3">{mobileDashboardActions}</div>

        <div className="order-5 grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:gap-8">
          {/* Left column */}
          <div className="min-w-0 space-y-6 md:rounded-[var(--radius-panel)] md:border md:border-hairline md:bg-surface md:p-6">
            {/* Needs attention */}
            {!loading && stockAlertCount > 0 ? (
              <section aria-labelledby="needs-attention-heading">
                <div className="mb-4 flex min-w-0 flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
                  <h2
                    id="needs-attention-heading"
                    className="min-w-0 text-lg font-semibold text-ink"
                  >
                    Needs attention{' '}
                    <span className="font-normal text-ink-2">({stockAlertCount} items)</span>
                  </h2>
                  <div className="flex min-w-0 flex-wrap items-center justify-start gap-3 md:justify-end">
                    <button
                      type="button"
                      className={cn(OUTLINED_BTN, 'px-3 text-xs')}
                      onClick={handleOpenPurchases}
                    >
                      Create PO
                    </button>
                    <button
                      type="button"
                      className="focus-ring min-h-[var(--tap-min)] text-sm font-semibold text-primary underline-offset-2 hover:underline"
                      onClick={() => onNavigate('inventory')}
                    >
                      Restock
                    </button>
                  </div>
                </div>
                <ul className="divide-y divide-hairline border-y border-hairline">
                  {visibleAlerts.map((product) => {
                    const status = getStockStatus(product);
                    return (
                      <li key={product.id}>
                        <div className="grid min-h-[72px] min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,auto)] grid-rows-[auto_auto] items-center gap-x-2 gap-y-1 py-2 md:hidden">
                          <p
                            className="col-start-1 row-start-1 min-w-0 truncate text-sm font-semibold text-ink"
                            title={product.name}
                          >
                            {product.name}
                          </p>
                          <button
                            type="button"
                            className={cn(
                              OUTLINED_BTN,
                              'col-start-2 row-span-2 row-start-1 max-w-full shrink px-2 text-xs',
                            )}
                            onClick={() => handleMarkForPurchase(product)}
                            disabled={markedProductIds.has(product.id)}
                          >
                            {markedProductIds.has(product.id) ? 'Added' : 'Mark for PO'}
                          </button>
                          <div className="col-start-1 row-start-2 flex min-w-0 flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-ink-2 num">
                              {formatStockLeft(product)}
                            </span>
                            {status ? <StatusChip status={status} size="sm" /> : null}
                          </div>
                        </div>
                        <div className="hidden min-h-[var(--tap-min)] flex-row items-center justify-between gap-2 py-3 md:flex">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-ink">{product.name}</p>
                            <p className="font-mono text-xs text-ink-2 num">
                              {formatStockLeft(product)}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {status ? <StatusChip status={status} size="sm" /> : null}
                            <button
                              type="button"
                              className={cn(OUTLINED_BTN, 'px-3 text-xs')}
                              onClick={() => handleMarkForPurchase(product)}
                              disabled={markedProductIds.has(product.id)}
                            >
                              {markedProductIds.has(product.id) ? 'Added' : 'Mark for PO'}
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {stockAlertCount > 5 ? (
                  <button
                    type="button"
                    className="focus-ring mt-3 min-h-[var(--tap-min)] text-sm font-semibold text-primary underline-offset-2 hover:underline"
                    onClick={() => onNavigate('inventory')}
                  >
                    View all {stockAlertCount}
                  </button>
                ) : null}
              </section>
            ) : loading ? (
              <div>
                <div className="mb-4 h-5 w-40 rounded-sm bg-hairline/80" aria-hidden />
                <RuledPlaceholderRows count={3} />
              </div>
            ) : null}

            {/* Recent sales */}
            <section
              aria-labelledby="recent-sales-heading"
              className={cn(stockAlertCount > 0 || loading ? 'border-t border-hairline pt-6' : '')}
            >
              <h2 id="recent-sales-heading" className="mb-4 text-lg font-semibold text-ink">
                Recent sales
              </h2>
              {loading ? (
                <RuledPlaceholderRows count={5} />
              ) : recentFive.length === 0 ? (
                <p className="text-sm text-ink-2">No sales yet today.</p>
              ) : (
                <>
                  <ul className="divide-y divide-hairline border-y border-hairline">
                    {recentFive.map((sale) => (
                      <li key={sale.id} className="min-w-0 py-3">
                        <div className="flex min-w-0 items-center justify-between gap-3">
                          <span className="min-w-0 truncate text-sm font-medium text-ink">
                            {sale.customerName || 'Walk-in'}
                          </span>
                          <span className="shrink-0 font-mono text-sm font-semibold text-ink num">
                            {formatKES(sale.total)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-ink-2">
                          {formatRecentSaleTime(sale.createdAt, today)}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="focus-ring mt-3 min-h-[var(--tap-min)] text-sm font-semibold text-primary underline-offset-2 hover:underline"
                    onClick={() => onNavigate('order-history')}
                  >
                    View all
                  </button>
                </>
              )}
            </section>
          </div>

          {/* Right column */}
          <div className="min-w-0 space-y-6 md:rounded-[var(--radius-panel)] md:border md:border-hairline md:bg-surface md:p-6">
            {loading ? (
              <>
                <div className="space-y-3">
                  <div className="h-5 w-36 rounded-sm bg-hairline/80" aria-hidden />
                  <div className="h-[160px] rounded-sm border border-hairline bg-hairline/30 md:h-[240px]" aria-hidden />
                </div>
                <div className="border-t border-hairline pt-6">
                  <div className="mb-4 h-5 w-40 rounded-sm bg-hairline/80" aria-hidden />
                  <RuledPlaceholderRows count={5} />
                </div>
              </>
            ) : (
              <>
                <RetailSalesRevenueSection
                  dailyData={dailySalesData}
                  weeklyData={weeklySalesData}
                  monthlyData={monthlySalesData}
                />

                <section
                  aria-labelledby="top-selling-heading"
                  className="border-t border-hairline pt-6"
                >
                  <h2 id="top-selling-heading" className="mb-4 text-lg font-semibold text-ink">
                    Top selling items
                  </h2>
                  {topFiveItems.length === 0 ? (
                    <p className="text-sm text-ink-2">No top sellers yet today.</p>
                  ) : (
                    <ul className="divide-y divide-hairline border-y border-hairline">
                      {topFiveItems.map((item) => {
                        const share =
                          topItemQty > 0 ? (item.quantity / topItemQty) * 100 : 0;
                        return (
                          <li key={item.id} className="py-3">
                            <div className="mb-2 flex items-baseline justify-between gap-3">
                              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                                {item.name}
                              </span>
                              <span className="font-mono text-sm font-semibold text-ink num">
                                {item.quantity}
                              </span>
                            </div>
                            <div
                              className="h-1.5 w-full rounded-full bg-hairline"
                              role="presentation"
                            >
                              <div
                                className="h-full rounded-full bg-ink-2"
                                style={{ width: `${share}%` }}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
