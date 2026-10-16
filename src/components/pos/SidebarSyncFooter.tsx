import { useSyncStatus } from '@/hooks/useSyncStatus';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

function formatLastSynced(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
}

function buildStatusLine(isOnline: boolean, pendingCount: number): string | null {
  if (isOnline && pendingCount === 0) return null;
  if (!isOnline) {
    return pendingCount > 0 ? `Offline · ${pendingCount} queued` : 'Offline';
  }
  return `${pendingCount} queued`;
}

interface SidebarSyncFooterProps {
  compact?: boolean;
}

export function SidebarSyncFooter({ compact }: SidebarSyncFooterProps) {
  const { isOnline, pendingCount, lastSyncAt } = useSyncStatus();
  const statusLine = buildStatusLine(isOnline, pendingCount);
  const lastSynced = formatLastSynced(lastSyncAt);
  const fullDescription = [statusLine, lastSynced ? `Last sync ${lastSynced}` : null]
    .filter(Boolean)
    .join(' · ');

  if (!statusLine) {
    return null;
  }

  const content = (
    <div
      className={cn(
        'text-xs text-ink-2',
        compact ? 'px-1 py-2 text-center leading-tight' : 'px-3 py-2',
      )}
      role="status"
      aria-live="polite"
    >
      <p className={cn('font-medium', !isOnline && 'text-wait')}>{statusLine}</p>
      {lastSynced ? (
        <p className="mt-0.5 truncate text-[11px]">Last sync {lastSynced}</p>
      ) : (
        /* TODO: surface last sync time globally when sync completion is tracked app-wide */
        null
      )}
    </div>
  );

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="focus-ring mx-auto flex h-10 w-10 items-center justify-center rounded-[var(--radius)]"
            aria-label={fullDescription}
          >
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                isOnline ? 'bg-ok' : 'bg-wait',
              )}
              aria-hidden
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="shadow-float">
          {fullDescription}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="shrink-0 border-t border-hairline" aria-label={fullDescription}>
      {content}
    </div>
  );
}
