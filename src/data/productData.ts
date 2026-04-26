// Retail product data types and mock data

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  cost: number; // wholesale cost
  category: string;
  image: string;
  stock: number;
  mainStock?: number;
  lowStockThreshold: number;
  unit: string; // 'pcs', 'kg', 'ltr', etc.
  brand?: string;
  variants?: ProductVariant[];
  isActive: boolean;
  discount?: number;
}

export interface ProductVariant {
  id: string;
  name: string; // e.g. "Large", "Red", "500ml"
  sku: string;
  barcode?: string;
  price: number;
  stock: number;
}

export interface ProductCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
}

export interface StockAdjustment {
  id: string;
  productId: string;
  productName: string;
  type: 'restock' | 'damaged' | 'returned' | 'sold' | 'adjustment';
  quantity: number; // positive for in, negative for out
  previousStock: number;
  newStock: number;
  note?: string;
  date: Date;
  staffName: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  email: string;
  products: number; // how many products from this supplier
}

// ─── Categories ──────────────────────────────────────────────────────────────

export const retailCategories: ProductCategory[] = [
  { id: 'all', name: 'All Products', icon: '📦', count: 48 },
  { id: 'electronics', name: 'Electronics', icon: '📱', count: 12 },
  { id: 'clothing', name: 'Clothing', icon: '👕', count: 8 },
  { id: 'home', name: 'Home & Living', icon: '🏠', count: 6 },
  { id: 'beauty', name: 'Beauty & Care', icon: '💄', count: 7 },
  { id: 'grocery', name: 'Grocery', icon: '🛒', count: 10 },
  { id: 'accessories', name: 'Accessories', icon: '⌚', count: 5 },
];

// ─── Products ────────────────────────────────────────────────────────────────

