import { Loader2, Wifi, WifiOff } from 'lucide-react';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { SyncQueueSheet } from '@/components/pos/SyncQueueSheet';
import { cn } from '@/lib/utils';

function formatLastSynced(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
}

/**
 * Unified connection / sync control for the app shell header.
 */
export function SyncStatusIndicator() {
  const {
    isOnline,
    pendingCount,
    isRefreshing,
    refreshPendingCount,
    lastSyncAt,
  } = useSyncStatus();

  const lastSynced = formatLastSynced(lastSyncAt);
  const statusWord = !isOnline ? 'Offline' : isRefreshing ? 'Syncing' : 'Online';

  const ariaParts = [
    statusWord,
    lastSynced ? `Last synced ${lastSynced}` : null,
    pendingCount > 0 ? `${pendingCount} pending sales` : null,
    'Press to sync',
  ].filter(Boolean);

  const StatusIcon = !isOnline ? WifiOff : isRefreshing ? Loader2 : Wifi;
  const iconClass = !isOnline ? 'text-wait' : isRefreshing ? 'text-ink-2' : 'text-ok';

  return (
    <SyncQueueSheet
      trigger={
        <button
          type="button"
          onClick={() => {
            void refreshPendingCount();
          }}
          disabled={isRefreshing}
          aria-label={ariaParts.join('. ')}
          className={cn(
            'focus-ring inline-flex h-10 min-h-[var(--tap-min)] max-w-[9.5rem] shrink-0 items-center gap-1.5 rounded-[var(--radius)] border border-hairline bg-surface px-2.5 text-[13px] font-medium text-ink sm:max-w-none sm:px-3',
            'motion-reduce:transition-none',
          )}
        >
          <StatusIcon
            className={cn(
              'h-4 w-4 shrink-0',
              iconClass,
              isRefreshing && 'motion-reduce:animate-none animate-spin',
            )}
            aria-hidden
          />
          <span className="max-[359px]:sr-only truncate sm:max-w-none">{statusWord}</span>
          {pendingCount > 0 && (
            <span className="num hidden shrink-0 text-xs text-ink-2 sm:inline" aria-hidden>
              ({pendingCount})
            </span>
          )}
        </button>
      }
    />
  );
}
