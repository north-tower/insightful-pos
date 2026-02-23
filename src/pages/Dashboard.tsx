import { PageLayout } from '@/components/pos/PageLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { TopSellingChart } from '@/components/dashboard/TopSellingChart';
import { RevenueBreakdownChart } from '@/components/dashboard/RevenueBreakdown';
import { RecentOrders } from '@/components/dashboard/RecentOrders';
import { TableTurnoverMetrics } from '@/components/dashboard/TableTurnover';
import { PeakHoursChart } from '@/components/dashboard/PeakHoursChart';
import { IncomingOrdersQueue } from '@/components/order/IncomingOrdersQueue';
import { ActiveCustomerOrders } from '@/components/order/ActiveCustomerOrders';
import { OrderQueueProvider } from '@/context/OrderQueueContext';
import { formatCurrency } from '@/lib/currency';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { DollarSign, ShoppingCart, Users, Table2, TrendingUp, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

function DashboardContent({ onNavigate }: DashboardProps) {
  const {
    loading,
    stats,
    dailySalesData,
    weeklySalesData,
    monthlySalesData,
    topSellingItems,
    revenueBreakdown,
    recentOrders,
    tableTurnoverData,
    peakHoursData,
    refetch,
  } = useDashboardStats();

  return (
    <PageLayout activeTab="dashboard" onNavigate={onNavigate}>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Service Overview</h1>
          <p className="text-muted-foreground">
            {loading ? 'Loading…' : `${stats.activeTables} tables active`}
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={refetch}
          disabled={loading}
          className="shrink-0"
          title="Refresh dashboard"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        {/* Active Tables */}
        <div className="md:col-span-2 lg:col-span-2">
          <StatsCard
            title="Tables Active"
            value={loading ? '—' : stats.activeTables}
            icon={<Table2 className="w-6 h-6" />}
            description={loading ? undefined : `${stats.customerCount} covers`}
            isLarge={true}
          />
        </div>

        {/* Orders Today */}
        <StatsCard
          title="Orders Today"
          value={loading ? '—' : stats.todayOrders}
          change={loading ? undefined : stats.ordersChange}
          icon={<ShoppingCart className="w-5 h-5" />}
          description={
            !loading && stats.ordersChange
              ? `${stats.ordersChange >= 0 ? '↑' : '↓'} ${Math.abs(Math.round(stats.ordersChange))}% from yesterday`
              : undefined
          }
        />

        {/* Revenue */}
        <StatsCard
          title="Revenue"
          value={loading ? '—' : formatCurrency(stats.todayRevenue)}
          change={loading ? undefined : stats.revenueChange}
          icon={<DollarSign className="w-5 h-5" />}
          description={
            !loading && stats.revenueChange
              ? `${stats.revenueChange >= 0 ? '↑' : '↓'} ${Math.abs(Math.round(stats.revenueChange))}% from yesterday`
              : undefined
          }
        />
      </div>

      {/* Incoming Orders & Active Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <IncomingOrdersQueue />
        <ActiveCustomerOrders />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <SalesChart
          data={weeklySalesData}
          dailyData={dailySalesData}
          weeklyData={weeklySalesData}
          monthlyData={monthlySalesData}
        />
        <RevenueBreakdownChart data={revenueBreakdown} />
      </div>

      {/* Second Row - Peak Hours & Table Turnover */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <PeakHoursChart data={peakHoursData} />
        <TableTurnoverMetrics data={tableTurnoverData} />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopSellingChart data={topSellingItems} />
        <RecentOrders orders={recentOrders} />
      </div>
    </PageLayout>
  );
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  return (
    <OrderQueueProvider>
      <DashboardContent onNavigate={onNavigate} />
    </OrderQueueProvider>
  );
}
