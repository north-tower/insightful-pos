import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useBusinessMode } from '@/context/BusinessModeContext';
import { useAuth } from '@/context/AuthContext';
import { getCachedSnapshot, setCachedSnapshot } from '@/lib/offline/cache';

// ── Re-export types consumers already rely on ────────────────────────────────
import type { MenuItem, Category } from '@/data/menuData';
import type { Product, ProductCategory, ProductVariant } from '@/data/productData';
export type { MenuItem, Category, Product, ProductCategory, ProductVariant };

// ─── Supabase row types ──────────────────────────────────────────────────────

interface SupabaseCategory {
  id: string;
  name: string;
  icon: string | null;
  business_mode: string;
  sort_order: number;
  is_active: boolean;
}

interface SupabaseProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category_id: string | null;
  image_url: string | null;
  business_mode: string;
  is_active: boolean;
  discount: number | null;
  // Restaurant
  is_veg: boolean | null;
  prep_time_mins: number | null;
  // Retail
  sku: string | null;
  barcode: string | null;
  cost: number | null;
  stock: number | null;
  low_stock_threshold: number | null;
  unit: string | null;
  brand: string | null;
}

interface SupabaseVariant {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  cost: number | null;
  stock: number;
}

interface CashierAllocationRow {
  product_id: string;
  assigned_qty: number;
  sold_qty: number;
}

interface ProductsOfflineSnapshot {
  categories: SupabaseCategory[];
  products: SupabaseProduct[];
  variants: SupabaseVariant[];
  cashierAllocations: CashierAllocationRow[];
}

// ─── Transform helpers ───────────────────────────────────────────────────────

/** Build a URL-safe slug from a category name: "Home & Living" → "home-&-living" */
function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

function toMenuItem(row: SupabaseProduct, categorySlug: string): MenuItem {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    category: categorySlug,
    image: row.image_url || '',
    isVeg: row.is_veg ?? undefined,
    discount: row.discount ? Number(row.discount) : undefined,
  };
}

