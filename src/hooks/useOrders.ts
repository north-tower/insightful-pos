import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useBusinessMode } from '@/context/BusinessModeContext';
import { useAuth } from '@/context/AuthContext';
import { getCachedSnapshot, setCachedSnapshot } from '@/lib/offline/cache';
import {
  enqueueOperation,
  getPendingOperations,
  markOperationFailed,
  markOperationSynced,
  updateOperationStatus,
} from '@/lib/offline/outbox';

// ─── Types ──────────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled'
  | 'voided';

export type PaymentStatus =
  | 'unpaid'
  | 'partial'
  | 'paid'
  | 'refunded'
  | 'voided';

export type OrderType = 'dine-in' | 'takeaway' | 'delivery' | 'pos';
export type PaymentMethod = 'cash' | 'card' | 'qr';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_image?: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  discount: number;
  modifiers: Array<{
    id: string;
    type: string;
    name: string;
    price?: number;
  }>;
  notes?: string;
  sku?: string;
  barcode?: string;
}

export interface Payment {
  id: string;
  order_id: string;
  method: PaymentMethod;
  amount: number;
  reference?: string;
  description?: string;
  paid_at: string;
}

export type SaleType = 'cash' | 'credit';

export interface SaleOrder {
  id: string;
  order_number: string;
  business_mode: 'restaurant' | 'retail';
  order_type: OrderType;
  source: string;
  sale_type: SaleType;
  customer_id?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  table_number?: string;
  invoice_number?: string;
  due_date?: string;
  consignment_info?: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  notes?: string;
  staff_id?: string;
  staff_name?: string;
  created_at: string;
  completed_at?: string;
  // Joined data
  items: OrderItem[];
  payments: Payment[];
}

// ─── Create order params ────────────────────────────────────────────────────

export interface CreateOrderParams {
  order_type: OrderType;
  sale_type?: SaleType;
  customer_id?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  table_number?: string;
  notes?: string;
  discount_amount?: number;
  due_date?: string; // ISO string, for credit sales
  consignment_info?: string;
  created_at?: string; // Optional invoice/order datetime (supports backdating)
  items: Array<{
    product_id: string | null;
    product_name: string;
    product_image?: string;
    unit_price: number;
    quantity: number;
    modifiers?: Array<{ id: string; type: string; name: string; price?: number }>;
    notes?: string;
    sku?: string;
    barcode?: string;
  }>;
  payments: Array<{
    method: PaymentMethod;
    amount: number;
    reference?: string;
    description?: string;
    paid_at?: string; // Optional payment datetime (supports backdating)
  }>;
}

interface QueuedCreateOrderPayload {
  local_order_id: string;
  params: CreateOrderParams;
}

