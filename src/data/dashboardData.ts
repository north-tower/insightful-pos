// Dashboard data types and mock data

export interface DashboardStats {
  todayRevenue: number;
  todayOrders: number;
  averageOrderValue: number;
  activeTables: number;
  customerCount: number;
  revenueChange: number; // percentage change
  ordersChange: number;
  avgOrderValueChange: number;
}

export interface SalesData {
  date: string;
  revenue: number;
  orders: number;
}

export interface TopSellingItem {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
  category: string;
}

export interface RevenueBreakdown {
  type: 'dine-in' | 'takeaway' | 'delivery';
  revenue: number;
  percentage: number;
}

export interface RecentOrder {
  id: string;
  tableNumber?: string;
  customerName: string;
  total: number;
  items: number;
  status: 'pending' | 'preparing' | 'ready' | 'completed';
  time: string;
  type: 'dine-in' | 'takeaway' | 'delivery';
}

export interface TableTurnover {
  area: string;
  totalTables: number;
  occupiedTables: number;
  turnoverRate: number; // percentage
  avgTurnoverTime: number; // in minutes
}

export interface PeakHoursData {
  hour: string;
  orders: number;
  revenue: number;
}

// Mock dashboard data
export const dashboardStats: DashboardStats = {
  todayRevenue: 12450.75,
  todayOrders: 142,
  averageOrderValue: 87.68,
  activeTables: 18,
  customerCount: 128,
  revenueChange: 12.5,
  ordersChange: 8.3,
  avgOrderValueChange: 4.2,
};

// Weekly data (last 7 days)
export const salesData: SalesData[] = [
  { date: 'Mon', revenue: 8500, orders: 98 },
  { date: 'Tue', revenue: 9200, orders: 105 },
  { date: 'Wed', revenue: 8800, orders: 102 },
  { date: 'Thu', revenue: 10200, orders: 118 },
  { date: 'Fri', revenue: 11500, orders: 132 },
  { date: 'Sat', revenue: 13800, orders: 158 },
  { date: 'Sun', revenue: 12450, orders: 142 },
];

// Daily data (today's hours)
export const dailySalesData: SalesData[] = [
  { date: '9 AM', revenue: 980, orders: 12 },
  { date: '10 AM', revenue: 1420, orders: 18 },
  { date: '11 AM', revenue: 1980, orders: 25 },
  { date: '12 PM', revenue: 3650, orders: 45 },
  { date: '1 PM', revenue: 4280, orders: 52 },
  { date: '2 PM', revenue: 2240, orders: 28 },
  { date: '3 PM', revenue: 1180, orders: 15 },
  { date: '4 PM', revenue: 1420, orders: 18 },
  { date: '5 PM', revenue: 2650, orders: 32 },
  { date: '6 PM', revenue: 4820, orders: 58 },
  { date: '7 PM', revenue: 5620, orders: 68 },
  { date: '8 PM', revenue: 5980, orders: 72 },
];

// Monthly data (last 30 days - simplified to weeks)
export const monthlySalesData: SalesData[] = [
  { date: 'Week 1', revenue: 58200, orders: 672 },
  { date: 'Week 2', revenue: 61500, orders: 698 },
  { date: 'Week 3', revenue: 64100, orders: 725 },
  { date: 'Week 4', revenue: 66800, orders: 758 },
];

export const topSellingItems: TopSellingItem[] = [
  { id: '1', name: 'Grilled Salmon Steak', quantity: 45, revenue: 675.00, category: 'special' },
  { id: '4', name: 'Beef Steak', quantity: 38, revenue: 1140.00, category: 'special' },
  { id: '7', name: 'Chicken Quinoa & Herbs', quantity: 52, revenue: 624.00, category: 'chicken' },
  { id: '3', name: 'Pasta with Roast Beef', quantity: 41, revenue: 410.00, category: 'pasta' },
  { id: '10', name: 'Chocolate Lava Cake', quantity: 67, revenue: 603.00, category: 'desserts' },
  { id: '9', name: 'Caesar Salad', quantity: 48, revenue: 408.00, category: 'salads' },
];

export const revenueBreakdown: RevenueBreakdown[] = [
  { type: 'dine-in', revenue: 8740.50, percentage: 70.2 },
  { type: 'takeaway', revenue: 2985.18, percentage: 24.0 },
  { type: 'delivery', revenue: 725.07, percentage: 5.8 },
];

export const recentOrders: RecentOrder[] = [
  {
    id: 'F0045',
    tableNumber: '12',
    customerName: 'John Smith',
    total: 125.50,
    items: 4,
    status: 'completed',
    time: '2 mins ago',
    type: 'dine-in',
  },
  {
    id: 'F0044',
    customerName: 'Sarah Johnson',
    total: 45.00,
    items: 2,
    status: 'ready',
    time: '5 mins ago',
    type: 'takeaway',
  },
  {
    id: 'F0043',
    tableNumber: '08',
    customerName: 'Michael Brown',
    total: 89.75,
    items: 3,
    status: 'preparing',
    time: '12 mins ago',
    type: 'dine-in',
  },
  {
    id: 'F0042',
    customerName: 'Emily Davis',
    total: 62.50,
    items: 2,
    status: 'preparing',
    time: '18 mins ago',
    type: 'delivery',
  },
  {
    id: 'F0041',
    tableNumber: '05',
    customerName: 'David Wilson',
    total: 156.25,
    items: 5,
    status: 'completed',
    time: '25 mins ago',
    type: 'dine-in',
  },
  {
    id: 'F0040',
    customerName: 'Lisa Anderson',
    total: 38.00,
    items: 2,
    status: 'completed',
    time: '32 mins ago',
    type: 'takeaway',
  },
];

export const tableTurnoverData: TableTurnover[] = [
  { area: 'Main Dining', totalTables: 12, occupiedTables: 8, turnoverRate: 66.7, avgTurnoverTime: 75 },
  { area: 'Terrace', totalTables: 4, occupiedTables: 2, turnoverRate: 50.0, avgTurnoverTime: 90 },
  { area: 'Outdoor', totalTables: 4, occupiedTables: 3, turnoverRate: 75.0, avgTurnoverTime: 65 },
];

export const peakHoursData: PeakHoursData[] = [
  { hour: '9 AM', orders: 12, revenue: 980 },
  { hour: '10 AM', orders: 18, revenue: 1420 },
  { hour: '11 AM', orders: 25, revenue: 1980 },
  { hour: '12 PM', orders: 45, revenue: 3650 },
  { hour: '1 PM', orders: 52, revenue: 4280 },
  { hour: '2 PM', orders: 28, revenue: 2240 },
  { hour: '3 PM', orders: 15, revenue: 1180 },
  { hour: '4 PM', orders: 18, revenue: 1420 },
  { hour: '5 PM', orders: 32, revenue: 2650 },
  { hour: '6 PM', orders: 58, revenue: 4820 },
  { hour: '7 PM', orders: 68, revenue: 5620 },
  { hour: '8 PM', orders: 72, revenue: 5980 },
  { hour: '9 PM', orders: 65, revenue: 5420 },
  { hour: '10 PM', orders: 42, revenue: 3480 },
];