function toProduct(
  row: SupabaseProduct,
  categorySlug: string,
  variants?: SupabaseVariant[],
): Product {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku || '',
    barcode: row.barcode || undefined,
    price: Number(row.price),
    cost: Number(row.cost || 0),
    category: categorySlug,
    image: row.image_url || '',
    stock: row.stock ?? 0,
    lowStockThreshold: row.low_stock_threshold ?? 10,
    unit: row.unit || 'pcs',
    brand: row.brand || undefined,
    isActive: row.is_active,
    discount: row.discount ? Number(row.discount) : undefined,
    variants: variants?.map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku || '',
      barcode: v.barcode || undefined,
      price: Number(v.price),
      stock: v.stock,
    })),
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useProducts() {
  const { mode } = useBusinessMode();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Raw Supabase rows
  const [supaCategories, setSupaCategories] = useState<SupabaseCategory[]>([]);
  const [supaProducts, setSupaProducts] = useState<SupabaseProduct[]>([]);
  const [supaVariants, setSupaVariants] = useState<SupabaseVariant[]>([]);
  const [cashierAllocations, setCashierAllocations] = useState<CashierAllocationRow[]>([]);

  const offlineCacheKey = useMemo(
    () => `snapshot:products:${mode}:${user?.id || 'anon'}:${user?.role || 'unknown'}`,
    [mode, user?.id, user?.role],
  );

  const loadFromOfflineCache = useCallback(async (): Promise<boolean> => {
    const cached = await getCachedSnapshot<ProductsOfflineSnapshot>(offlineCacheKey);
    if (!cached) return false;
    setSupaCategories(cached.categories || []);
    setSupaProducts(cached.products || []);
    setSupaVariants(cached.variants || []);
    setCashierAllocations(cached.cashierAllocations || []);
    return true;
  }, [offlineCacheKey]);

  // ── Fetch ──────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const hadCache = await loadFromOfflineCache();
    if (hadCache) setLoading(false);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (!hadCache) setError('Offline and no cached products available yet');
      return;
    }

    try {
      // Categories
      const { data: catData, error: catErr } = await supabase
        .from('categories')
        .select('*')
        .eq('business_mode', mode)
        .eq('is_active', true)
        .order('sort_order');

      if (catErr) throw catErr;

      // Products
      const { data: prodData, error: prodErr } = await supabase
        .from('products')
        .select('*')
        .eq('business_mode', mode)
        .eq('is_active', true)
        .order('name');

      if (prodErr) throw prodErr;

      // Variants (retail only)
      let variantData: SupabaseVariant[] = [];
      let allocationData: CashierAllocationRow[] = [];
      if (mode === 'retail' && prodData && prodData.length > 0) {
        const productIds = prodData.map((p: SupabaseProduct) => p.id);
        const { data: vData, error: vErr } = await supabase
          .from('product_variants')
          .select('*')
          .in('product_id', productIds)
          .eq('is_active', true);

        if (vErr) throw vErr;
        variantData = vData || [];

        if (user?.role === 'cashier') {
          const { data: aData, error: aErr } = await supabase
            .from('cashier_stock_allocations')
            .select('product_id, assigned_qty, sold_qty')
            .eq('cashier_id', user.id)
            .eq('is_active', true)
            .in('product_id', productIds);
          if (aErr) throw aErr;
          allocationData = aData || [];
        }
      }

      setSupaCategories(catData || []);
      setSupaProducts(prodData || []);
      setSupaVariants(variantData);
      setCashierAllocations(allocationData);

      await setCachedSnapshot<ProductsOfflineSnapshot>(offlineCacheKey, {
        categories: catData || [],
        products: prodData || [],
        variants: variantData,
        cashierAllocations: allocationData,
      });
    } catch (err: any) {
      console.error('Failed to fetch products:', err);
      if (!hadCache) {
        setError(err.message || 'Failed to load products');
      }
    } finally {
      setLoading(false);
    }
  }, [mode, user?.id, user?.role, loadFromOfflineCache, offlineCacheKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Category slug lookup (uuid → slug) ─────────────────────────────────

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    supaCategories.forEach((c) => map.set(c.id, slugify(c.name)));
    return map;
  }, [supaCategories]);

  // ── Restaurant data ────────────────────────────────────────────────────

  const menuItems: MenuItem[] = useMemo(() => {
    return supaProducts.map((p) =>
      toMenuItem(p, categoryMap.get(p.category_id || '') || 'uncategorized'),
    );
  }, [supaProducts, categoryMap]);

  const categories: Category[] = useMemo(() => {
    // Count products per slug
    const counts = new Map<string, number>();
    supaProducts.forEach((p) => {
      const slug = categoryMap.get(p.category_id || '') || 'uncategorized';
      counts.set(slug, (counts.get(slug) || 0) + 1);
    });

    return [
      { id: 'all', name: 'All', icon: '🍽️', count: supaProducts.length },
      ...supaCategories.map((c) => {
        const slug = categoryMap.get(c.id) || slugify(c.name);
        return {
          id: slug,
          name: c.name,
          icon: c.icon || '📦',
          count: counts.get(slug) || 0,
        };
      }),
    ];
  }, [supaCategories, supaProducts, categoryMap]);

  // ── Retail data ────────────────────────────────────────────────────────

  const retailProducts: Product[] = useMemo(() => {
    // Group variants
    const variantsByProduct = new Map<string, SupabaseVariant[]>();
    supaVariants.forEach((v) => {
      const list = variantsByProduct.get(v.product_id) || [];
      list.push(v);
      variantsByProduct.set(v.product_id, list);
    });

    const allocationMap = new Map(
      cashierAllocations.map((a) => [a.product_id, Math.max(a.assigned_qty - a.sold_qty, 0)]),
    );

    return supaProducts.map((p) => {
      const product = toProduct(
        p,
        categoryMap.get(p.category_id || '') || 'uncategorized',
        variantsByProduct.get(p.id),
      );

      // Cashiers can only sell quantities assigned to them by manager/admin.
      if (mode === 'retail' && user?.role === 'cashier') {
        const remaining = allocationMap.get(p.id) ?? 0;
        product.stock = Math.min(product.stock, remaining);
      }

      return product;
    });
  }, [supaProducts, supaVariants, categoryMap, cashierAllocations, mode, user?.role]);

  const retailCategories: ProductCategory[] = useMemo(() => {
    const counts = new Map<string, number>();
    supaProducts.forEach((p) => {
      const slug = categoryMap.get(p.category_id || '') || 'uncategorized';
      counts.set(slug, (counts.get(slug) || 0) + 1);
    });

    return [
      { id: 'all', name: 'All Products', icon: '📦', count: supaProducts.length },
      ...supaCategories.map((c) => {
        const slug = categoryMap.get(c.id) || slugify(c.name);
        return {
          id: slug,
          name: c.name,
          icon: c.icon || '📦',
          count: counts.get(slug) || 0,
        };
      }),
    ];
  }, [supaCategories, supaProducts, categoryMap]);

  // ── CRUD ───────────────────────────────────────────────────────────────

  const addProduct = useCallback(
    async (product: Record<string, unknown>) => {
      const { error: err } = await supabase
        .from('products')
        .insert({ ...product, business_mode: mode });
      if (err) throw err;
      await fetchData();
    },
    [mode, fetchData],
  );

  const updateProduct = useCallback(
    async (id: string, updates: Record<string, unknown>) => {
      const { error: err } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id);
      if (err) throw err;
      await fetchData();
    },
    [fetchData],
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      const { error: err } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      if (err) throw err;
      await fetchData();
    },
    [fetchData],
  );

  // ── Reverse slug → category id map (for edit forms) ─────────────────

  const slugToCategoryId = useMemo(() => {
    const map = new Map<string, string>();
    supaCategories.forEach((c) => map.set(slugify(c.name), c.id));
    return map;
  }, [supaCategories]);

  // ── Return ─────────────────────────────────────────────────────────────

  return {
    loading,
    error,
    refetch: fetchData,

    // Restaurant
    menuItems,
    categories,

    // Retail
    retailProducts,
    retailCategories,

    // Raw category data (for edit forms)
    rawCategories: supaCategories,
    slugToCategoryId,

    // Write ops
    addProduct,
    updateProduct,
    deleteProduct,
  };
}
