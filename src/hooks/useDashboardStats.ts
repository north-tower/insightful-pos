import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useBusinessMode } from '@/context/BusinessModeContext';
import { getCachedSnapshot, setCachedSnapshot } from '@/lib/offline/cache';
import type {
  DashboardStats,
  SalesData,
  TopSellingItem,
  RevenueBreakdown,
  RecentOrder,
  TableTurnover,
  PeakHoursData,
} from '@/data/dashboardData';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Start of a given day in ISO format (local time → UTC). */
function startOfDay(d: Date): string {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s.toISOString();
}

/** End of a given day in ISO format (local time → UTC). */
function endOfDay(d: Date): string {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e.toISOString();
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

// ─── Raw types coming from Supabase ────────────────────────────────────────

interface RawOrder {
  id: string;
  order_number: string;
  order_type: string;
  table_number: string | null;
  customer_name: string | null;
  total: number;
  status: string;
  payment_status: string;
  created_at: string;
  completed_at: string | null;
}

interface RawOrderItem {
  product_name: string;
  product_id: string | null;
  quantity: number;
  line_total: number;
  order_id: string;
}

interface RawPayment {
  order_id: string;
  method: 'cash' | 'card' | 'qr';
  amount: number;
}

interface DashboardOfflineSnapshot {
  todayOrders: RawOrder[];
  yesterdayOrders: RawOrder[];
  last30Orders: RawOrder[];
  todayItems: RawOrderItem[];
  todayPayments: RawPayment[];
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useDashboardStats() {
  const { mode } = useBusinessMode();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Raw data slices
  const [todayOrders, setTodayOrders] = useState<RawOrder[]>([]);
  const [yesterdayOrders, setYesterdayOrders] = useState<RawOrder[]>([]);
  const [last30Orders, setLast30Orders] = useState<RawOrder[]>([]);
  const [todayItems, setTodayItems] = useState<RawOrderItem[]>([]);
  const [todayPayments, setTodayPayments] = useState<RawPayment[]>([]);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const offlineCacheKey = `snapshot:dashboard:${mode}`;

    const cached = await getCachedSnapshot<DashboardOfflineSnapshot>(offlineCacheKey);
    if (cached) {
      setTodayOrders(cached.todayOrders || []);
      setYesterdayOrders(cached.yesterdayOrders || []);
      setLast30Orders(cached.last30Orders || []);
      setTodayItems(cached.todayItems || []);
      setTodayPayments(cached.todayPayments || []);
      setLoading(false);
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (!cached) setError('Offline and no cached dashboard data available yet');
      return;
    }

    const today = new Date();
    const yesterday = daysAgo(1);
    const thirtyDaysAgo = daysAgo(30);

    try {
      // 1. Today's orders
      const { data: todayData, error: e1 } = await supabase
        .from('orders')
        .select('id, order_number, order_type, table_number, customer_name, total, status, payment_status, created_at, completed_at')
        .eq('business_mode', mode)
        .gte('created_at', startOfDay(today))
        .lte('created_at', endOfDay(today))
        .neq('status', 'voided')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (e1) throw e1;

      // 2. Yesterday's orders (for change %)
      const { data: yData, error: e2 } = await supabase
        .from('orders')
        .select('id, total, status, payment_status')
        .eq('business_mode', mode)
        .gte('created_at', startOfDay(yesterday))
        .lte('created_at', endOfDay(yesterday))
        .neq('status', 'voided')
        .neq('status', 'cancelled');

      if (e2) throw e2;

      // 3. Last 30 days orders (for charts)
      const { data: monthData, error: e3 } = await supabase
        .from('orders')
        .select('id, order_number, order_type, total, status, payment_status, created_at')
        .eq('business_mode', mode)
        .gte('created_at', startOfDay(thirtyDaysAgo))
        .neq('status', 'voided')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: true });

      if (e3) throw e3;

      // 4. Today's order items (for top selling) + payments (for recent sales)
      const todayIds = (todayData || []).map((o: any) => o.id);
      let itemsData: RawOrderItem[] = [];
      let paymentsData: RawPayment[] = [];
      if (todayIds.length > 0) {
        const [itemsResult, paymentsResult] = await Promise.all([
          supabase
            .from('order_items')
            .select('product_name, product_id, quantity, line_total, order_id')
            .in('order_id', todayIds),
          supabase
            .from('payments')
            .select('order_id, method, amount')
            .in('order_id', todayIds),
        ]);
        if (itemsResult.error) throw itemsResult.error;
        if (paymentsResult.error) throw paymentsResult.error;
        itemsData = (itemsResult.data || []).map((i: any) => ({
          product_name: i.product_name,
          product_id: i.product_id,
          quantity: i.quantity,
          line_total: Number(i.line_total),
          order_id: i.order_id,
        }));
        paymentsData = (paymentsResult.data || []).map((p: any) => ({
          order_id: p.order_id,
          method: p.method,
          amount: Number(p.amount),
        }));
      }

      setTodayOrders((todayData || []).map((o: any) => ({ ...o, total: Number(o.total) })));
      setYesterdayOrders((yData || []).map((o: any) => ({ ...o, total: Number(o.total) })));
      setLast30Orders((monthData || []).map((o: any) => ({ ...o, total: Number(o.total) })));
      setTodayItems(itemsData);
      setTodayPayments(paymentsData);

      await setCachedSnapshot<DashboardOfflineSnapshot>(offlineCacheKey, {
        todayOrders: (todayData || []).map((o: any) => ({ ...o, total: Number(o.total) })),
        yesterdayOrders: (yData || []).map((o: any) => ({ ...o, total: Number(o.total) })),
        last30Orders: (monthData || []).map((o: any) => ({ ...o, total: Number(o.total) })),
        todayItems: itemsData,
        todayPayments: paymentsData,
      });
    } catch (err: any) {
      console.error('Dashboard fetch failed:', err);
      if (!cached) {
        setError(err.message || 'Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // ── Computed: Stats Cards ────────────────────────────────────────────────

  const stats: DashboardStats = useMemo(() => {
    const paidToday = todayOrders.filter((o) => o.payment_status === 'paid');
    const todayRevenue = paidToday.reduce((s, o) => s + o.total, 0);
    const todayCount = todayOrders.length;
    const avgOrderValue = todayCount > 0 ? todayRevenue / todayCount : 0;

    // Active tables = distinct table_numbers with non-completed dine-in orders today
    const activeTableSet = new Set(
      todayOrders
        .filter((o) => o.table_number && o.status !== 'completed')
        .map((o) => o.table_number!),
    );
    const activeTables = activeTableSet.size;

    // Covers = total customers today (all orders)
    const customerCount = todayCount;

    // Yesterday comparison
    const paidYesterday = yesterdayOrders.filter((o: any) => o.payment_status === 'paid');
    const yesterdayRevenue = paidYesterday.reduce((s, o: any) => s + Number(o.total), 0);
    const yesterdayCount = yesterdayOrders.length;
    const yesterdayAvg = yesterdayCount > 0 ? yesterdayRevenue / yesterdayCount : 0;

    const revenueChange =
      yesterdayRevenue > 0
        ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
        : 0;
    const ordersChange =
      yesterdayCount > 0
        ? ((todayCount - yesterdayCount) / yesterdayCount) * 100
        : 0;
    const avgOrderValueChange =
      yesterdayAvg > 0
        ? ((avgOrderValue - yesterdayAvg) / yesterdayAvg) * 100
        : 0;

    return {
      todayRevenue,
      todayOrders: todayCount,
      averageOrderValue: avgOrderValue,
      activeTables,
      customerCount,
      revenueChange,
      ordersChange,
      avgOrderValueChange,
    };
  }, [todayOrders, yesterdayOrders]);

  // ── Computed: Sales Chart (daily hourly data) ────────────────────────────

  const dailySalesData: SalesData[] = useMemo(() => {
    const hourMap = new Map<number, { revenue: number; orders: number }>();
    for (const o of todayOrders) {
      const h = new Date(o.created_at).getHours();
      const prev = hourMap.get(h) || { revenue: 0, orders: 0 };
      prev.revenue += o.payment_status === 'paid' ? o.total : 0;
      prev.orders += 1;
      hourMap.set(h, prev);
    }

    // Build contiguous hours from first order to last (or 9 AM to current hour)
    const now = new Date();
    const startHour = 6; // start from 6 AM
    const endHour = Math.max(now.getHours(), 18); // at least up to 6 PM
    const result: SalesData[] = [];
    for (let h = startHour; h <= endHour; h++) {
      const data = hourMap.get(h) || { revenue: 0, orders: 0 };
      result.push({ date: formatHour(h), revenue: data.revenue, orders: data.orders });
    }
    return result;
  }, [todayOrders]);

  // ── Computed: Sales Chart (weekly data — last 7 days) ────────────────────

  const weeklySalesData: SalesData[] = useMemo(() => {
    const dayMap = new Map<string, { revenue: number; orders: number }>();
    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = daysAgo(i);
      const label = DAY_LABELS[d.getDay()];
      const key = d.toDateString();
      dayMap.set(key, { revenue: 0, orders: 0 });
    }

    for (const o of last30Orders) {
      const key = new Date(o.created_at).toDateString();
      if (dayMap.has(key)) {
        const prev = dayMap.get(key)!;
        prev.revenue += (o as any).payment_status === 'paid' ? o.total : 0;
        prev.orders += 1;
      }
    }

    const result: SalesData[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = daysAgo(i);
      const key = d.toDateString();
      const label = DAY_LABELS[d.getDay()];
      const data = dayMap.get(key) || { revenue: 0, orders: 0 };
      result.push({ date: label, revenue: data.revenue, orders: data.orders });
    }
    return result;
  }, [last30Orders]);

  // ── Computed: Sales Chart (monthly — last 4 weeks) ───────────────────────

  const monthlySalesData: SalesData[] = useMemo(() => {
    const weeks: { label: string; start: Date; end: Date }[] = [];
    for (let w = 3; w >= 0; w--) {
      const start = daysAgo(w * 7 + 6);
      const end = daysAgo(w * 7);
      weeks.push({ label: `Week ${4 - w}`, start, end });
    }

    return weeks.map(({ label, start, end }) => {
      const startStr = start.toDateString();
      const endStr = end.toDateString();
      let revenue = 0;
      let orders = 0;
      for (const o of last30Orders) {
        const d = new Date(o.created_at);
        if (d >= start && d <= end) {
          if ((o as any).payment_status === 'paid') revenue += o.total;
          orders += 1;
        }
      }
      return { date: label, revenue, orders };
    });
  }, [last30Orders]);

  // ── Computed: Top Selling Items ──────────────────────────────────────────

  const topSellingItems: TopSellingItem[] = useMemo(() => {
    const map = new Map<string, { quantity: number; revenue: number }>();
    for (const item of todayItems) {
      const key = item.product_name;
      const prev = map.get(key) || { quantity: 0, revenue: 0 };
      prev.quantity += item.quantity;
      prev.revenue += item.line_total;
      map.set(key, prev);
    }

    return Array.from(map.entries())
      .map(([name, data], i) => ({
        id: String(i),
        name,
        quantity: data.quantity,
        revenue: data.revenue,
        category: '',
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8);
  }, [todayItems]);

  // ── Computed: Revenue Breakdown by order type ────────────────────────────

  const revenueBreakdown: RevenueBreakdown[] = useMemo(() => {
    const typeMap = new Map<string, number>();
    const paidToday = todayOrders.filter((o) => o.payment_status === 'paid');
    for (const o of paidToday) {
      const t = o.order_type as string;
      typeMap.set(t, (typeMap.get(t) || 0) + o.total);
    }

    const totalRev = paidToday.reduce((s, o) => s + o.total, 0);
    const types: Array<'dine-in' | 'takeaway' | 'delivery'> = ['dine-in', 'takeaway', 'delivery'];
    return types.map((type) => {
      const revenue = typeMap.get(type) || 0;
      return {
        type,
        revenue,
        percentage: totalRev > 0 ? (revenue / totalRev) * 100 : 0,
      };
    });
  }, [todayOrders]);

  // ── Computed: Recent Orders ──────────────────────────────────────────────

  const recentOrders: RecentOrder[] = useMemo(() => {
    // todayOrders is already sorted desc by created_at
    return todayOrders.slice(0, 6).map((o) => {
      // Count items for this order
      const itemCount = todayItems.filter((i) => i.order_id === o.id)
        .reduce((s, i) => s + i.quantity, 0);

      return {
        id: o.order_number,
        tableNumber: o.table_number || undefined,
        customerName: o.customer_name || 'Walk-in',
        total: o.total,
        items: itemCount || 0,
        status: o.status as RecentOrder['status'],
        time: timeAgo(o.created_at),
        type: o.order_type as RecentOrder['type'],
      };
    });
  }, [todayOrders, todayItems]);

  // ── Computed: Table Turnover (restaurant only) ───────────────────────────

  const tableTurnoverData: TableTurnover[] = useMemo(() => {
    // We don't have "area" in the orders table, so we compute overall turnover
    // from dine-in orders today
    const dineInOrders = todayOrders.filter(
      (o) => o.order_type === 'dine-in' && o.table_number,
    );
    const allTables = new Set(dineInOrders.map((o) => o.table_number!));
    const activeTables = new Set(
      dineInOrders
        .filter((o) => o.status !== 'completed')
        .map((o) => o.table_number!),
    );

    // Compute average turnaround for completed dine-in orders
    const completed = dineInOrders.filter(
      (o) => o.status === 'completed' && o.completed_at,
    );
    const avgTime =
      completed.length > 0
        ? completed.reduce((s, o) => {
            const dur = new Date(o.completed_at!).getTime() - new Date(o.created_at).getTime();
            return s + dur / 60000;
          }, 0) / completed.length
        : 0;

    const totalTableCount = Math.max(allTables.size, 1);
    const occupiedCount = activeTables.size;
    const turnoverRate = (occupiedCount / totalTableCount) * 100;

    return [
      {
        area: 'All Areas',
        totalTables: totalTableCount,
        occupiedTables: occupiedCount,
        turnoverRate,
        avgTurnoverTime: Math.round(avgTime),
      },
    ];
  }, [todayOrders]);

  // ── Computed: Peak Hours ─────────────────────────────────────────────────

  const peakHoursData: PeakHoursData[] = useMemo(() => {
    const hourMap = new Map<number, { orders: number; revenue: number }>();
    for (const o of todayOrders) {
      const h = new Date(o.created_at).getHours();
      const prev = hourMap.get(h) || { orders: 0, revenue: 0 };
      prev.orders += 1;
      prev.revenue += o.payment_status === 'paid' ? o.total : 0;
      hourMap.set(h, prev);
    }

    const startHour = 6;
    const endHour = Math.max(new Date().getHours(), 18);
    const result: PeakHoursData[] = [];
    for (let h = startHour; h <= endHour; h++) {
      const data = hourMap.get(h) || { orders: 0, revenue: 0 };
      result.push({ hour: formatHour(h), orders: data.orders, revenue: data.revenue });
    }
    return result;
  }, [todayOrders]);

  // ── Computed: Retail-specific stats ───────────────────────────────────

  const retailStats = useMemo(() => {
    const paidToday = todayOrders.filter((o) => o.payment_status === 'paid');
    const todayRevenue = paidToday.reduce((s, o) => s + o.total, 0);
    const todaySales = todayOrders.length;
    const avgSaleValue = todaySales > 0 ? todayRevenue / todaySales : 0;
    const itemsSold = todayItems.reduce((s, i) => s + i.quantity, 0);

    // Yesterday comparison
    const paidYesterday = yesterdayOrders.filter((o: any) => o.payment_status === 'paid');
    const yesterdayRevenue = paidYesterday.reduce((s, o: any) => s + Number(o.total), 0);
    const yesterdaySales = yesterdayOrders.length;

    const revenueChange =
      yesterdayRevenue > 0
        ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
        : 0;
    const salesChange =
      yesterdaySales > 0
        ? ((todaySales - yesterdaySales) / yesterdaySales) * 100
        : 0;

    return {
      todayRevenue,
      todaySales,
      averageSaleValue: avgSaleValue,
      itemsSold,
      lowStockItems: 0, // filled from useProducts in the page
      outOfStockItems: 0,
      revenueChange,
      salesChange,
    };
  }, [todayOrders, yesterdayOrders, todayItems]);

  // ── Computed: Recent sales (retail-oriented, with payment method) ─────

  interface RecentSale {
    id: string;
    saleNumber: string;
    customerName: string;
    total: number;
    items: number;
    paymentMethod: 'cash' | 'card' | 'qr';
    time: string;
  }

  const recentSales: RecentSale[] = useMemo(() => {
    return todayOrders.slice(0, 6).map((o) => {
      const itemCount = todayItems
        .filter((i) => i.order_id === o.id)
        .reduce((s, i) => s + i.quantity, 0);

      // Pick the dominant payment method for this order
      const orderPayments = todayPayments.filter((p) => p.order_id === o.id);
      let paymentMethod: 'cash' | 'card' | 'qr' = 'cash';
      if (orderPayments.length > 0) {
        // Use the method with the highest amount
        orderPayments.sort((a, b) => b.amount - a.amount);
        paymentMethod = orderPayments[0].method;
      }

      return {
        id: o.id,
        saleNumber: o.order_number,
        customerName: o.customer_name || 'Walk-in',
        total: o.total,
        items: itemCount || 0,
        paymentMethod,
        time: timeAgo(o.created_at),
      };
    });
  }, [todayOrders, todayItems, todayPayments]);

  // ── Return ──────────────────────────────────────────────────────────────

  return {
    loading,
    error,
    refetch: fetch,

    // Restaurant dashboard
    stats,
    dailySalesData,
    weeklySalesData,
    monthlySalesData,
    topSellingItems,
    revenueBreakdown,
    recentOrders,
    tableTurnoverData,
    peakHoursData,

    // Retail dashboard
    retailStats,
    recentSales,
  };
}
