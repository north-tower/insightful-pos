import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useBusinessMode } from '@/context/BusinessModeContext';
import { useAuth } from '@/context/AuthContext';

// ── Types ───────────────────────────────────────────────────────────────────

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string | null;
  product_name: string;
  product_sku: string | null;
  quantity: number;
  unit_cost: number;
  line_total: number;
}

export interface Purchase {
  id: string;
  purchase_number: string;
  business_mode: string;
  supplier_id: string | null;
  status: 'draft' | 'received' | 'cancelled';
  subtotal: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  reference: string | null;
  staff_id: string | null;
  staff_name: string | null;
  order_date: string;
  received_date: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  items?: PurchaseItem[];
  supplier_name?: string;
}

export interface NewPurchaseItem {
  product_id: string | null;
  product_name: string;
  product_sku: string | null;
  quantity: number;
  unit_cost: number;
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function usePurchases() {
  const { mode } = useBusinessMode();
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch ───────────────────────────────────────────────────────────────

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('purchases')
        .select(`
          *,
          purchase_items (*),
          suppliers ( name )
        `)
        .eq('business_mode', mode)
        .order('created_at', { ascending: false });

      if (err) throw err;

      const mapped: Purchase[] = (data || []).map((row: any) => ({
        ...row,
        subtotal: Number(row.subtotal),
        tax_amount: Number(row.tax_amount),
        total: Number(row.total),
        items: (row.purchase_items || []).map((item: any) => ({
          ...item,
          quantity: Number(item.quantity),
          unit_cost: Number(item.unit_cost),
          line_total: Number(item.line_total),
        })),
        supplier_name: row.suppliers?.name || null,
      }));

      setPurchases(mapped);
      return mapped;
    } catch (err: any) {
      console.error('Failed to fetch purchases:', err);
      setError(err.message || 'Failed to load purchases');
      return [];
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  // ── Create purchase ─────────────────────────────────────────────────────

  const createPurchase = useCallback(
    async (
      supplierId: string | null,
      items: NewPurchaseItem[],
      opts?: { notes?: string; reference?: string; receivedImmediately?: boolean },
    ) => {
      // Generate purchase number
      const { data: poNum, error: poErr } = await supabase
        .rpc('generate_purchase_number');
      if (poErr) throw poErr;

      const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);
      const total = subtotal; // No tax on purchases by default

      const status = opts?.receivedImmediately ? 'received' : 'draft';

      // Insert purchase header
      const { data: purchaseRow, error: insertErr } = await supabase
        .from('purchases')
        .insert({
          purchase_number: poNum,
          business_mode: mode,
          supplier_id: supplierId || null,
          status: 'draft', // always start as draft
          subtotal,
          tax_amount: 0,
          total,
          notes: opts?.notes || null,
          reference: opts?.reference || null,
          staff_id: user?.id || null,
          staff_name: user?.full_name || null,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      // Insert line items
      const lineItems = items.map((item) => ({
        purchase_id: purchaseRow.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        line_total: item.quantity * item.unit_cost,
      }));

      const { error: itemsErr } = await supabase
        .from('purchase_items')
        .insert(lineItems);

      if (itemsErr) throw itemsErr;

      // If receiving immediately, update status to trigger the stock update
      if (status === 'received') {
        const { error: upErr } = await supabase
          .from('purchases')
          .update({ status: 'received' })
          .eq('id', purchaseRow.id);
        if (upErr) throw upErr;
      }

      await fetchPurchases();
      return purchaseRow;
    },
    [mode, user, fetchPurchases],
  );

  // ── Receive purchase (mark as received) ─────────────────────────────────

  const receivePurchase = useCallback(
    async (purchaseId: string) => {
      const { error: err } = await supabase
        .from('purchases')
        .update({ status: 'received' })
        .eq('id', purchaseId);
      if (err) throw err;
      await fetchPurchases();
    },
    [fetchPurchases],
  );

  // ── Cancel purchase ─────────────────────────────────────────────────────

  const cancelPurchase = useCallback(
    async (purchaseId: string) => {
      const { error: err } = await supabase
        .from('purchases')
        .update({ status: 'cancelled' })
        .eq('id', purchaseId);
      if (err) throw err;
      await fetchPurchases();
    },
    [fetchPurchases],
  );

  // ── Delete purchase ─────────────────────────────────────────────────────

  const deletePurchase = useCallback(
    async (purchaseId: string) => {
      const { error: err } = await supabase
        .from('purchases')
        .delete()
        .eq('id', purchaseId);
      if (err) throw err;
      await fetchPurchases();
    },
    [fetchPurchases],
  );

  return {
    purchases,
    loading,
    error,
    refetch: fetchPurchases,
    createPurchase,
    receivePurchase,
    cancelPurchase,
    deletePurchase,
  };
}
