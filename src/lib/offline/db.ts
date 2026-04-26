export const OFFLINE_DB_NAME = 'insightful-pos-offline';
export const OFFLINE_DB_VERSION = 1;

export const OFFLINE_STORES = {
  products: 'products',
  customers: 'customers',
  orders: 'orders',
  orderItems: 'order_items',
  payments: 'payments',
  pendingOperations: 'pending_operations',
  syncState: 'sync_state',
} as const;

export type OfflineStoreName = (typeof OFFLINE_STORES)[keyof typeof OFFLINE_STORES];

export type PendingOperationStatus = 'pending' | 'processing' | 'synced' | 'failed';

export interface PendingOperationRecord {
  id: string;
  entity: string;
  action: string;
  payload: unknown;
  status: PendingOperationStatus;
  retries: number;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
}

function ensureBrowserSupport() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    throw new Error('IndexedDB is not available in this environment');
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function openOfflineDb(): Promise<IDBDatabase> {
  ensureBrowserSupport();

  return await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(OFFLINE_STORES.products)) {
        db.createObjectStore(OFFLINE_STORES.products, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(OFFLINE_STORES.customers)) {
        db.createObjectStore(OFFLINE_STORES.customers, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(OFFLINE_STORES.orders)) {
        db.createObjectStore(OFFLINE_STORES.orders, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(OFFLINE_STORES.orderItems)) {
        const store = db.createObjectStore(OFFLINE_STORES.orderItems, { keyPath: 'id' });
        store.createIndex('order_id', 'order_id', { unique: false });
      }
      if (!db.objectStoreNames.contains(OFFLINE_STORES.payments)) {
        const store = db.createObjectStore(OFFLINE_STORES.payments, { keyPath: 'id' });
        store.createIndex('order_id', 'order_id', { unique: false });
      }
      if (!db.objectStoreNames.contains(OFFLINE_STORES.pendingOperations)) {
        const store = db.createObjectStore(OFFLINE_STORES.pendingOperations, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('created_at', 'created_at', { unique: false });
      }
      if (!db.objectStoreNames.contains(OFFLINE_STORES.syncState)) {
        db.createObjectStore(OFFLINE_STORES.syncState, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function dbPut<T>(storeName: OfflineStoreName, value: T): Promise<void> {
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function dbGetAll<T>(storeName: OfflineStoreName): Promise<T[]> {
  const db = await openOfflineDb();
  const tx = db.transaction(storeName, 'readonly');
  const req = tx.objectStore(storeName).getAll();
  return await requestToPromise(req);
}

export async function dbGetByKey<T>(storeName: OfflineStoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await openOfflineDb();
  const tx = db.transaction(storeName, 'readonly');
  const req = tx.objectStore(storeName).get(key);
  const result = await requestToPromise(req);
  return result as T | undefined;
}

export async function dbDelete(storeName: OfflineStoreName, key: IDBValidKey): Promise<void> {
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function dbCount(storeName: OfflineStoreName): Promise<number> {
  const db = await openOfflineDb();
  const tx = db.transaction(storeName, 'readonly');
  const req = tx.objectStore(storeName).count();
  return await requestToPromise(req);
}
