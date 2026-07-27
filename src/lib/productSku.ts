/** Valid SKU for display — omit null/empty/literal "SKU" placeholders. */
export function getDisplaySku(sku: string | null | undefined): string | null {
  if (!sku) return null;
  const trimmed = sku.trim();
  if (!trimmed || trimmed.toUpperCase() === 'SKU') return null;
  return trimmed;
}

export function hasValidSku(sku: string | null | undefined): boolean {
  return getDisplaySku(sku) !== null;
}

/**
 * Hide SKU columns when most products have no real SKU (default: >80% empty).
 */
export function shouldHideSkuColumn(
  products: Array<{ sku?: string | null }>,
  emptyRatioThreshold = 0.8,
): boolean {
  if (products.length === 0) return false;
  const emptyCount = products.filter((p) => !hasValidSku(p.sku)).length;
  return emptyCount / products.length > emptyRatioThreshold;
}