export const retailProducts: Product[] = [
  {
    id: 'p1',
    name: 'Wireless Bluetooth Earbuds',
    sku: 'ELC-001',
    barcode: '8901234567890',
    price: 49.99,
    cost: 22.00,
    category: 'electronics',
    image: 'https://images.unsplash.com/photo-1590658268037-6bf12f032f55?w=300&h=200&fit=crop',
    stock: 45,
    lowStockThreshold: 10,
    unit: 'pcs',
    brand: 'SoundMax',
    isActive: true,
  },
  {
    id: 'p2',
    name: 'USB-C Fast Charger 65W',
    sku: 'ELC-002',
    barcode: '8901234567891',
    price: 29.99,
    cost: 12.50,
    category: 'electronics',
    image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=300&h=200&fit=crop',
    stock: 78,
    lowStockThreshold: 15,
    unit: 'pcs',
    brand: 'ChargePro',
    isActive: true,
  },
  {
    id: 'p3',
    name: 'Smart Watch Fitness Band',
    sku: 'ELC-003',
    barcode: '8901234567892',
    price: 89.99,
    cost: 38.00,
    category: 'electronics',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=200&fit=crop',
    stock: 23,
    lowStockThreshold: 10,
    unit: 'pcs',
    brand: 'FitGear',
    isActive: true,
  },
  {
    id: 'p4',
    name: 'Cotton T-Shirt Classic',
    sku: 'CLT-001',
    barcode: '8901234567893',
    price: 19.99,
    cost: 7.00,
    category: 'clothing',
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300&h=200&fit=crop',
    stock: 120,
    lowStockThreshold: 20,
    unit: 'pcs',
    brand: 'BasicCo',
    variants: [
      { id: 'v1', name: 'S', sku: 'CLT-001-S', price: 19.99, stock: 30 },
      { id: 'v2', name: 'M', sku: 'CLT-001-M', price: 19.99, stock: 40 },
      { id: 'v3', name: 'L', sku: 'CLT-001-L', price: 19.99, stock: 35 },
      { id: 'v4', name: 'XL', sku: 'CLT-001-XL', price: 21.99, stock: 15 },
    ],
    isActive: true,
  },
  {
    id: 'p5',
    name: 'Denim Jeans Slim Fit',
    sku: 'CLT-002',
    barcode: '8901234567894',
    price: 54.99,
    cost: 22.00,
    category: 'clothing',
    image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=300&h=200&fit=crop',
    stock: 65,
    lowStockThreshold: 15,
    unit: 'pcs',
    brand: 'DenimWorks',
    isActive: true,
  },
  {
    id: 'p6',
    name: 'Ceramic Coffee Mug Set',
    sku: 'HOM-001',
    barcode: '8901234567895',
    price: 24.99,
    cost: 9.50,
    category: 'home',
    image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=300&h=200&fit=crop',
    stock: 34,
    lowStockThreshold: 8,
    unit: 'set',
    isActive: true,
  },
  {
    id: 'p7',
    name: 'Scented Candle Lavender',
    sku: 'HOM-002',
    barcode: '8901234567896',
    price: 14.99,
    cost: 4.50,
    category: 'home',
    image: 'https://images.unsplash.com/photo-1602607633945-c7d67b4c9b24?w=300&h=200&fit=crop',
    stock: 52,
    lowStockThreshold: 10,
    unit: 'pcs',
    isActive: true,
  },
  {
    id: 'p8',
    name: 'Face Moisturizer SPF30',
    sku: 'BEA-001',
    barcode: '8901234567897',
    price: 18.99,
    cost: 6.00,
    category: 'beauty',
    image: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=300&h=200&fit=crop',
    stock: 88,
    lowStockThreshold: 15,
    unit: 'pcs',
    brand: 'GlowUp',
    isActive: true,
  },
  {
    id: 'p9',
    name: 'Organic Honey 500g',
    sku: 'GRC-001',
    barcode: '8901234567898',
    price: 12.99,
    cost: 5.50,
    category: 'grocery',
    image: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=300&h=200&fit=crop',
    stock: 3,
    lowStockThreshold: 10,
    unit: 'pcs',
    isActive: true,
  },
  {
    id: 'p10',
    name: 'Premium Coffee Beans 1kg',
    sku: 'GRC-002',
    barcode: '8901234567899',
    price: 22.99,
    cost: 11.00,
    category: 'grocery',
    image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=300&h=200&fit=crop',
    stock: 41,
    lowStockThreshold: 10,
    unit: 'pcs',
    brand: 'BeanCraft',
    isActive: true,
  },
  {
    id: 'p11',
    name: 'Leather Watch Strap',
    sku: 'ACC-001',
    barcode: '8901234567900',
    price: 34.99,
    cost: 12.00,
    category: 'accessories',
    image: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=300&h=200&fit=crop',
    stock: 7,
    lowStockThreshold: 5,
    unit: 'pcs',
    isActive: true,
  },
  {
    id: 'p12',
    name: 'Portable Bluetooth Speaker',
    sku: 'ELC-004',
    barcode: '8901234567901',
    price: 39.99,
    cost: 16.00,
    category: 'electronics',
    image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=300&h=200&fit=crop',
    stock: 0,
    lowStockThreshold: 8,
    unit: 'pcs',
    brand: 'SoundMax',
    isActive: true,
  },
];

// ─── Stock Adjustments (recent) ──────────────────────────────────────────────

export const recentStockAdjustments: StockAdjustment[] = [
  {
    id: 'sa1',
    productId: 'p1',
    productName: 'Wireless Bluetooth Earbuds',
    type: 'restock',
    quantity: 50,
    previousStock: 15,
    newStock: 65,
    note: 'Weekly restock from supplier',
    date: new Date(Date.now() - 2 * 60 * 60 * 1000),
    staffName: 'Mike M.',
  },
  {
    id: 'sa2',
    productId: 'p9',
    productName: 'Organic Honey 500g',
    type: 'damaged',
    quantity: -2,
    previousStock: 5,
    newStock: 3,
    note: 'Broken jars during stocking',
    date: new Date(Date.now() - 5 * 60 * 60 * 1000),
    staffName: 'Sarah J.',
  },
  {
    id: 'sa3',
    productId: 'p12',
    productName: 'Portable Bluetooth Speaker',
    type: 'sold',
    quantity: -8,
    previousStock: 8,
    newStock: 0,
    date: new Date(Date.now() - 24 * 60 * 60 * 1000),
    staffName: 'System',
  },
  {
    id: 'sa4',
    productId: 'p4',
    productName: 'Cotton T-Shirt Classic',
    type: 'returned',
    quantity: 3,
    previousStock: 117,
    newStock: 120,
    note: 'Customer return - wrong size',
    date: new Date(Date.now() - 48 * 60 * 60 * 1000),
    staffName: 'Mike M.',
  },
];

// ─── Retail Dashboard Data ───────────────────────────────────────────────────

