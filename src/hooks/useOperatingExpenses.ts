import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useBusinessMode } from '@/context/BusinessModeContext';
import { useAuth } from '@/context/AuthContext';

export const EXPENSE_CATEGORIES = [
  { id: 'rent', label: 'Rent' },
  { id: 'salaries', label: 'Salaries & wages' },
  { id: 'utilities', label: 'Utilities' },
  { id: 'transport', label: 'Transport & fuel' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'supplies', label: 'Office & supplies' },
  { id: 'maintenance', label: 'Maintenance & repairs' },
  { id: 'fees', label: 'Bank & payment fees' },
  { id: 'other', label: 'Other' },
] as const;

/** Route / van-run expenses shown on daily assignment reports */
export const ROUTE_EXPENSE_CATEGORIES = [
  { id: 'route_fuel', label: 'Fuel' },
  { id: 'route_food', label: 'Food' },
  { id: 'route_oil', label: 'Oil & maintenance' },
  { id: 'route_debt', label: 'Customer debt payment' },
  { id: 'route_discount', label: 'Discount out' },
  { id: 'route_other', label: 'Other route expense' },
] as const;

export const ALL_EXPENSE_CATEGORIES = [
  ...EXPENSE_CATEGORIES,
  ...ROUTE_EXPENSE_CATEGORIES,
] as const;

export type ExpenseCategoryId = (typeof EXPENSE_CATEGORIES)[number]['id'];

export function expenseCategoryLabel(id: string): string {
  return ALL_EXPENSE_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function isRouteExpenseCategory(id: string): boolean {
  return ROUTE_EXPENSE_CATEGORIES.some((c) => c.id === id);
}

export interface OperatingExpense {
  id: string;
  store_id: string;
  business_mode: 'restaurant' | 'retail';
  category: string;
  description: string;
  amount: number;
  expense_date: string;
  reference: string | null;
  notes: string | null;
  staff_id: string | null;
  staff_name: string | null;
  assignment_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateExpenseParams {
  category: string;
  description: string;
  amount: number;
  expense_date: string;
  reference?: string;
  notes?: string;
  assignment_id?: string;
}

function mapRow(row: Record<string, unknown>): OperatingExpense {
  return {
    id: row.id as string,
    store_id: row.store_id as string,
    business_mode: row.business_mode as 'restaurant' | 'retail',
    category: row.category as string,
    description: (row.description as string) || '',
    amount: Number(row.amount),
    expense_date: row.expense_date as string,
    reference: (row.reference as string) || null,
    notes: (row.notes as string) || null,
    staff_id: (row.staff_id as string) || null,
    staff_name: (row.staff_name as string) || null,
    assignment_id: (row.assignment_id as string) || null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function useOperatingExpenses() {
  const { mode } = useBusinessMode();
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<OperatingExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInRange = useCallback(
    async (startIso: string, endIso: string) => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase
          .from('operating_expenses')
          .select('*')
          .eq('business_mode', mode)
          .gte('expense_date', startIso)
          .lte('expense_date', endIso)
          .order('expense_date', { ascending: false });

        if (err) throw err;
        setExpenses((data || []).map((row) => mapRow(row as Record<string, unknown>)));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load expenses';
        setError(message);
        setExpenses([]);
      } finally {
        setLoading(false);
      }
    },
    [mode],
  );

  const addExpense = useCallback(
    async (params: CreateExpenseParams) => {
      const { data, error: err } = await supabase
        .from('operating_expenses')
        .insert({
          business_mode: mode,
          category: params.category,
          description: params.description.trim(),
          amount: params.amount,
          expense_date: params.expense_date,
          reference: params.reference?.trim() || null,
          notes: params.notes?.trim() || null,
          staff_id: user?.id || null,
          staff_name: user?.full_name || null,
          assignment_id: params.assignment_id || null,
        })
        .select()
        .single();

      if (err) throw err;
      const created = mapRow(data as Record<string, unknown>);
      setExpenses((prev) => [created, ...prev]);
      return created;
    },
    [mode, user?.id, user?.full_name],
  );

  const deleteExpense = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('operating_expenses').delete().eq('id', id);
    if (err) throw err;
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return {
    expenses,
    loading,
    error,
    fetchInRange,
    addExpense,
    deleteExpense,
  };
}
