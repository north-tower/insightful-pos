import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
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

// ─── Demo data ──────────────────────────────────────────────────────────────

const demoCustomers: Customer[] = [
  {
    id: 'demo-cust-1',
    business_mode: 'restaurant',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1 (555) 123-4567',
    address: '123 Main Street',
    city: 'New York',
    postal_code: '10001',
    country: 'USA',
    credit_balance: 0,
    credit_limit: 5000,
    total_spent: 3420.50,
    total_orders: 28,
    loyalty_points: 1250,
    status: 'vip',
    notes: 'Prefers window seating. Regular customer.',
    tags: ['regular', 'vip', 'preferred'],
    created_at: '2023-01-15T00:00:00Z',
    updated_at: '2024-01-10T00:00:00Z',
  },
  {
    id: 'demo-cust-2',
    business_mode: 'restaurant',
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane.smith@example.com',
    phone: '+1 (555) 234-5678',
    address: '456 Oak Avenue',
    city: 'Los Angeles',
    postal_code: '90001',
    country: 'USA',
    credit_balance: 250.00,
    credit_limit: 2000,
    total_spent: 1890.25,
    total_orders: 15,
    loyalty_points: 850,
    status: 'active',
    notes: 'Vegetarian. Orders frequently for delivery.',
    tags: ['vegetarian', 'delivery'],
    created_at: '2023-03-20T00:00:00Z',
    updated_at: '2024-01-08T00:00:00Z',
  },
  {
    id: 'demo-cust-3',
    business_mode: 'restaurant',
    first_name: 'Sarah',
    last_name: 'Williams',
    email: 'sarah.w@example.com',
    phone: '+1 (555) 456-7890',
    address: '321 Elm Street',
    city: 'Houston',
    postal_code: '77001',
    country: 'USA',
    credit_balance: 150.75,
    credit_limit: 3000,
    total_spent: 5420.00,
    total_orders: 45,
    loyalty_points: 2100,
    status: 'vip',
    notes: 'VIP member. Prefers table 12.',
    tags: ['vip', 'wine', 'preferred'],
    created_at: '2022-11-05T00:00:00Z',
    updated_at: '2024-01-12T00:00:00Z',
  },
  {
    id: 'demo-cust-4',
    business_mode: 'retail',
    first_name: 'Acme Corp',
    last_name: 'Ltd',
    email: 'procurement@acmecorp.com',
    phone: '+1 (555) 111-2222',
    address: '100 Business Blvd',
    city: 'San Francisco',
    postal_code: '94101',
    country: 'USA',
    credit_balance: 1250.00,
    credit_limit: 10000,
    total_spent: 15800.00,
    total_orders: 42,
    loyalty_points: 0,
    status: 'vip',
    notes: 'Regular bulk orders. Net-30 terms.',
    tags: ['corporate', 'bulk', 'net-30'],
    created_at: '2022-06-15T00:00:00Z',
    updated_at: '2024-01-10T00:00:00Z',
  },
  {
    id: 'demo-cust-5',
    business_mode: 'retail',
    first_name: 'Tech Solutions',
    last_name: 'Inc',
    email: 'orders@techsolutions.com',
    phone: '+1 (555) 555-6666',
    address: '200 Innovation Dr',
    city: 'Austin',
    postal_code: '78701',
    country: 'USA',
    credit_balance: 3200.00,
    credit_limit: 15000,
    total_spent: 28500.75,
    total_orders: 65,
    loyalty_points: 0,
    status: 'vip',
    notes: 'IT supplies. Weekly orders.',
    tags: ['corporate', 'weekly', 'net-15'],
    created_at: '2022-03-10T00:00:00Z',
    updated_at: '2024-01-11T00:00:00Z',
  },
  {
    id: 'demo-cust-6',
    business_mode: 'retail',
    first_name: 'Maria',
    last_name: 'Garcia',
    email: 'maria.g@example.com',
    phone: '+1 (555) 333-4444',
    address: '52 Central Ave',
    city: 'Miami',
    postal_code: '33101',
    country: 'USA',
    credit_balance: 0,
    credit_limit: 500,
    total_spent: 890.50,
    total_orders: 8,
    loyalty_points: 200,
    status: 'active',
    notes: '',
    tags: ['regular'],
    created_at: '2023-08-20T00:00:00Z',
    updated_at: '2024-01-05T00:00:00Z',
  },
];

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useCustomers() {
  const { mode } = useBusinessMode();
  const isDemoMode = !isSupabaseConfigured();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (isDemoMode) {
      setCustomers(demoCustomers.filter((c) => c.business_mode === mode));
      setLoading(false);
      return;
    }

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
  }, [mode, isDemoMode]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // ── Create ──────────────────────────────────────────────────────────────

  const createCustomer = useCallback(
    async (params: CreateCustomerParams): Promise<Customer | null> => {
      if (isDemoMode) {
        const newCustomer: Customer = {
          id: `demo-cust-${Date.now()}`,
          business_mode: mode,
          first_name: params.first_name,
          last_name: params.last_name,
          email: params.email,
          phone: params.phone,
          address: params.address,
          city: params.city,
          postal_code: params.postal_code,
          country: params.country || 'USA',
          credit_balance: 0,
          credit_limit: params.credit_limit || 0,
          total_spent: 0,
          total_orders: 0,
          loyalty_points: 0,
          status: (params.status as Customer['status']) || 'active',
          notes: params.notes,
          tags: params.tags || [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setCustomers((prev) => [...prev, newCustomer]);
        return newCustomer;
      }

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
    [isDemoMode, mode, fetchCustomers],
  );

  // ── Update ──────────────────────────────────────────────────────────────

  const updateCustomer = useCallback(
    async (id: string, updates: Partial<CreateCustomerParams>) => {
      if (isDemoMode) {
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === id
              ? { ...c, ...updates, updated_at: new Date().toISOString() }
              : c,
          ),
        );
        return;
      }

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
    [isDemoMode, fetchCustomers],
  );

  // ── Make payment against customer balance ───────────────────────────────

  const makePaymentOnAccount = useCallback(
    async (
      customerId: string,
      amount: number,
      method: 'cash' | 'card' | 'qr',
    ) => {
      if (isDemoMode) {
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === customerId
              ? {
                  ...c,
                  credit_balance: Math.max(c.credit_balance - amount, 0),
                  updated_at: new Date().toISOString(),
                }
              : c,
          ),
        );
        return { success: true };
      }

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
    [isDemoMode, customers, fetchCustomers],
  );

  // ── Adjust customer balance (positive = increase, negative = decrease) ──

  const adjustCustomerBalance = useCallback(
    async (customerId: string, delta: number) => {
      if (delta === 0) return { success: true };

      if (isDemoMode) {
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === customerId
              ? {
                  ...c,
                  credit_balance: Math.max(c.credit_balance + delta, 0),
                  updated_at: new Date().toISOString(),
                }
              : c,
          ),
        );
        return { success: true };
      }

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
    [isDemoMode, customers, fetchCustomers],
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
