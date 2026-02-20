import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useBusinessMode } from '@/context/BusinessModeContext';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  business_mode: 'restaurant' | 'retail';
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  credit_balance: number;
  credit_limit: number;
  total_spent: number;
  total_orders: number;
  loyalty_points: number;
  status: 'active' | 'inactive' | 'vip' | 'suspended';
  notes?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerParams {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  credit_limit?: number;
  status?: string;
  notes?: string;
  tags?: string[];
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useCustomers() {
  const { mode } = useBusinessMode();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchErr } = await supabase
        .from('customers')
        .select('*')
        .eq('business_mode', mode)
        .order('last_name');

      if (fetchErr) throw fetchErr;

      setCustomers(
        (data || []).map((c: any) => ({
          ...c,
          credit_balance: Number(c.credit_balance),
          credit_limit: Number(c.credit_limit),
          total_spent: Number(c.total_spent),
          tags: c.tags || [],
        })),
      );
    } catch (err: any) {
      console.error('Failed to fetch customers:', err);
      setError(err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // ── Create ──────────────────────────────────────────────────────────────

  const createCustomer = useCallback(
    async (params: CreateCustomerParams): Promise<Customer | null> => {
      try {
        const { data, error: err } = await supabase
          .from('customers')
          .insert({
            ...params,
            business_mode: mode,
          })
          .select()
          .single();

        if (err) throw err;
        await fetchCustomers();
        return data as Customer;
      } catch (err: any) {
        console.error('Failed to create customer:', err);
        setError(err.message);
        return null;
      }
    },
    [mode, fetchCustomers],
  );

  // ── Update ──────────────────────────────────────────────────────────────

  const updateCustomer = useCallback(
    async (id: string, updates: Partial<CreateCustomerParams>) => {
      try {
        const { error: err } = await supabase
          .from('customers')
          .update(updates)
          .eq('id', id);
        if (err) throw err;
        await fetchCustomers();
      } catch (err: any) {
        console.error('Failed to update customer:', err);
        setError(err.message);
      }
    },
    [fetchCustomers],
  );

  // ── Make payment against customer balance ───────────────────────────────

  const makePaymentOnAccount = useCallback(
    async (
      customerId: string,
      amount: number,
      method: 'cash' | 'card' | 'qr',
    ) => {
      try {
        // Reduce customer balance directly
        const customer = customers.find((c) => c.id === customerId);
        if (!customer) throw new Error('Customer not found');

        const { error: err } = await supabase
          .from('customers')
          .update({
            credit_balance: Math.max(customer.credit_balance - amount, 0),
          })
          .eq('id', customerId);

        if (err) throw err;
        await fetchCustomers();
        return { success: true };
      } catch (err: any) {
        console.error('Failed to process payment:', err);
        return { success: false, error: err.message };
      }
    },
    [customers, fetchCustomers],
  );

  // ── Adjust customer balance (positive = increase, negative = decrease) ──

  const adjustCustomerBalance = useCallback(
    async (customerId: string, delta: number) => {
      if (delta === 0) return { success: true };

      try {
        const customer = customers.find((c) => c.id === customerId);
        if (!customer) throw new Error('Customer not found');

        const { error: err } = await supabase
          .from('customers')
          .update({
            credit_balance: Math.max(customer.credit_balance + delta, 0),
          })
          .eq('id', customerId);

        if (err) throw err;
        await fetchCustomers();
        return { success: true };
      } catch (err: any) {
        console.error('Failed to adjust customer balance:', err);
        return { success: false, error: err.message };
      }
    },
    [customers, fetchCustomers],
  );

  // ── Helpers ──────────────────────────────────────────────────────────────

  const customersWithBalance = useMemo(
    () => customers.filter((c) => c.credit_balance > 0),
    [customers],
  );

  const totalOutstanding = useMemo(
    () => customers.reduce((sum, c) => sum + c.credit_balance, 0),
    [customers],
  );

  const getCustomerById = useCallback(
    (id: string) => customers.find((c) => c.id === id) || null,
    [customers],
  );

  const getCustomerDisplayName = useCallback(
    (customer: Customer) => `${customer.first_name} ${customer.last_name}`.trim(),
    [],
  );

  return {
    customers,
    loading,
    error,
    refetch: fetchCustomers,

    // CRUD
    createCustomer,
    updateCustomer,

    // Payment
    makePaymentOnAccount,
    adjustCustomerBalance,

    // Helpers
    customersWithBalance,
    totalOutstanding,
    getCustomerById,
    getCustomerDisplayName,
  };
}
