import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useBusinessMode } from '@/context/BusinessModeContext';
import { getCachedSnapshot, setCachedSnapshot } from '@/lib/offline/cache';
import {
  enqueueOperation,
  getPendingOperations,
  markOperationFailed,
  markOperationSynced,
  updateOperationStatus,
} from '@/lib/offline/outbox';

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

interface QueuedStockAdjustmentPayload {
  productId: string;
  type: StockAdjustmentRow['type'];
  quantity: number;
  note?: string;
}

interface ProductsOfflineSnapshot {
  categories: unknown[];
  products: Array<{
    id: string;
    name?: string;
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

export function useStockAdjustments(limit = 20) {
  const { user } = useAuth();
  const { mode } = useBusinessMode();
  const [adjustments, setAdjustments] = useState<StockAdjustmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isSyncingRef = useRef(false);

  const adjustmentsCacheKey = useMemo(() => `snapshot:stock-adjustments:${limit}`, [limit]);
  const productsCacheKey = useMemo(
    () => `snapshot:products:${mode}:${user?.id || 'anon'}:${user?.role || 'unknown'}`,
    [mode, user?.id, user?.role],
  );

  const loadAdjustmentsCache = useCallback(async (): Promise<StockAdjustmentRow[]> => {
    const cached = await getCachedSnapshot<StockAdjustmentRow[]>(adjustmentsCacheKey);
    if (!cached) return [];
    setAdjustments(cached);
    return cached;
  }, [adjustmentsCacheKey]);

  const persistAdjustmentsCache = useCallback(
    async (rows: StockAdjustmentRow[]) => {
      await setCachedSnapshot<StockAdjustmentRow[]>(adjustmentsCacheKey, rows);
    },
    [adjustmentsCacheKey],
  );

  const adjustStockRemote = useCallback(
    async (
      productId: string,
      type: StockAdjustmentRow['type'],
      quantity: number,
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
      return { previousStock, newStock };
    },
    [user?.id],
  );

  const fetchAdjustments = useCallback(async () => {
    setLoading(true);
    setError(null);
    const cached = await loadAdjustmentsCache();
    if (cached.length > 0) setLoading(false);
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (cached.length === 0) setError('Offline and no cached stock adjustments available');
      return;
    }
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
      await persistAdjustmentsCache(rows);
    } catch (err: any) {
      console.error('Failed to fetch stock adjustments:', err);
      if (cached.length === 0) {
        setError(err.message || 'Failed to load adjustments');
      }
    } finally {
      setLoading(false);
    }
  }, [limit, loadAdjustmentsCache, persistAdjustmentsCache]);

  const syncQueuedStockAdjustments = useCallback(async (operationId?: string) => {
    if (isSyncingRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    isSyncingRef.current = true;
    try {
      const pending = await getPendingOperations();
      const stockOps = pending.filter(
        (op) => op.entity === 'stock_adjustments' && op.action === 'adjust_stock',
      );
      const selectedOps = operationId ? stockOps.filter((op) => op.id === operationId) : stockOps;

      for (const op of selectedOps) {
        try {
          await updateOperationStatus(op.id, 'processing');
          const payload = op.payload as QueuedStockAdjustmentPayload;
          if (!payload?.productId) {
            throw new Error('Invalid queued stock adjustment payload');
          }
          await adjustStockRemote(payload.productId, payload.type, payload.quantity, payload.note);
          await markOperationSynced(op.id);
        } catch (err: any) {
          await markOperationFailed(op.id, err?.message || 'Failed to sync stock adjustment');
        }
      }

      await fetchAdjustments();
    } finally {
      isSyncingRef.current = false;
    }
  }, [adjustStockRemote, fetchAdjustments]);

  useEffect(() => {
    fetchAdjustments();
  }, [fetchAdjustments]);

  useEffect(() => {
    const onOnline = () => {
      void syncQueuedStockAdjustments();
      void fetchAdjustments();
    };
    const onSyncRequest = (event: Event) => {
      const customEvent = event as CustomEvent<{ operationId?: string }>;
      void syncQueuedStockAdjustments(customEvent.detail?.operationId);
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline-sync-request', onSyncRequest);
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      void syncQueuedStockAdjustments();
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline-sync-request', onSyncRequest);
    };
  }, [fetchAdjustments, syncQueuedStockAdjustments]);

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
      const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

      if (isOnline) {
        const result = await adjustStockRemote(productId, type, quantity, note);
        await fetchAdjustments();
        return result;
      }

      const snapshot = await getCachedSnapshot<ProductsOfflineSnapshot>(productsCacheKey);
      if (!snapshot) {
        throw new Error('Offline cache unavailable for inventory adjustment');
      }

      const product = snapshot.products.find((p) => p.id === productId);
      if (!product) {
        throw new Error('Product not found in offline cache');
      }

      const previousStock = Number(product.stock || 0);
      const newStock = Math.max(0, previousStock + quantity);
      const nextProducts = snapshot.products.map((p) =>
        p.id === productId ? { ...p, stock: newStock } : p,
      );

      await setCachedSnapshot<ProductsOfflineSnapshot>(productsCacheKey, {
        ...snapshot,
        products: nextProducts,
      });

      window.dispatchEvent(
        new CustomEvent('offline-products-updated', {
          detail: { cacheKey: productsCacheKey },
        }),
      );

      const localAdjustment: StockAdjustmentRow = {
        id: `local-adjust-${crypto.randomUUID()}`,
        product_id: productId,
        variant_id: null,
        type,
        quantity,
        previous_stock: previousStock,
        new_stock: newStock,
        note: note || null,
        staff_id: user?.id || null,
        created_at: new Date().toISOString(),
        product_name: product.name || 'Unknown Product',
        staff_name: user?.full_name || 'Offline User',
      };

      const nextAdjustments = [localAdjustment, ...adjustments].slice(0, limit);
      setAdjustments(nextAdjustments);
      await persistAdjustmentsCache(nextAdjustments);

      await enqueueOperation({
        entity: 'stock_adjustments',
        action: 'adjust_stock',
        payload: {
          productId,
          type,
          quantity,
          note,
        } satisfies QueuedStockAdjustmentPayload,
      });

      return { previousStock, newStock };
    },
    [
      user?.id,
      user?.full_name,
      fetchAdjustments,
      adjustStockRemote,
      productsCacheKey,
      adjustments,
      limit,
      persistAdjustmentsCache,
    ],
  );

  return {
    adjustments,
    loading,
    error,
    refetch: fetchAdjustments,
    adjustStock,
  };
}
