import {
  dbCount,
  dbDelete,
  dbGetAll,
  dbPut,
  OFFLINE_STORES,
  PendingOperationRecord,
  PendingOperationStatus,
} from '@/lib/offline/db';

function nowIso() {
  return new Date().toISOString();
}

export interface EnqueueOperationInput {
  id?: string;
  entity: string;
  action: string;
  payload: unknown;
}

export async function enqueueOperation(input: EnqueueOperationInput): Promise<PendingOperationRecord> {
  const record: PendingOperationRecord = {
    id: input.id ?? crypto.randomUUID(),
    entity: input.entity,
    action: input.action,
    payload: input.payload,
    status: 'pending',
    retries: 0,
    last_error: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  await dbPut(OFFLINE_STORES.pendingOperations, record);
  return record;
}

export async function getPendingOperations(): Promise<PendingOperationRecord[]> {
  const rows = await dbGetAll<PendingOperationRecord>(OFFLINE_STORES.pendingOperations);
  return rows
    .filter((row) => row.status === 'pending' || row.status === 'failed')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export async function getAllOperations(): Promise<PendingOperationRecord[]> {
  const rows = await dbGetAll<PendingOperationRecord>(OFFLINE_STORES.pendingOperations);
  return rows.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export async function getFailedOperations(): Promise<PendingOperationRecord[]> {
  const rows = await dbGetAll<PendingOperationRecord>(OFFLINE_STORES.pendingOperations);
  return rows
    .filter((row) => row.status === 'failed')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export async function updateOperationStatus(
  id: string,
  status: PendingOperationStatus,
  options?: { lastError?: string | null; retries?: number },
): Promise<void> {
  const rows = await dbGetAll<PendingOperationRecord>(OFFLINE_STORES.pendingOperations);
  const existing = rows.find((row) => row.id === id);
  if (!existing) return;

  await dbPut(OFFLINE_STORES.pendingOperations, {
    ...existing,
    status,
    retries: options?.retries ?? existing.retries,
    last_error: options?.lastError ?? existing.last_error ?? null,
    updated_at: nowIso(),
  } satisfies PendingOperationRecord);
}

export async function markOperationSynced(id: string): Promise<void> {
  await updateOperationStatus(id, 'synced', { lastError: null });
}

export async function markOperationFailed(id: string, errorMessage: string): Promise<void> {
  const rows = await dbGetAll<PendingOperationRecord>(OFFLINE_STORES.pendingOperations);
  const existing = rows.find((row) => row.id === id);
  const nextRetries = (existing?.retries ?? 0) + 1;
  await updateOperationStatus(id, 'failed', {
    lastError: errorMessage,
    retries: nextRetries,
  });
}

export async function deleteOperation(id: string): Promise<void> {
  await dbDelete(OFFLINE_STORES.pendingOperations, id);
}

export async function retryOperation(id: string): Promise<void> {
  await updateOperationStatus(id, 'pending', { lastError: null });
}

export async function getPendingOperationsCount(): Promise<number> {
  const rows = await dbGetAll<PendingOperationRecord>(OFFLINE_STORES.pendingOperations);
  return rows.filter((row) => row.status === 'pending' || row.status === 'failed').length;
}

export async function getFailedOperationsCount(): Promise<number> {
  const rows = await dbGetAll<PendingOperationRecord>(OFFLINE_STORES.pendingOperations);
  return rows.filter((row) => row.status === 'failed').length;
}

export async function getTotalOperationsCount(): Promise<number> {
  return dbCount(OFFLINE_STORES.pendingOperations);
}
