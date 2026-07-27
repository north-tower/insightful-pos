export interface PurchaseDraftItem {
  product_id: string;
  product_name: string;
  product_sku: string | null;
  quantity: number;
  unit_cost: number;
}

export interface PurchaseDraft {
  items: PurchaseDraftItem[];
  updatedAt: string;
}

const STORAGE_KEY = 'insightful-pos:purchase-draft';

function readDraft(): PurchaseDraft {
  if (typeof window === 'undefined') {
    return { items: [], updatedAt: new Date().toISOString() };
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: [], updatedAt: new Date().toISOString() };
    const parsed = JSON.parse(raw) as PurchaseDraft;
    if (!parsed?.items || !Array.isArray(parsed.items)) {
      return { items: [], updatedAt: new Date().toISOString() };
    }
    return parsed;
  } catch {
    return { items: [], updatedAt: new Date().toISOString() };
  }
}

function writeDraft(draft: PurchaseDraft) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function getPurchaseDraftCount(): number {
  return readDraft().items.length;
}

export function addToPurchaseDraft(item: PurchaseDraftItem): void {
  const draft = readDraft();
  const existing = draft.items.find((i) => i.product_id === item.product_id);
  if (existing) {
    existing.quantity += item.quantity;
    existing.unit_cost = item.unit_cost;
    existing.product_name = item.product_name;
    existing.product_sku = item.product_sku;
  } else {
    draft.items.push(item);
  }
  draft.updatedAt = new Date().toISOString();
  writeDraft(draft);
}

export function consumePurchaseDraft(): PurchaseDraftItem[] {
  const draft = readDraft();
  if (draft.items.length === 0) return [];
  writeDraft({ items: [], updatedAt: new Date().toISOString() });
  return draft.items;
}

export function suggestReorderQty(stock: number, lowStockThreshold: number): number {
  const target = Math.max(lowStockThreshold, 1);
  return Math.max(target - stock, 1);
}
