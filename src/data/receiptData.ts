// Receipt data types and templates

import { Order, CartItemWithModifiers } from './orderData';

export interface ReceiptTemplate {
  id: string;
  name: string;
  type: 'customer' | 'kitchen' | 'summary';
  layout: 'compact' | 'standard' | 'detailed';
}

export interface ReceiptData {
  orderId: string;
  orderNumber: string;
  date: Date;
  tableNumber?: string;
  customerName?: string;
  items: CartItemWithModifiers[];
  subtotal: number;
  tax: number;
  discount?: number;
  total: number;
  paymentMethod: string;
  splitPayments?: Array<{ method: string; amount: number }>;
  orderNotes?: string;
  staffName?: string;
  type: 'dine-in' | 'takeaway' | 'delivery';
}

export interface BusinessInfo {
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  website?: string;
  taxId?: string;
}

export const businessInfo: BusinessInfo = {
  name: 'Nexus Restaurant',
  address: '123 Main Street',
  city: 'New York, NY 10001',
  phone: '(555) 123-4567',
  email: 'info@nexusrestaurant.com',
  website: 'www.nexusrestaurant.com',
  taxId: 'TAX-123456',
};

export const receiptTemplates: ReceiptTemplate[] = [
  { id: 'customer-standard', name: 'Customer Receipt (Standard)', type: 'customer', layout: 'standard' },
  { id: 'customer-compact', name: 'Customer Receipt (Compact)', type: 'customer', layout: 'compact' },
  { id: 'customer-detailed', name: 'Customer Receipt (Detailed)', type: 'customer', layout: 'detailed' },
  { id: 'kitchen-standard', name: 'Kitchen Ticket (Standard)', type: 'kitchen', layout: 'standard' },
  { id: 'kitchen-compact', name: 'Kitchen Ticket (Compact)', type: 'kitchen', layout: 'compact' },
  { id: 'summary', name: 'Order Summary', type: 'summary', layout: 'standard' },
];

export function generateReceiptData(order: Order): ReceiptData {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    date: order.createdAt,
    tableNumber: order.tableNumber,
    customerName: order.customerName,
    items: order.items,
    subtotal: order.subtotal,
    tax: order.tax,
    discount: order.discount,
    total: order.total,
    paymentMethod: order.paymentMethod || 'cash',
    splitPayments: order.splitPayments,
    orderNotes: order.notes,
    type: order.type,
  };
}


