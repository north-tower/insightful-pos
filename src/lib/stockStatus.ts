import type { Product } from '@/hooks/useProducts';

/** Mirrors RetailDashboard stock alerts: low when 0 < stock ≤ threshold; out when stock === 0. */
export type ProductStockChipStatus = 'low' | 'out';

export function getStockStatus(
  product: Pick<Product, 'stock' | 'lowStockThreshold'>,
): ProductStockChipStatus | undefined {
  if (product.stock === 0) return 'out';
  if (product.stock > 0 && product.stock <= product.lowStockThreshold) return 'low';
  return undefined;
}