interface ProductsOfflineSnapshot {
  categories: unknown[];
  products: Array<{
    id: string;
    stock?: number | null;
    [key: string]: unknown;
  }>;
  variants: unknown[];
  cashierAllocations: Array<{
    product_id: string;
    assigned_qty: number;
    sold_qty: number;
  }>;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useOrders() {
  const { mode, isRestaurant } = useBusinessMode();
  const { user } = useAuth();

  const [orders, setOrders] = useState<SaleOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSyncingRef = useRef(false);

  const offlineCacheKey = useMemo(() => `snapshot:orders:${mode}`, [mode]);

  const loadFromOfflineCache = useCallback(async (): Promise<SaleOrder[]> => {
    const cached = await getCachedSnapshot<SaleOrder[]>(offlineCacheKey);
    if (!cached) return [];
    setOrders(cached);
    return cached;
  }, [offlineCacheKey]);

  const persistOrdersSnapshot = useCallback(async (nextOrders: SaleOrder[]) => {
    await setCachedSnapshot<SaleOrder[]>(offlineCacheKey, nextOrders);
  }, [offlineCacheKey]);

  const applyOfflineInventoryDeduction = useCallback(
    async (params: CreateOrderParams) => {
      if (mode !== 'retail') return;

      const productsCacheKey = `snapshot:products:${mode}:${user?.id || 'anon'}:${user?.role || 'unknown'}`;
      const snapshot = await getCachedSnapshot<ProductsOfflineSnapshot>(productsCacheKey);
      if (!snapshot) return;

      const qtyByProduct = new Map<string, number>();
      for (const item of params.items) {
        if (!item.product_id) continue;
        qtyByProduct.set(
          item.product_id,
          (qtyByProduct.get(item.product_id) || 0) + Math.max(item.quantity || 0, 0),
        );
      }

      if (qtyByProduct.size === 0) return;

      const nextProducts = snapshot.products.map((product) => {
        const soldQty = qtyByProduct.get(product.id) || 0;
        if (!soldQty) return product;
        const currentStock = Number(product.stock || 0);
        return {
          ...product,
          stock: Math.max(currentStock - soldQty, 0),
        };
      });

      const nextAllocations = snapshot.cashierAllocations.map((allocation) => {
        const soldQty = qtyByProduct.get(allocation.product_id) || 0;
        if (!soldQty) return allocation;
        return {
          ...allocation,
          sold_qty: Math.min(allocation.sold_qty + soldQty, allocation.assigned_qty),
        };
      });

      await setCachedSnapshot<ProductsOfflineSnapshot>(productsCacheKey, {
        ...snapshot,
        products: nextProducts,
        cashierAllocations: nextAllocations,
      });

      window.dispatchEvent(
        new CustomEvent('offline-products-updated', {
          detail: { cacheKey: productsCacheKey },
        }),
      );
    },
    [mode, user?.id, user?.role],
  );

  const createOrderRemote = useCallback(
    async (params: CreateOrderParams): Promise<SaleOrder | null> => {
      // Calculate financials
      const itemsTotal = params.items.reduce((sum, item) => {
        const modifierTotal = (item.modifiers || []).reduce(
          (s, m) => s + (m.price || 0) * item.quantity,
          0,
        );
        return sum + item.unit_price * item.quantity + modifierTotal;
      }, 0);

      const discountAmount = params.discount_amount || 0;
      const subtotal = itemsTotal - discountAmount;
      const taxRate = 0;
      const taxAmount = 0;
      const total = subtotal;

      const saleType = params.sale_type || 'cash';
      const orderCreatedAt = params.created_at || new Date().toISOString();
      const totalPaid = params.payments.reduce((s, p) => s + p.amount, 0);
      const paymentStatus: PaymentStatus =
        saleType === 'credit'
          ? totalPaid >= total
            ? 'paid'
            : totalPaid > 0
            ? 'partial'
            : 'unpaid'
          : totalPaid >= total
          ? 'paid'
          : totalPaid > 0
          ? 'partial'
          : 'unpaid';

      const { data: currentStoreId, error: currentStoreErr } = await supabase.rpc('current_store_id');
      if (currentStoreErr) throw currentStoreErr;

      // 1. Get next order number via RPC
      const { data: orderNumData, error: orderNumErr } = await supabase.rpc(
        'generate_order_number',
        { p_business_mode: mode, p_store_id: currentStoreId },
      );
      if (orderNumErr) throw orderNumErr;
      const orderNumber = orderNumData as string;

      // Generate invoice number
      const { data: invNumData, error: invNumErr } = await supabase.rpc(
        'generate_invoice_number',
        { p_store_id: currentStoreId },
      );
      if (invNumErr) throw invNumErr;
      const invoiceNumber = (invNumData as string) || orderNumber;

      // 2. Insert order
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          business_mode: mode,
          order_type: params.order_type,
          source: 'pos',
          sale_type: saleType,
          customer_id: params.customer_id || null,
          customer_name: params.customer_name || null,
          customer_email: params.customer_email || null,
          customer_phone: params.customer_phone || null,
          table_number: params.table_number || null,
          invoice_number: invoiceNumber,
          due_date: params.due_date || null,
          consignment_info: params.consignment_info || null,
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          discount_amount: discountAmount,
          total,
          status: 'completed',
          payment_status: paymentStatus,
          notes: params.notes || null,
          staff_id: user?.id || null,
          staff_name: user?.full_name || null,
          created_at: orderCreatedAt,
          completed_at: saleType === 'cash' ? orderCreatedAt : null,
        })
        .select()
        .single();

      if (orderErr) throw orderErr;

      const orderId = orderData.id;

      // 3. Insert order items
      const orderItems = params.items.map((item) => {
        const modifierTotal = (item.modifiers || []).reduce(
          (s, m) => s + (m.price || 0) * item.quantity,
          0,
        );
        return {
          order_id: orderId,
          product_id: item.product_id || null,
          product_name: item.product_name,
          product_image: item.product_image || null,
          unit_price: item.unit_price,
          quantity: item.quantity,
          line_total: item.unit_price * item.quantity + modifierTotal,
          discount: 0,
          modifiers: item.modifiers || [],
          notes: item.notes || null,
          sku: item.sku || null,
          barcode: item.barcode || null,
        };
      });

      const { data: insertedItems, error: itemsErr } = await supabase
        .from('order_items')
        .insert(orderItems)
        .select();

      if (itemsErr) throw itemsErr;

      // 4. Insert payments
      let insertedPayments: any[] = [];
      if (params.payments.length > 0) {
        const paymentRows = params.payments.map((p) => ({
          order_id: orderId,
          method: p.method,
          amount: p.amount,
          reference: p.reference || null,
          description: p.description || null,
          paid_at: p.paid_at || orderCreatedAt,
        }));

        const { data: payData, error: payErr } = await supabase
          .from('payments')
          .insert(paymentRows)
          .select();

        if (payErr) throw payErr;
        insertedPayments = payData || [];
      }

      return {
        id: orderId,
        order_number: orderNumber,
        business_mode: mode,
        order_type: params.order_type,
        source: 'pos',
        sale_type: saleType,
        customer_id: params.customer_id,
        customer_name: params.customer_name,
        customer_email: params.customer_email,
        customer_phone: params.customer_phone,
        table_number: params.table_number,
        invoice_number: invoiceNumber,
        due_date: params.due_date,
        consignment_info: params.consignment_info,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        total,
        status: 'completed',
        payment_status: paymentStatus,
        notes: params.notes,
        staff_id: user?.id,
        staff_name: user?.full_name,
        created_at: orderData.created_at,
        completed_at: orderData.completed_at,
        items: (insertedItems || []).map((i: any) => ({
          id: i.id,
          order_id: i.order_id,
          product_id: i.product_id,
          product_name: i.product_name,
          product_image: i.product_image,
          unit_price: Number(i.unit_price),
          quantity: i.quantity,
          line_total: Number(i.line_total),
          discount: Number(i.discount || 0),
          modifiers: i.modifiers || [],
          notes: i.notes,
          sku: i.sku,
          barcode: i.barcode,
        })),
        payments: insertedPayments.map((p: any) => ({
          id: p.id,
          order_id: p.order_id,
          method: p.method,
          amount: Number(p.amount),
          reference: p.reference,
          description: p.description,
          paid_at: p.paid_at,
        })),
      };
    },
    [mode, user?.id, user?.full_name],
  );

  // ── Fetch orders ────────────────────────────────────────────────────────

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    const cached = await loadFromOfflineCache();
    const hasCache = cached.length > 0;
    if (hasCache) setLoading(false);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (!hasCache) setError('Offline and no cached orders available yet');
      return;
    }

    try {
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .select('*')
        .eq('business_mode', mode)
        .order('created_at', { ascending: false })
        .limit(500);

      if (orderErr) throw orderErr;

      if (!orderData || orderData.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const orderIds = orderData.map((o: any) => o.id);

      // Fetch items for all orders
      const { data: itemsData, error: itemsErr } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds);

      if (itemsErr) throw itemsErr;

      // Fetch payments for all orders
      const { data: paymentsData, error: paymentsErr } = await supabase
        .from('payments')
        .select('*')
        .in('order_id', orderIds);

      if (paymentsErr) throw paymentsErr;

      // Group items and payments by order
      const itemsByOrder = new Map<string, OrderItem[]>();
      (itemsData || []).forEach((item: any) => {
        const list = itemsByOrder.get(item.order_id) || [];
        list.push({
          id: item.id,
          order_id: item.order_id,
          product_id: item.product_id,
          product_name: item.product_name,
          product_image: item.product_image,
          unit_price: Number(item.unit_price),
          quantity: item.quantity,
          line_total: Number(item.line_total),
          discount: Number(item.discount || 0),
          modifiers: item.modifiers || [],
          notes: item.notes,
          sku: item.sku,
          barcode: item.barcode,
        });
        itemsByOrder.set(item.order_id, list);
      });

      const paymentsByOrder = new Map<string, Payment[]>();
      (paymentsData || []).forEach((p: any) => {
        const list = paymentsByOrder.get(p.order_id) || [];
        list.push({
          id: p.id,
          order_id: p.order_id,
          method: p.method,
          amount: Number(p.amount),
          reference: p.reference,
          description: p.description,
          paid_at: p.paid_at,
        });
        paymentsByOrder.set(p.order_id, list);
      });

      const saleOrders: SaleOrder[] = orderData.map((o: any) => ({
        id: o.id,
        order_number: o.order_number,
        business_mode: o.business_mode,
        order_type: o.order_type,
        source: o.source,
        sale_type: o.sale_type || 'cash',
        customer_id: o.customer_id,
        customer_name: o.customer_name,
        customer_email: o.customer_email,
        customer_phone: o.customer_phone,
        table_number: o.table_number,
        invoice_number: o.invoice_number,
        due_date: o.due_date,
        consignment_info: o.consignment_info,
        subtotal: Number(o.subtotal),
        tax_rate: Number(o.tax_rate),
        tax_amount: Number(o.tax_amount),
        discount_amount: Number(o.discount_amount),
        total: Number(o.total),
        status: o.status,
        payment_status: o.payment_status,
        notes: o.notes,
        staff_id: o.staff_id,
        staff_name: o.staff_name,
        created_at: o.created_at,
        completed_at: o.completed_at,
        items: itemsByOrder.get(o.id) || [],
        payments: paymentsByOrder.get(o.id) || [],
      }));

      setOrders(saleOrders);
      await persistOrdersSnapshot(saleOrders);
    } catch (err: any) {
      console.error('Failed to fetch orders:', err);
      if (!hasCache) setError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [mode, loadFromOfflineCache, persistOrdersSnapshot]);

  const syncQueuedOrders = useCallback(async (operationId?: string) => {
    if (isSyncingRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    isSyncingRef.current = true;
    try {
      const pending = await getPendingOperations();
      const createOrderOps = pending.filter(
        (op) => op.entity === 'orders' && op.action === 'create_order',
      );
      const selectedOps = operationId
        ? createOrderOps.filter((op) => op.id === operationId)
        : createOrderOps;

      for (const op of selectedOps) {
        try {
          await updateOperationStatus(op.id, 'processing');
          const payload = op.payload as QueuedCreateOrderPayload;
          if (!payload?.params || !payload?.local_order_id) {
            throw new Error('Invalid queued create_order payload');
          }

          const serverOrder = await createOrderRemote(payload.params);
          if (!serverOrder) throw new Error('Queued order sync failed');

          setOrders((prev) => {
            const withoutLocal = prev.filter((o) => o.id !== payload.local_order_id);
            const alreadyExists = withoutLocal.some((o) => o.id === serverOrder.id);
            const next = alreadyExists ? withoutLocal : [serverOrder, ...withoutLocal];
            void persistOrdersSnapshot(next);
            return next;
          });

          await markOperationSynced(op.id);
        } catch (err: any) {
          await markOperationFailed(op.id, err?.message || 'Failed to sync queued order');
        }
      }
    } finally {
      isSyncingRef.current = false;
    }
  }, [createOrderRemote, persistOrdersSnapshot]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const onOnline = () => {
      void syncQueuedOrders();
      void fetchOrders();
    };
    const onSyncRequest = (event: Event) => {
      const customEvent = event as CustomEvent<{ operationId?: string }>;
      const operationId = customEvent.detail?.operationId;
      void syncQueuedOrders(operationId);
      void fetchOrders();
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline-sync-request', onSyncRequest);
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      void syncQueuedOrders();
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline-sync-request', onSyncRequest);
    };
  }, [fetchOrders, syncQueuedOrders]);

  // ── Create order (the main "sell" action) ──────────────────────────────

  const createOrder = useCallback(
    async (params: CreateOrderParams): Promise<SaleOrder | null> => {
      try {
        const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
        if (isOnline) {
          const newOrder = await createOrderRemote(params);
          if (!newOrder) return null;
          const nextOrders = [newOrder, ...orders];
          setOrders(nextOrders);
          await persistOrdersSnapshot(nextOrders);
          return newOrder;
        }

        const localOrderId = `local-order-${crypto.randomUUID()}`;
        const localOrderNumber = `LOCAL-${new Date().getTime().toString().slice(-6)}`;
        const localCreatedAt = params.created_at || new Date().toISOString();
        const saleType = params.sale_type || 'cash';
        const discountAmount = params.discount_amount || 0;
        const itemsTotal = params.items.reduce((sum, item) => {
          const modifierTotal = (item.modifiers || []).reduce(
            (s, m) => s + (m.price || 0) * item.quantity,
            0,
          );
          return sum + item.unit_price * item.quantity + modifierTotal;
        }, 0);
        const subtotal = itemsTotal - discountAmount;
        const total = subtotal;
        const totalPaid = params.payments.reduce((s, p) => s + p.amount, 0);
        const paymentStatus: PaymentStatus =
          totalPaid >= total ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';

        const localOrder: SaleOrder = {
          id: localOrderId,
          order_number: localOrderNumber,
          business_mode: mode,
          order_type: params.order_type,
          source: 'pos',
          sale_type: saleType,
          customer_id: params.customer_id,
          customer_name: params.customer_name,
          customer_email: params.customer_email,
          customer_phone: params.customer_phone,
          table_number: params.table_number,
          invoice_number: localOrderNumber,
          due_date: params.due_date,
          consignment_info: params.consignment_info,
          subtotal,
          tax_rate: 0,
          tax_amount: 0,
          discount_amount: discountAmount,
          total,
          status: 'completed',
          payment_status: paymentStatus,
          notes: params.notes,
          staff_id: user?.id,
          staff_name: user?.full_name,
          created_at: localCreatedAt,
          completed_at: saleType === 'cash' ? localCreatedAt : undefined,
          items: params.items.map((item, index) => ({
            id: `local-item-${localOrderId}-${index}`,
            order_id: localOrderId,
            product_id: item.product_id,
            product_name: item.product_name,
            product_image: item.product_image,
            unit_price: item.unit_price,
            quantity: item.quantity,
            line_total:
              item.unit_price * item.quantity +
              (item.modifiers || []).reduce((s, m) => s + (m.price || 0) * item.quantity, 0),
            discount: 0,
            modifiers: item.modifiers || [],
            notes: item.notes,
            sku: item.sku,
            barcode: item.barcode,
          })),
          payments: params.payments.map((p, index) => ({
            id: `local-payment-${localOrderId}-${index}`,
            order_id: localOrderId,
            method: p.method,
            amount: p.amount,
            reference: p.reference,
            description: p.description,
            paid_at: p.paid_at || localCreatedAt,
          })),
        };

        const nextOrders = [localOrder, ...orders];
        setOrders(nextOrders);
        await persistOrdersSnapshot(nextOrders);

        await enqueueOperation({
          entity: 'orders',
          action: 'create_order',
          payload: {
            local_order_id: localOrderId,
            params,
          } satisfies QueuedCreateOrderPayload,
        });

        await applyOfflineInventoryDeduction(params);

        return localOrder;
      } catch (err: any) {
        console.error('Failed to create order:', err);
        setError(err.message || 'Failed to create order');
        return null;
      }
    },
    [
      isRestaurant,
      mode,
      user,
      orders,
      createOrderRemote,
      persistOrdersSnapshot,
      applyOfflineInventoryDeduction,
    ],
  );

  // ── Update order status ───────────────────────────────────────────────

  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      const updates: Record<string, unknown> = { status };
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
      }

      const { error: err } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId);

      if (err) throw err;
      await fetchOrders();
    },
    [fetchOrders],
  );

  // ── Void / refund ─────────────────────────────────────────────────────

  const voidOrder = useCallback(
    async (orderId: string) => {
      const { error: err } = await supabase
        .from('orders')
        .update({ status: 'voided', payment_status: 'voided' })
        .eq('id', orderId);

      if (err) throw err;
      await fetchOrders();
    },
    [fetchOrders],
  );

  const refundOrder = useCallback(
    async (orderId: string) => {
      const { error: err } = await supabase
        .from('orders')
        .update({ payment_status: 'refunded', status: 'cancelled' })
        .eq('id', orderId);

      if (err) throw err;
      await fetchOrders();
    },
    [fetchOrders],
  );

  // ── Record payment against an order ───────────────────────────────────

  const recordPayment = useCallback(
    async (
      orderId: string,
      payment: {
        method: PaymentMethod;
        amount: number;
        reference?: string;
        description?: string;
        paid_at?: string;
      },
    ): Promise<Payment | null> => {
      const order = orders.find((o) => o.id === orderId);
      if (!order) {
        setError('Order not found');
        return null;
      }

      // Supabase: insert payment row — the DB trigger handles customer balance + order status
      try {
        const { data, error: payErr } = await supabase
          .from('payments')
          .insert({
            order_id: orderId,
            method: payment.method,
            amount: payment.amount,
            reference: payment.reference || null,
            description: payment.description || null,
            paid_at: payment.paid_at || null,
          })
          .select()
          .single();

        if (payErr) throw payErr;

        // Refresh orders so we pick up the trigger-updated payment_status
        await fetchOrders();

        return {
          id: data.id,
          order_id: data.order_id,
          method: data.method,
          amount: Number(data.amount),
          reference: data.reference,
          description: data.description,
          paid_at: data.paid_at,
        };
      } catch (err: any) {
        console.error('Failed to record payment:', err);
        setError(err.message || 'Failed to record payment');
        return null;
      }
    },
    [orders, fetchOrders],
  );

  // ── Update payment ─────────────────────────────────────────────────────

  const updatePayment = useCallback(
    async (
      paymentId: string,
      updates: {
        method?: PaymentMethod;
        amount?: number;
        reference?: string;
        paid_at?: string;
      },
    ): Promise<Payment | null> => {
      // Find the order this payment belongs to
      const order = orders.find((o) => o.payments.some((p) => p.id === paymentId));
      if (!order) {
        setError('Order not found for payment');
        return null;
      }

      const existingPayment = order.payments.find((p) => p.id === paymentId);
      if (!existingPayment) {
        setError('Payment not found');
        return null;
      }

      try {
        const updateData: Record<string, unknown> = {};
        if (updates.method !== undefined) updateData.method = updates.method;
        if (updates.amount !== undefined) updateData.amount = updates.amount;
        if (updates.reference !== undefined) updateData.reference = updates.reference || null;
        if (updates.paid_at !== undefined) updateData.paid_at = updates.paid_at;

        const { data, error: payErr } = await supabase
          .from('payments')
          .update(updateData)
          .eq('id', paymentId)
          .select()
          .single();

        if (payErr) throw payErr;

        // The DB trigger will adjust customer balance and order payment_status
        await fetchOrders();

        return {
          id: data.id,
          order_id: data.order_id,
          method: data.method,
          amount: Number(data.amount),
          reference: data.reference,
          description: data.description,
          paid_at: data.paid_at,
        };
      } catch (err: any) {
        console.error('Failed to update payment:', err);
        setError(err.message || 'Failed to update payment');
        return null;
      }
    },
    [orders, fetchOrders],
  );

  // ── Delete payment ─────────────────────────────────────────────────────

  const deletePayment = useCallback(
    async (paymentId: string): Promise<boolean> => {
      const order = orders.find((o) => o.payments.some((p) => p.id === paymentId));
      if (!order) {
        setError('Order not found for payment');
        return false;
      }

      try {
        const { error: delErr } = await supabase
          .from('payments')
          .delete()
          .eq('id', paymentId);

        if (delErr) throw delErr;

        // The DB trigger will adjust customer balance and order payment_status
        await fetchOrders();
        return true;
      } catch (err: any) {
        console.error('Failed to delete payment:', err);
        setError(err.message || 'Failed to delete payment');
        return false;
      }
    },
    [orders, fetchOrders],
  );

  // ── Stats helpers ─────────────────────────────────────────────────────

  const todaysOrders = useMemo(() => {
    const today = new Date().toDateString();
    return orders.filter(
      (o) =>
        new Date(o.created_at).toDateString() === today &&
        o.status !== 'voided' &&
        o.status !== 'cancelled',
    );
  }, [orders]);

  const todaysRevenue = useMemo(
    () =>
      todaysOrders
        .filter((o) => o.payment_status === 'paid')
        .reduce((sum, o) => sum + o.total, 0),
    [todaysOrders],
  );

  // Credit-related helpers
  const unpaidCreditOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.sale_type === 'credit' &&
          o.payment_status !== 'paid' &&
          o.payment_status !== 'voided' &&
          o.payment_status !== 'refunded' &&
          o.status !== 'voided' &&
          o.status !== 'cancelled',
      ),
    [orders],
  );

  const totalOutstandingCredit = useMemo(
    () =>
      unpaidCreditOrders.reduce((sum, o) => {
        const paid = o.payments.reduce((s, p) => s + p.amount, 0);
        return sum + Math.max(o.total - paid, 0);
      }, 0),
    [unpaidCreditOrders],
  );

  const getOrderBalanceDue = useCallback(
    (order: SaleOrder) => {
      const paid = order.payments.reduce((s, p) => s + p.amount, 0);
      return Math.max(order.total - paid, 0);
    },
    [],
  );

  // ── Return ────────────────────────────────────────────────────────────

  return {
    orders,
    loading,
    error,
    refetch: fetchOrders,

    // Actions
    createOrder,
    updateOrderStatus,
    voidOrder,
    refundOrder,
    recordPayment,
    updatePayment,
    deletePayment,

    // Stats
    todaysOrders,
    todaysRevenue,

    // Credit helpers
    unpaidCreditOrders,
    totalOutstandingCredit,
    getOrderBalanceDue,
  };
}
