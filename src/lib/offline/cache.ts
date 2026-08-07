import { dbGetByKey, dbPut, OFFLINE_STORES } from '@/lib/offline/db';

interface CachedSnapshot<T> {
  key: string;
  value: T;
  updated_at: string;
}

export interface CachedSnapshotMeta {
  updatedAt: string | null;
}

/** Canonical products offline cache key (branch-scoped). */
export function productsSnapshotKey(
  mode: string,
  userId?: string | null,
  branchId?: string | null,
): string {
  return `snapshot:products:${mode}:${userId || 'anon'}:branch:${branchId || 'none'}`;
}

/** Older keys written before branch isolation — used as read fallbacks. */
export function legacyProductsSnapshotKeys(
  mode: string,
  userId?: string | null,
  role?: string | null,
): string[] {
  return [
    `snapshot:products:${mode}:${userId || 'anon'}`,
    `snapshot:products:${mode}:${userId || 'anon'}:${role || 'unknown'}`,
  ];
}

/**
 * Load the branch products snapshot, falling back to pre-branch keys.
 * When a legacy snapshot is found, migrates it to the canonical key.
 */
export async function getProductsSnapshot<T>(
  mode: string,
  userId?: string | null,
  branchId?: string | null,
  role?: string | null,
): Promise<{ key: string; snapshot: T } | null> {
  const key = productsSnapshotKey(mode, userId, branchId);
  const primary = await getCachedSnapshot<T>(key);
  if (primary) return { key, snapshot: primary };

  for (const legacyKey of legacyProductsSnapshotKeys(mode, userId, role)) {
    if (legacyKey === key) continue;
    const legacy = await getCachedSnapshot<T>(legacyKey);
    if (legacy) {
      await setCachedSnapshot<T>(key, legacy);
      return { key, snapshot: legacy };
    }
  }
  return null;
}

export async function getCachedSnapshot<T>(key: string): Promise<T | null> {
  try {
    const row = await dbGetByKey<CachedSnapshot<T>>(OFFLINE_STORES.syncState, key);
    return row?.value ?? null;
  } catch (err) {
    console.error(`Failed to read offline snapshot for ${key}:`, err);
    return null;
  }
}

export async function setCachedSnapshot<T>(key: string, value: T): Promise<void> {
  try {
    await dbPut(OFFLINE_STORES.syncState, {
      key,
      value,
      updated_at: new Date().toISOString(),
    } satisfies CachedSnapshot<T>);
  } catch (err) {
    console.error(`Failed to persist offline snapshot for ${key}:`, err);
  }
}

export async function getCachedSnapshotMeta(key: string): Promise<CachedSnapshotMeta> {
  try {
    const row = await dbGetByKey<CachedSnapshot<unknown>>(OFFLINE_STORES.syncState, key);
    return {
      updatedAt: row?.updated_at ?? null,
    };
  } catch (err) {
    console.error(`Failed to read offline snapshot metadata for ${key}:`, err);
    return {
      updatedAt: null,
    };
  }
}
