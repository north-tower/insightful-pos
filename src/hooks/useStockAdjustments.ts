import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export interface StockAdjustmentRow {
  id: string;
  product_id: string;
  variant_id: string | null;
  type: 'restock' | 'damaged' | 'returned' | 'sold' | 'adjustment';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  note: string | null;
  staff_id: string | null;
  created_at: string;
  // Joined
  product_name?: string;
  staff_name?: string;
}

export function useStockAdjustments(limit = 20) {
  const { user } = useAuth();
  const [adjustments, setAdjustments] = useState<StockAdjustmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAdjustments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch stock adjustments joined with product name and staff name
      const { data, error: fetchErr } = await supabase
        .from('stock_adjustments')
        .select(`
          *,
          products:product_id ( name ),
          profiles:staff_id ( full_name )
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fetchErr) throw fetchErr;

      const rows: StockAdjustmentRow[] = (data || []).map((row: any) => ({
        id: row.id,
        product_id: row.product_id,
        variant_id: row.variant_id,
        type: row.type,
        quantity: row.quantity,
        previous_stock: row.previous_stock,
        new_stock: row.new_stock,
        note: row.note,
        staff_id: row.staff_id,
        created_at: row.created_at,
        product_name: row.products?.name || 'Unknown Product',
        staff_name: row.profiles?.full_name || 'System',
      }));

      setAdjustments(rows);
    } catch (err: any) {
      console.error('Failed to fetch stock adjustments:', err);
      setError(err.message || 'Failed to load adjustments');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchAdjustments();
  }, [fetchAdjustments]);

  /**
   * Adjust stock for a product. Updates the product row and inserts an
   * adjustment record.
   */
  const adjustStock = useCallback(
    async (
      productId: string,
      type: StockAdjustmentRow['type'],
      quantity: number, // positive = add, negative = subtract
      note?: string,
    ) => {
      // 1. Get current stock
      const { data: product, error: pErr } = await supabase
        .from('products')
        .select('stock')
        .eq('id', productId)
        .single();

      if (pErr) throw pErr;

      const previousStock = product.stock ?? 0;
      const newStock = Math.max(0, previousStock + quantity);

      // 2. Update product stock
      const { error: updErr } = await supabase
        .from('products')
        .update({ stock: newStock, updated_at: new Date().toISOString() })
        .eq('id', productId);

      if (updErr) throw updErr;

      // 3. Insert adjustment record
      const { error: insErr } = await supabase
        .from('stock_adjustments')
        .insert({
          product_id: productId,
          type,
          quantity,
          previous_stock: previousStock,
          new_stock: newStock,
          note: note || null,
          staff_id: user?.id || null,
        });

      if (insErr) throw insErr;

      // 4. Refresh the list
      await fetchAdjustments();

      return { previousStock, newStock };
    },
    [user?.id, fetchAdjustments],
  );

  return {
    adjustments,
    loading,
    error,
    refetch: fetchAdjustments,
    adjustStock,
  };
}
