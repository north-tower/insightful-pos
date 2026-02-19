import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { CustomerOrder, CustomerOrderStatus, OrderSource } from '@/data/orderQueueData';
import { CartItemWithModifiers } from '@/data/orderData';
import { mockCustomerOrders } from '@/data/orderQueueData';

interface OrderQueueContextType {
  // Orders
  pendingOrders: CustomerOrder[];
  activeOrders: CustomerOrder[];
  completedOrders: CustomerOrder[];
  
  // Actions
  submitCustomerOrder: (order: Omit<CustomerOrder, 'id' | 'orderNumber' | 'createdAt' | 'status' | 'trackingCode'>) => CustomerOrder;
  acceptOrder: (orderId: string, tableNumber?: string) => void;
  rejectOrder: (orderId: string, reason: string) => void;
  updateOrderStatus: (orderId: string, status: CustomerOrderStatus) => void;
  getOrderByTrackingCode: (trackingCode: string) => CustomerOrder | undefined;
  getOrderById: (orderId: string) => CustomerOrder | undefined;
}

const OrderQueueContext = createContext<OrderQueueContextType | undefined>(undefined);

export function OrderQueueProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<CustomerOrder[]>(mockCustomerOrders);

  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const activeOrders = orders.filter((o) => 
    ['accepted', 'preparing', 'ready'].includes(o.status)
  );
  const completedOrders = orders.filter((o) => 
    ['completed', 'rejected', 'cancelled'].includes(o.status)
  );

  const submitCustomerOrder = useCallback((
    orderData: Omit<CustomerOrder, 'id' | 'orderNumber' | 'createdAt' | 'status' | 'trackingCode'>
  ): CustomerOrder => {
    const newOrder: CustomerOrder = {
      ...orderData,
      id: `co${Date.now()}`,
      orderNumber: `C${String(orders.length + 1).padStart(3, '0')}`,
      status: 'pending',
      createdAt: new Date(),
      trackingCode: `TRACK${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    };

    setOrders((prev) => [...prev, newOrder]);
    return newOrder;
  }, [orders.length]);

  const acceptOrder = useCallback((orderId: string, tableNumber?: string) => {
    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId
          ? {
              ...order,
              status: 'accepted' as CustomerOrderStatus,
              acceptedAt: new Date(),
              tableNumber: tableNumber || order.tableNumber,
            }
          : order
      )
    );
  }, []);

  const rejectOrder = useCallback((orderId: string, reason: string) => {
    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId
          ? {
              ...order,
              status: 'rejected' as CustomerOrderStatus,
              rejectedReason: reason,
            }
          : order
      )
    );
  }, []);

  const updateOrderStatus = useCallback((orderId: string, status: CustomerOrderStatus) => {
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id !== orderId) return order;
        
        const updates: Partial<CustomerOrder> = { status };
        if (status === 'completed') {
          updates.completedAt = new Date();
        }
        
        return { ...order, ...updates };
      })
    );
  }, []);

  const getOrderByTrackingCode = useCallback((trackingCode: string) => {
    return orders.find((order) => order.trackingCode === trackingCode);
  }, [orders]);

  const getOrderById = useCallback((orderId: string) => {
    return orders.find((order) => order.id === orderId);
  }, [orders]);

  return (
    <OrderQueueContext.Provider
      value={{
        pendingOrders,
        activeOrders,
        completedOrders,
        submitCustomerOrder,
        acceptOrder,
        rejectOrder,
        updateOrderStatus,
        getOrderByTrackingCode,
        getOrderById,
      }}
    >
      {children}
    </OrderQueueContext.Provider>
  );
}

export function useOrderQueue() {
  const context = useContext(OrderQueueContext);
  if (!context) {
    throw new Error('useOrderQueue must be used within an OrderQueueProvider');
  }
  return context;
}





