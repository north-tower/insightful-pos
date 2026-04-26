import { dbGetByKey, dbPut, OFFLINE_STORES } from '@/lib/offline/db';

interface CachedSnapshot<T> {
  key: string;
  value: T;
  updated_at: string;
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
