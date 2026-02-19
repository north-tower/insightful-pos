import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useBusinessMode } from '@/context/BusinessModeContext';
import { useAuth } from '@/context/AuthContext';
import { mockOrderHistory, Order as LegacyOrder } from '@/data/orderData';

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
  }>;
}

// ─── Demo counter ───────────────────────────────────────────────────────────
let demoOrderCounter = 100;

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useOrders() {
  const { mode, isRestaurant } = useBusinessMode();
  const { user, isDemoMode } = useAuth();

  const [orders, setOrders] = useState<SaleOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch orders ────────────────────────────────────────────────────────

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (isDemoMode) {
      // Convert legacy mock data to SaleOrder shape
      const demoOrders: SaleOrder[] = mockOrderHistory.map((o: LegacyOrder) => ({
        id: o.id,
        order_number: o.orderNumber,
        business_mode: mode,
        order_type: o.type,
        source: 'pos',
        sale_type: 'cash' as SaleType,
        customer_name: o.customerName,
        table_number: o.tableNumber,
        subtotal: o.subtotal,
        tax_rate: 0.05,
        tax_amount: o.tax,
        discount_amount: o.discount || 0,
        total: o.total,
        status: o.status as OrderStatus,
        payment_status: o.paymentStatus as PaymentStatus,
        notes: o.notes,
        staff_id: o.staffId,
        created_at: o.createdAt.toISOString(),
        completed_at: o.completedAt?.toISOString(),
        items: o.items.map((item, idx) => ({
          id: `${o.id}-item-${idx}`,
          order_id: o.id,
          product_id: item.id,
          product_name: item.name,
          product_image: item.image,
          unit_price: item.price,
          quantity: item.quantity,
          line_total: item.price * item.quantity,
          discount: 0,
          modifiers: item.modifiers || [],
          notes: item.notes,
        })),
        payments: o.splitPayments
          ? o.splitPayments.map((sp) => ({
              id: sp.id,
              order_id: o.id,
              method: sp.method as PaymentMethod,
              amount: sp.amount,
              paid_at: sp.paidAt.toISOString(),
            }))
          : o.paymentMethod && o.paymentStatus === 'paid'
          ? [
              {
                id: `${o.id}-pay`,
                order_id: o.id,
                method: o.paymentMethod as PaymentMethod,
                amount: o.total,
                paid_at: o.createdAt.toISOString(),
              },
            ]
          : [],
      }));
      setOrders(demoOrders);
      setLoading(false);
      return;
    }

    // Supabase fetch
    try {
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .select('*')
        .eq('business_mode', mode)
        .order('created_at', { ascending: false })
        .limit(100);

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
    } catch (err: any) {
      console.error('Failed to fetch orders:', err);
      setError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [mode, isDemoMode]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // ── Create order (the main "sell" action) ──────────────────────────────

  const createOrder = useCallback(
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
      const taxRate = 0.05;
      const taxAmount = subtotal * taxRate;
      const total = subtotal + taxAmount;

      const saleType = params.sale_type || 'cash';
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

      // ── Demo mode ─────────────────────────────────────────────────────
      if (isDemoMode) {
        demoOrderCounter++;
        const prefix = isRestaurant ? 'F' : 'R';
        const orderNumber = `${prefix}${String(demoOrderCounter).padStart(4, '0')}`;
        const invoiceNumber = `INV-${new Date().getFullYear()}-${String(demoOrderCounter).padStart(4, '0')}`;

        const newOrder: SaleOrder = {
          id: `demo-${Date.now()}`,
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
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          discount_amount: discountAmount,
          total,
          status: saleType === 'credit' && paymentStatus !== 'paid' ? 'completed' : 'completed',
          payment_status: paymentStatus,
          notes: params.notes,
          staff_id: user?.id,
          staff_name: user?.full_name,
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          items: params.items.map((item, idx) => ({
            id: `demo-item-${Date.now()}-${idx}`,
            order_id: `demo-${Date.now()}`,
            product_id: item.product_id,
            product_name: item.product_name,
            product_image: item.product_image,
            unit_price: item.unit_price,
            quantity: item.quantity,
            line_total:
              item.unit_price * item.quantity +
              (item.modifiers || []).reduce(
                (s, m) => s + (m.price || 0) * item.quantity,
                0,
              ),
            discount: 0,
            modifiers: item.modifiers || [],
            notes: item.notes,
            sku: item.sku,
            barcode: item.barcode,
          })),
          payments: params.payments.map((p, idx) => ({
            id: `demo-pay-${Date.now()}-${idx}`,
            order_id: `demo-${Date.now()}`,
            method: p.method,
            amount: p.amount,
            reference: p.reference,
            paid_at: new Date().toISOString(),
          })),
        };

        setOrders((prev) => [newOrder, ...prev]);
        return newOrder;
      }

      // ── Supabase mode ─────────────────────────────────────────────────
      try {
        // 1. Get next order number via RPC
        const { data: orderNumData, error: orderNumErr } = await supabase.rpc(
          'generate_order_number',
          { p_business_mode: mode },
        );
        if (orderNumErr) throw orderNumErr;
        const orderNumber = orderNumData as string;

        // Generate invoice number
        const { data: invNumData } = await supabase.rpc('generate_invoice_number');
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
            completed_at: saleType === 'cash' ? new Date().toISOString() : null,
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
          }));

          const { data: payData, error: payErr } = await supabase
            .from('payments')
            .insert(paymentRows)
            .select();

          if (payErr) throw payErr;
          insertedPayments = payData || [];
        }

        // 5. Build the returned order
        const newOrder: SaleOrder = {
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
            paid_at: p.paid_at,
          })),
        };

        setOrders((prev) => [newOrder, ...prev]);
        return newOrder;
      } catch (err: any) {
        console.error('Failed to create order:', err);
        setError(err.message || 'Failed to create order');
        return null;
      }
    },
    [isDemoMode, isRestaurant, mode, user],
  );

  // ── Update order status ───────────────────────────────────────────────

  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      if (isDemoMode) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status,
                  completed_at:
                    status === 'completed'
                      ? new Date().toISOString()
                      : o.completed_at,
                }
              : o,
          ),
        );
        return;
      }

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
    [isDemoMode, fetchOrders],
  );

  // ── Void / refund ─────────────────────────────────────────────────────

  const voidOrder = useCallback(
    async (orderId: string) => {
      if (isDemoMode) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? { ...o, status: 'voided' as OrderStatus, payment_status: 'voided' as PaymentStatus }
              : o,
          ),
        );
        return;
      }

      const { error: err } = await supabase
        .from('orders')
        .update({ status: 'voided', payment_status: 'voided' })
        .eq('id', orderId);

      if (err) throw err;
      await fetchOrders();
    },
    [isDemoMode, fetchOrders],
  );

  const refundOrder = useCallback(
    async (orderId: string) => {
      if (isDemoMode) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? { ...o, payment_status: 'refunded' as PaymentStatus, status: 'cancelled' as OrderStatus }
              : o,
          ),
        );
        return;
      }

      const { error: err } = await supabase
        .from('orders')
        .update({ payment_status: 'refunded', status: 'cancelled' })
        .eq('id', orderId);

      if (err) throw err;
      await fetchOrders();
    },
    [isDemoMode, fetchOrders],
  );

  // ── Record payment against an order ───────────────────────────────────

  const recordPayment = useCallback(
    async (
      orderId: string,
      payment: { method: PaymentMethod; amount: number; reference?: string },
    ): Promise<Payment | null> => {
      const order = orders.find((o) => o.id === orderId);
      if (!order) {
        setError('Order not found');
        return null;
      }

      const existingPaid = order.payments.reduce((s, p) => s + p.amount, 0);
      const newTotalPaid = existingPaid + payment.amount;
      const newPaymentStatus: PaymentStatus =
        newTotalPaid >= order.total ? 'paid' : newTotalPaid > 0 ? 'partial' : 'unpaid';

      if (isDemoMode) {
        const newPayment: Payment = {
          id: `demo-pay-${Date.now()}`,
          order_id: orderId,
          method: payment.method,
          amount: payment.amount,
          reference: payment.reference,
          paid_at: new Date().toISOString(),
        };

        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  payments: [...o.payments, newPayment],
                  payment_status: newPaymentStatus,
                }
              : o,
          ),
        );
        return newPayment;
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
          paid_at: data.paid_at,
        };
      } catch (err: any) {
        console.error('Failed to record payment:', err);
        setError(err.message || 'Failed to record payment');
        return null;
      }
    },
    [isDemoMode, orders, fetchOrders],
  );

  // ── Update payment ─────────────────────────────────────────────────────

  const updatePayment = useCallback(
    async (
      paymentId: string,
      updates: { method?: PaymentMethod; amount?: number; reference?: string },
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

      const updatedAmount = updates.amount ?? existingPayment.amount;
      const amountDiff = updatedAmount - existingPayment.amount;

      // Recalculate order payment status
      const otherPaid = order.payments
        .filter((p) => p.id !== paymentId)
        .reduce((s, p) => s + p.amount, 0);
      const newTotalPaid = otherPaid + updatedAmount;
      const newPaymentStatus: PaymentStatus =
        newTotalPaid >= order.total ? 'paid' : newTotalPaid > 0 ? 'partial' : 'unpaid';

      if (isDemoMode) {
        const updatedPayment: Payment = {
          ...existingPayment,
          method: updates.method ?? existingPayment.method,
          amount: updatedAmount,
          reference: updates.reference !== undefined ? updates.reference : existingPayment.reference,
        };

        setOrders((prev) =>
          prev.map((o) =>
            o.id === order.id
              ? {
                  ...o,
                  payments: o.payments.map((p) =>
                    p.id === paymentId ? updatedPayment : p,
                  ),
                  payment_status: newPaymentStatus,
                }
              : o,
          ),
        );
        return updatedPayment;
      }

      // Supabase
      try {
        const updateData: Record<string, unknown> = {};
        if (updates.method !== undefined) updateData.method = updates.method;
        if (updates.amount !== undefined) updateData.amount = updates.amount;
        if (updates.reference !== undefined) updateData.reference = updates.reference || null;

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
          paid_at: data.paid_at,
        };
      } catch (err: any) {
        console.error('Failed to update payment:', err);
        setError(err.message || 'Failed to update payment');
        return null;
      }
    },
    [isDemoMode, orders, fetchOrders],
  );

  // ── Delete payment ─────────────────────────────────────────────────────

  const deletePayment = useCallback(
    async (paymentId: string): Promise<boolean> => {
      const order = orders.find((o) => o.payments.some((p) => p.id === paymentId));
      if (!order) {
        setError('Order not found for payment');
        return false;
      }

      const existingPayment = order.payments.find((p) => p.id === paymentId);
      if (!existingPayment) {
        setError('Payment not found');
        return false;
      }

      // Recalculate order payment status after removal
      const remainingPaid = order.payments
        .filter((p) => p.id !== paymentId)
        .reduce((s, p) => s + p.amount, 0);
      const newPaymentStatus: PaymentStatus =
        remainingPaid >= order.total ? 'paid' : remainingPaid > 0 ? 'partial' : 'unpaid';

      if (isDemoMode) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === order.id
              ? {
                  ...o,
                  payments: o.payments.filter((p) => p.id !== paymentId),
                  payment_status: newPaymentStatus,
                }
              : o,
          ),
        );
        return true;
      }

      // Supabase
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
    [isDemoMode, orders, fetchOrders],
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
