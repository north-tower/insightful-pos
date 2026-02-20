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
import {
  dashboardStats,
  salesData,
  dailySalesData,
  monthlySalesData,
  topSellingItems,
  revenueBreakdown,
  recentOrders,
  tableTurnoverData,
  peakHoursData,
} from '@/data/dashboardData';
import { DollarSign, ShoppingCart, Users, Table2, TrendingUp } from 'lucide-react';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

function DashboardContent({ onNavigate }: DashboardProps) {
  return (
    <PageLayout activeTab="dashboard" onNavigate={onNavigate}>
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Service Overview</h1>
            <p className="text-muted-foreground">{dashboardStats.activeTables} tables active</p>
          </div>

          {/* Stats Cards - Broken grid, Active Tables is biggest */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            {/* Active Tables - BIGGEST, spans 2 columns on large screens */}
            <div className="md:col-span-2 lg:col-span-2">
              <StatsCard
                title="Tables Active"
                value={dashboardStats.activeTables}
                icon={<Table2 className="w-6 h-6" />}
                description={`${dashboardStats.customerCount} covers`}
                isLarge={true}
              />
            </div>
            
            {/* Covers Today */}
            <StatsCard
              title="Covers Today"
              value={dashboardStats.todayOrders}
              change={dashboardStats.ordersChange}
              icon={<ShoppingCart className="w-5 h-5" />}
              description={dashboardStats.ordersChange ? `↑ ${Math.round(dashboardStats.todayOrders * dashboardStats.ordersChange / 100)} from yesterday` : undefined}
            />
            
            {/* Revenue - smaller */}
            <StatsCard
              title="Revenue"
              value={`$${dashboardStats.todayRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
              change={dashboardStats.revenueChange}
              icon={<DollarSign className="w-5 h-5" />}
              description={dashboardStats.revenueChange ? `↑ ${Math.round(dashboardStats.revenueChange)}%` : undefined}
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
              data={salesData} 
              dailyData={dailySalesData}
              weeklyData={salesData}
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

