// Order management data types

import { MenuItem } from './menuData';

export interface OrderModifier {
  id: string;
  type: 'add-on' | 'substitution' | 'remove' | 'note';
  name: string;
  price?: number;
  originalItemId?: string;
}

export interface CartItemWithModifiers extends MenuItem {
  quantity: number;
  modifiers?: OrderModifier[];
  notes?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  tableNumber?: string;
  customerName?: string;
  items: CartItemWithModifiers[];
  subtotal: number;
  tax: number;
  total: number;
  discount?: number;
  type: 'dine-in' | 'takeaway' | 'delivery';
  paymentMethod?: 'cash' | 'card' | 'qr' | 'split';
  paymentStatus: 'pending' | 'partial' | 'paid' | 'refunded' | 'voided';
  splitPayments?: SplitPayment[];
  notes?: string;
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  createdAt: Date;
  completedAt?: Date;
  staffId?: string;
  isHold?: boolean;
}

export interface SplitPayment {
  id: string;
  method: 'cash' | 'card' | 'qr';
  amount: number;
  paidAt: Date;
}

export interface HeldOrder {
  id: string;
  name: string;
  items: CartItemWithModifiers[];
  subtotal: number;
  tax: number;
  total: number;
  savedAt: Date;
}

export interface OrderModifierOption {
  id: string;
  name: string;
  price: number;
  type: 'add-on' | 'substitution';
}

// Mock order history data
export const mockOrderHistory: Order[] = [
  {
    id: '1',
    orderNumber: 'F0050',
    tableNumber: '12',
    customerName: 'John Smith',
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
    paymentMethod: 'card',
    paymentStatus: 'paid',
    status: 'completed',
    createdAt: new Date('2024-01-15T19:30:00'),
    completedAt: new Date('2024-01-15T20:15:00'),
  },
  {
    id: '2',
    orderNumber: 'F0049',
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
      {
        id: '9',
        name: 'Caesar Salad',
        price: 8.50,
        category: 'salads',
        image: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=300&h=200&fit=crop',
        isVeg: true,
        quantity: 1,
      },
    ],
    subtotal: 15.50,
    tax: 0.78,
    total: 16.28,
    type: 'takeaway',
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    status: 'completed',
    createdAt: new Date('2024-01-15T18:45:00'),
    completedAt: new Date('2024-01-15T19:00:00'),
  },
  {
    id: '3',
    orderNumber: 'F0048',
    tableNumber: '08',
    customerName: 'Michael Brown',
    items: [
      {
        id: '4',
        name: 'Beef Steak',
        price: 30.00,
        category: 'special',
        image: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=300&h=200&fit=crop',
        quantity: 1,
        notes: 'Medium rare, no sauce',
      },
    ],
    subtotal: 30.00,
    tax: 1.50,
    total: 31.50,
    type: 'dine-in',
    paymentMethod: 'split',
    paymentStatus: 'paid',
    splitPayments: [
      { id: 'sp1', method: 'card', amount: 15.75, paidAt: new Date('2024-01-15T18:30:00') },
      { id: 'sp2', method: 'cash', amount: 15.75, paidAt: new Date('2024-01-15T18:30:00') },
    ],
    status: 'completed',
    createdAt: new Date('2024-01-15T17:20:00'),
    completedAt: new Date('2024-01-15T18:30:00'),
  },
  {
    id: '4',
    orderNumber: 'F0047',
    tableNumber: '05',
    customerName: 'David Wilson',
    items: [
      {
        id: '3',
        name: 'Pasta with Roast Beef',
        price: 10.00,
        category: 'pasta',
        image: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=300&h=200&fit=crop',
        quantity: 3,
      },
    ],
    subtotal: 30.00,
    tax: 1.50,
    total: 31.50,
    discount: 5.00,
    type: 'dine-in',
    paymentMethod: 'card',
    paymentStatus: 'partial',
    splitPayments: [
      { id: 'sp3', method: 'card', amount: 15.00, paidAt: new Date('2024-01-15T16:45:00') },
    ],
    status: 'completed',
    createdAt: new Date('2024-01-15T16:00:00'),
    completedAt: new Date('2024-01-15T16:45:00'),
  },
  {
    id: '5',
    orderNumber: 'F0046',
    customerName: 'Emily Davis',
    items: [
      {
        id: '7',
        name: 'Chicken Quinoa & Herbs',
        price: 12.00,
        category: 'chicken',
        image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=300&h=200&fit=crop',
        quantity: 2,
      },
    ],
    subtotal: 24.00,
    tax: 1.20,
    total: 25.20,
    type: 'delivery',
    paymentMethod: 'card',
    paymentStatus: 'refunded',
    notes: 'Customer cancelled order',
    status: 'cancelled',
    createdAt: new Date('2024-01-15T15:30:00'),
  },
];

// Mock modifier options (add-ons, substitutions)
export const modifierOptions: Record<string, OrderModifierOption[]> = {
  addons: [
    { id: 'addon1', name: 'Extra Cheese', price: 2.00, type: 'add-on' },
    { id: 'addon2', name: 'Bacon', price: 3.50, type: 'add-on' },
    { id: 'addon3', name: 'Avocado', price: 2.50, type: 'add-on' },
    { id: 'addon4', name: 'Extra Sauce', price: 1.00, type: 'add-on' },
    { id: 'addon5', name: 'Side Salad', price: 4.00, type: 'add-on' },
  ],
  substitutions: [
    { id: 'sub1', name: 'Gluten Free Bread', price: 0, type: 'substitution' },
    { id: 'sub2', name: 'Whole Wheat Pasta', price: 0, type: 'substitution' },
    { id: 'sub3', name: 'Brown Rice', price: 0, type: 'substitution' },
    { id: 'sub4', name: 'No Onions', price: 0, type: 'substitution' },
    { id: 'sub5', name: 'No Tomatoes', price: 0, type: 'substitution' },
  ],
};


