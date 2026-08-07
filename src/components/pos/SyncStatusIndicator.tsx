import { CloudOff, RefreshCcw, AlertTriangle, Clock3, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { SyncQueueSheet } from '@/components/pos/SyncQueueSheet';
import { cn } from '@/lib/utils';

/**
 * Header sync / connectivity chrome.
 * Online state comes from useSyncStatus → navigator.onLine (+ outbox counts).
 * REVIEW: Confirm copy and visibility match cashier expectations on POS mobile.
 */
export function SyncStatusIndicator() {
  const {
    isOnline,
    pendingCount,
    failedCount,
    isRefreshing,
    refreshPendingCount,
  } = useSyncStatus();

  const hasQueue = pendingCount > 0;
  const hasFailures = failedCount > 0;

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {!isOnline && (
        <Badge
          variant="destructive"
          className="flex h-9 w-9 shrink-0 items-center justify-center p-0 sm:h-auto sm:w-auto sm:max-w-none sm:gap-1 sm:px-2.5"
          title="Offline — sale will sync when reconnected"
        >
          <CloudOff className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden truncate text-xs sm:inline">
            Offline — sale will sync when reconnected
          </span>
        </Badge>
      )}

      {isOnline && (
        <Badge
          variant="outline"
          className="flex h-9 w-9 shrink-0 items-center justify-center border-success/30 p-0 text-success sm:h-auto sm:w-auto sm:gap-1 sm:px-2.5"
          title="Online"
        >
          <Wifi className="h-3.5 w-3.5" />
          <span className="hidden text-xs sm:inline">Online</span>
        </Badge>
      )}

      {isOnline && hasQueue && (
        <Badge
          variant="outline"
          className="hidden items-center gap-1 border-warning/30 text-warning md:flex"
        >
          <Clock3 className="h-3 w-3" />
          {pendingCount} pending
        </Badge>
      )}

      {isOnline && hasFailures && (
        <Badge variant="destructive" className="hidden items-center gap-1 sm:flex">
          <AlertTriangle className="h-3 w-3" />
          {failedCount} failed
        </Badge>
      )}

      <SyncQueueSheet
        trigger={
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 w-9 shrink-0 px-0 text-xs active:scale-95 sm:w-auto sm:min-w-9 sm:px-2.5"
            onClick={() => {
              void refreshPendingCount();
            }}
            disabled={isRefreshing}
            aria-label="Sync"
            title="Sync"
          >
            <RefreshCcw className={cn('h-3.5 w-3.5 sm:mr-1', isRefreshing && 'animate-spin')} />
            <span className="hidden sm:inline">Sync</span>
          </Button>
        }
      />
    </div>
  );
}
