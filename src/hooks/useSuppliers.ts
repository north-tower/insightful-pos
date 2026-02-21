import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useBusinessMode } from '@/context/BusinessModeContext';

export interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  status: 'active' | 'inactive';
  notes: string | null;
  business_mode: string;
  created_at: string;
  updated_at: string;
}

export function useSuppliers() {
  const { mode } = useBusinessMode();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('suppliers')
        .select('*')
        .eq('business_mode', mode)
        .order('name');

      if (err) throw err;
      setSuppliers(data || []);
      return data || [];
    } catch (err: any) {
      console.error('Failed to fetch suppliers:', err);
      setError(err.message || 'Failed to load suppliers');
      return [];
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const addSupplier = useCallback(
    async (supplier: Omit<Supplier, 'id' | 'created_at' | 'updated_at' | 'business_mode'>) => {
      const { data, error: err } = await supabase
        .from('suppliers')
        .insert({ ...supplier, business_mode: mode })
        .select()
        .single();
      if (err) throw err;
      await fetchSuppliers();
      return data as Supplier;
    },
    [mode, fetchSuppliers],
  );

  const updateSupplier = useCallback(
    async (id: string, updates: Partial<Supplier>) => {
      const { error: err } = await supabase
        .from('suppliers')
        .update(updates)
        .eq('id', id);
      if (err) throw err;
      await fetchSuppliers();
    },
    [fetchSuppliers],
  );

  const deleteSupplier = useCallback(
    async (id: string) => {
      const { error: err } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);
      if (err) throw err;
      await fetchSuppliers();
    },
    [fetchSuppliers],
  );

  return {
    suppliers,
    loading,
    error,
    refetch: fetchSuppliers,
    addSupplier,
    updateSupplier,
    deleteSupplier,
  };
}
