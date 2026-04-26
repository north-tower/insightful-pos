import { useCallback, useEffect, useState } from 'react';
import { getFailedOperationsCount, getPendingOperationsCount } from '@/lib/offline/outbox';

interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncAt: string | null;
  isRefreshing: boolean;
  refreshPendingCount: () => Promise<void>;
  markSyncCompleted: () => void;
  requestSync: () => void;
}

export function useSyncStatus(): SyncStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshPendingCount = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [pending, failed] = await Promise.all([
        getPendingOperationsCount(),
        getFailedOperationsCount(),
      ]);
      setPendingCount(pending);
      setFailedCount(failed);
    } catch (err) {
      console.error('Failed to refresh pending operation count:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const markSyncCompleted = useCallback(() => {
    setLastSyncAt(new Date().toISOString());
  }, []);

  const requestSync = useCallback(() => {
    window.dispatchEvent(new CustomEvent('offline-sync-request'));
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    void refreshPendingCount();

    const intervalId = window.setInterval(() => {
      void refreshPendingCount();
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [refreshPendingCount]);

  return {
    isOnline,
    pendingCount,
    failedCount,
    lastSyncAt,
    isRefreshing,
    refreshPendingCount,
    markSyncCompleted,
    requestSync,
  };
}
