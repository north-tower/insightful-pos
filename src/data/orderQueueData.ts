// Customer ordering and order queue data types

import { CartItemWithModifiers, Order } from './orderData';

export type CustomerOrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'rejected' | 'cancelled';
export type OrderSource = 'kiosk' | 'qr' | 'web' | 'pos';

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  source: OrderSource;
  customerName?: string;
  customerId?: string;
  tableNumber?: string;
  items: CartItemWithModifiers[];
  subtotal: number;
  tax: number;
  total: number;
  orderNotes?: string;
  type: 'dine-in' | 'takeaway' | 'delivery';
  status: CustomerOrderStatus;
  createdAt: Date;
  acceptedAt?: Date;
  completedAt?: Date;
  rejectedReason?: string;
  trackingCode?: string; // For customer tracking
}

export interface OrderQueueState {
  pendingOrders: CustomerOrder[];
  activeOrders: CustomerOrder[];
  completedOrders: CustomerOrder[];
}

// Mock incoming customer orders
export const mockCustomerOrders: CustomerOrder[] = [
  {
    id: 'co1',
    orderNumber: 'C001',
    source: 'qr',
    customerName: 'John Smith',
    tableNumber: '05',
    items: [
      {
        id: '1',
        name: 'Grilled Salmon Steak',
        price: 15.00,
        category: 'special',
        image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=300&h=200&fit=crop',
        quantity: 2,
        notes: 'Well done',
      },
      {
        id: '10',
        name: 'Chocolate Lava Cake',
        price: 9.00,
        category: 'desserts',
        image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=300&h=200&fit=crop',
        isVeg: true,
        quantity: 1,
      },
    ],
    subtotal: 39.00,
    tax: 1.95,
    total: 40.95,
    type: 'dine-in',
    status: 'pending',
    createdAt: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
    trackingCode: 'TRACK123',
  },
  {
    id: 'co2',
    orderNumber: 'C002',
    source: 'kiosk',
    customerName: 'Sarah Johnson',
    items: [
      {
        id: '2',
        name: 'Tofu Poke Bowl',
        price: 7.00,
        category: 'salads',
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&h=200&fit=crop',
        isVeg: true,
        quantity: 1,
      },
    ],
    subtotal: 7.00,
    tax: 0.35,
    total: 7.35,
    type: 'takeaway',
    status: 'pending',
    createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    trackingCode: 'TRACK124',
  },
  {
    id: 'co3',
    orderNumber: 'C003',
    source: 'web',
    customerName: 'Michael Brown',
    customerId: '3',
    items: [
      {
        id: '4',
        name: 'Beef Steak',
        price: 30.00,
        category: 'special',
        image: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=300&h=200&fit=crop',
        quantity: 1,
        notes: 'Medium rare',
      },
    ],
    subtotal: 30.00,
    tax: 1.50,
    total: 31.50,
    type: 'delivery',
    status: 'accepted',
    createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
    acceptedAt: new Date(Date.now() - 9 * 60 * 1000),
    trackingCode: 'TRACK125',
  },
];





