import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useBusinessMode } from '@/context/BusinessModeContext';
import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/hooks/useOrders';

export type LedgerPaymentKind = 'order' | 'account';

export interface LedgerPaymentRow {
  id: string;
  kind: LedgerPaymentKind;
  method: PaymentMethod | string;
  amount: number;
  reference?: string;
  description?: string;
  paid_at: string;
  order_id?: string;
  order_number?: string;
  customer_id?: string;
  customer_name?: string;
  order_payment_status?: PaymentStatus;
  order_status?: OrderStatus;
}

const FETCH_LIMIT = 400;

export function usePaymentLedger() {
  const { mode } = useBusinessMode();
  const [rows, setRows] = useState<LedgerPaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [orderPayRes, accountPayRes] = await Promise.all([
        supabase
          .from('payments')
          .select(
            `
            id,
            order_id,
            method,
            amount,
            reference,
            description,
            paid_at,
            orders!inner (
              order_number,
              customer_id,
              customer_name,
              payment_status,
              status,
              business_mode
            )
          `,
          )
          .eq('orders.business_mode', mode)
          .order('paid_at', { ascending: false })
          .limit(FETCH_LIMIT),
        supabase
          .from('customer_account_payments')
          .select(
            `
            id,
            customer_id,
            method,
            amount,
            reference,
            notes,
            created_at,
            customers (
              first_name,
              last_name,
              business_mode
            )
          `,
          )
          .order('created_at', { ascending: false })
          .limit(FETCH_LIMIT),
      ]);

      if (orderPayRes.error) throw orderPayRes.error;
      if (accountPayRes.error) throw accountPayRes.error;

      const orderRows: LedgerPaymentRow[] = (orderPayRes.data || []).map((p: any) => {
        const order = p.orders;
        return {
          id: p.id,
          kind: 'order' as const,
          method: p.method,
          amount: Number(p.amount),
          reference: p.reference || undefined,
          description: p.description || undefined,
          paid_at: p.paid_at,
          order_id: p.order_id,
          order_number: order?.order_number,
          customer_id: order?.customer_id || undefined,
          customer_name: order?.customer_name || undefined,
          order_payment_status: order?.payment_status,
          order_status: order?.status,
        };
      });

      const accountRows: LedgerPaymentRow[] = (accountPayRes.data || [])
        .filter((p: any) => p.customers?.business_mode === mode)
        .map((p: any) => {
        const c = p.customers;
        const name =
          c && (c.first_name || c.last_name)
            ? `${c.first_name || ''} ${c.last_name || ''}`.trim()
            : undefined;
        return {
          id: p.id,
          kind: 'account' as const,
          method: p.method,
          amount: Number(p.amount),
          reference: p.reference || undefined,
          description: p.notes || undefined,
          paid_at: p.created_at,
          customer_id: p.customer_id,
          customer_name: name,
        };
      });

      const merged = [...orderRows, ...accountRows].sort(
        (a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime(),
      );

      setRows(merged);
      return merged;
    } catch (err: any) {
      console.error('Failed to load payment ledger:', err);
      setError(err.message || 'Failed to load payments');
      setRows([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void fetchLedger();
  }, [fetchLedger]);

  return { rows, loading, error, refetch: fetchLedger };
}
