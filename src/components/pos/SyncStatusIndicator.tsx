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
    <div className="flex items-center gap-2">
      {!isOnline && (
        <Badge
          variant="destructive"
          className="flex max-w-[11rem] items-center gap-1 truncate sm:max-w-none"
          title="Offline — sale will sync when reconnected"
        >
          <CloudOff className="h-3 w-3 shrink-0" />
          <span className="truncate text-[10px] sm:text-xs">
            {/* Shorter on very small screens; full message on sm+ */}
            <span className="sm:hidden">Offline</span>
            <span className="hidden sm:inline">Offline — sale will sync when reconnected</span>
          </span>
        </Badge>
      )}

      {isOnline && (
        <Badge
          variant="outline"
          className="flex items-center gap-1 border-success/30 text-success"
          title="Online"
        >
          <Wifi className="h-3 w-3" />
          <span className="hidden text-[10px] sm:inline sm:text-xs">Online</span>
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
            className="h-9 min-h-9 min-w-9 px-2.5 text-xs active:scale-95"
            onClick={() => {
              void refreshPendingCount();
            }}
            disabled={isRefreshing}
          >
            <RefreshCcw className={cn('mr-1 h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
            Sync
          </Button>
        }
      />
    </div>
  );
}