export interface RetailDashboardStats {
  todayRevenue: number;
  todaySales: number;
  averageSaleValue: number;
  itemsSold: number;
  lowStockItems: number;
  outOfStockItems: number;
  revenueChange: number;
  salesChange: number;
}

export const retailDashboardStats: RetailDashboardStats = {
  todayRevenue: 8742.50,
  todaySales: 94,
  averageSaleValue: 92.99,
  itemsSold: 247,
  lowStockItems: 3,
  outOfStockItems: 1,
  revenueChange: 6.8,
  salesChange: 4.2,
};

export interface RetailSalesData {
  date: string;
  revenue: number;
  transactions: number;
}

export const retailWeeklySales: RetailSalesData[] = [
  { date: 'Mon', revenue: 6200, transactions: 68 },
  { date: 'Tue', revenue: 7100, transactions: 78 },
  { date: 'Wed', revenue: 6800, transactions: 72 },
  { date: 'Thu', revenue: 8200, transactions: 88 },
  { date: 'Fri', revenue: 9500, transactions: 102 },
  { date: 'Sat', revenue: 11200, transactions: 124 },
  { date: 'Sun', revenue: 8742, transactions: 94 },
];

export const retailDailySales: RetailSalesData[] = [
  { date: '9 AM', revenue: 420, transactions: 5 },
  { date: '10 AM', revenue: 780, transactions: 9 },
  { date: '11 AM', revenue: 1100, transactions: 12 },
  { date: '12 PM', revenue: 1450, transactions: 16 },
  { date: '1 PM', revenue: 1280, transactions: 14 },
  { date: '2 PM', revenue: 920, transactions: 10 },
  { date: '3 PM', revenue: 650, transactions: 7 },
  { date: '4 PM', revenue: 880, transactions: 9 },
  { date: '5 PM', revenue: 1350, transactions: 15 },
  { date: '6 PM', revenue: 1680, transactions: 18 },
  { date: '7 PM', revenue: 1520, transactions: 16 },
  { date: '8 PM', revenue: 1100, transactions: 12 },
];

export interface TopSellingProduct {
  id: string;
  name: string;
  quantitySold: number;
  revenue: number;
  category: string;
}

export const topSellingProducts: TopSellingProduct[] = [
  { id: 'p1', name: 'Wireless Bluetooth Earbuds', quantitySold: 22, revenue: 1099.78, category: 'electronics' },
  { id: 'p4', name: 'Cotton T-Shirt Classic', quantitySold: 35, revenue: 699.65, category: 'clothing' },
  { id: 'p10', name: 'Premium Coffee Beans 1kg', quantitySold: 18, revenue: 413.82, category: 'grocery' },
  { id: 'p2', name: 'USB-C Fast Charger 65W', quantitySold: 15, revenue: 449.85, category: 'electronics' },
  { id: 'p8', name: 'Face Moisturizer SPF30', quantitySold: 14, revenue: 265.86, category: 'beauty' },
  { id: 'p6', name: 'Ceramic Coffee Mug Set', quantitySold: 12, revenue: 299.88, category: 'home' },
];

export interface RecentSale {
  id: string;
  saleNumber: string;
  customerName?: string;
  total: number;
  items: number;
  paymentMethod: 'cash' | 'card' | 'qr';
  time: string;
}

export const recentSales: RecentSale[] = [
  { id: 's1', saleNumber: 'S0094', customerName: 'Walk-in', total: 89.98, items: 2, paymentMethod: 'card', time: '3 mins ago' },
  { id: 's2', saleNumber: 'S0093', customerName: 'Grace K.', total: 54.99, items: 1, paymentMethod: 'cash', time: '12 mins ago' },
  { id: 's3', saleNumber: 'S0092', customerName: 'Walk-in', total: 142.47, items: 4, paymentMethod: 'card', time: '25 mins ago' },
  { id: 's4', saleNumber: 'S0091', customerName: 'David M.', total: 22.99, items: 1, paymentMethod: 'qr', time: '38 mins ago' },
  { id: 's5', saleNumber: 'S0090', customerName: 'Walk-in', total: 67.98, items: 3, paymentMethod: 'cash', time: '52 mins ago' },
  { id: 's6', saleNumber: 'S0089', customerName: 'Alice W.', total: 199.97, items: 2, paymentMethod: 'card', time: '1 hr ago' },
];
