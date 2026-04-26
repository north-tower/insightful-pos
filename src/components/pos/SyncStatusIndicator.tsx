import { CloudOff, RefreshCcw, AlertTriangle, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSyncStatus } from '@/hooks/useSyncStatus';

export function SyncStatusIndicator() {
  const {
    isOnline,
    pendingCount,
    failedCount,
    isRefreshing,
    requestSync,
    refreshPendingCount,
  } = useSyncStatus();

  const hasQueue = pendingCount > 0;
  const hasFailures = failedCount > 0;

  return (
    <div className="flex items-center gap-2">
      {!isOnline && (
        <Badge variant="destructive" className="hidden sm:flex items-center gap-1">
          <CloudOff className="w-3 h-3" />
          Offline
        </Badge>
      )}

      {isOnline && hasQueue && (
        <Badge
          variant="outline"
          className="hidden md:flex items-center gap-1 text-warning border-warning/30"
        >
          <Clock3 className="w-3 h-3" />
          {pendingCount} pending
        </Badge>
      )}

      {isOnline && hasFailures && (
        <Badge variant="destructive" className="hidden sm:flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {failedCount} failed
        </Badge>
      )}

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 px-2.5 text-xs"
        onClick={() => {
          requestSync();
          void refreshPendingCount();
        }}
        disabled={!isOnline || isRefreshing}
      >
        <RefreshCcw className={`w-3.5 h-3.5 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
        Sync
      </Button>
    </div>
  );
}
