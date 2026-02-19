import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useBusinessMode } from '@/context/BusinessModeContext';

// ── Re-export types consumers already rely on ────────────────────────────────
import type { MenuItem, Category } from '@/data/menuData';
import type { Product, ProductCategory, ProductVariant } from '@/data/productData';
export type { MenuItem, Category, Product, ProductCategory, ProductVariant };

// ── Mock data (used in demo mode) ────────────────────────────────────────────
import {
  categories as mockCategories,
  menuItems as mockMenuItems,
} from '@/data/menuData';
import {
  retailProducts as mockRetailProducts,
  retailCategories as mockRetailCategories,
} from '@/data/productData';

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
  const isDemoMode = !isSupabaseConfigured();

  const [loading, setLoading] = useState(!isDemoMode);
  const [error, setError] = useState<string | null>(null);

  // Raw Supabase rows
  const [supaCategories, setSupaCategories] = useState<SupabaseCategory[]>([]);
  const [supaProducts, setSupaProducts] = useState<SupabaseProduct[]>([]);
  const [supaVariants, setSupaVariants] = useState<SupabaseVariant[]>([]);

  // ── Fetch ──────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (isDemoMode) return;

    setLoading(true);
    setError(null);

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
      if (mode === 'retail' && prodData && prodData.length > 0) {
        const productIds = prodData.map((p: SupabaseProduct) => p.id);
        const { data: vData, error: vErr } = await supabase
          .from('product_variants')
          .select('*')
          .in('product_id', productIds)
          .eq('is_active', true);

        if (vErr) throw vErr;
        variantData = vData || [];
      }

      setSupaCategories(catData || []);
      setSupaProducts(prodData || []);
      setSupaVariants(variantData);
    } catch (err: any) {
      console.error('Failed to fetch products:', err);
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [mode, isDemoMode]);

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
    if (isDemoMode) return mockMenuItems;
    return supaProducts.map((p) =>
      toMenuItem(p, categoryMap.get(p.category_id || '') || 'uncategorized'),
    );
  }, [isDemoMode, supaProducts, categoryMap]);

  const categories: Category[] = useMemo(() => {
    if (isDemoMode) return mockCategories;

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
  }, [isDemoMode, supaCategories, supaProducts, categoryMap]);

  // ── Retail data ────────────────────────────────────────────────────────

  const retailProducts: Product[] = useMemo(() => {
    if (isDemoMode) return mockRetailProducts;

    // Group variants
    const variantsByProduct = new Map<string, SupabaseVariant[]>();
    supaVariants.forEach((v) => {
      const list = variantsByProduct.get(v.product_id) || [];
      list.push(v);
      variantsByProduct.set(v.product_id, list);
    });

    return supaProducts.map((p) =>
      toProduct(
        p,
        categoryMap.get(p.category_id || '') || 'uncategorized',
        variantsByProduct.get(p.id),
      ),
    );
  }, [isDemoMode, supaProducts, supaVariants, categoryMap]);

  const retailCategories: ProductCategory[] = useMemo(() => {
    if (isDemoMode) return mockRetailCategories;

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
  }, [isDemoMode, supaCategories, supaProducts, categoryMap]);

  // ── CRUD ───────────────────────────────────────────────────────────────

  const addProduct = useCallback(
    async (product: Record<string, unknown>) => {
      if (isDemoMode) return;
      const { error: err } = await supabase
        .from('products')
        .insert({ ...product, business_mode: mode });
      if (err) throw err;
      await fetchData();
    },
    [isDemoMode, mode, fetchData],
  );

  const updateProduct = useCallback(
    async (id: string, updates: Record<string, unknown>) => {
      if (isDemoMode) return;
      const { error: err } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id);
      if (err) throw err;
      await fetchData();
    },
    [isDemoMode, fetchData],
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      if (isDemoMode) return;
      const { error: err } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      if (err) throw err;
      await fetchData();
    },
    [isDemoMode, fetchData],
  );

  // ── Return ─────────────────────────────────────────────────────────────

  return {
    loading,
    error,
    refetch: fetchData,
    isDemoMode,

    // Restaurant
    menuItems,
    categories,

    // Retail
    retailProducts,
    retailCategories,

    // Write ops
    addProduct,
    updateProduct,
    deleteProduct,
  };
}
