import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock3, RefreshCcw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  deleteOperation,
  getAllOperations,
  retryOperation,
} from '@/lib/offline/outbox';
import type { PendingOperationRecord } from '@/lib/offline/db';

function summarizePayload(record: PendingOperationRecord): string {
  const payload = record.payload as { params?: { customer_name?: string; total?: number } };
  const customer = payload?.params?.customer_name || 'Unknown customer';
  const total = payload?.params?.total;
  if (typeof total === 'number') {
    return `${customer} - ${total.toLocaleString()}`;
  }
  return customer;
}

function statusClass(status: PendingOperationRecord['status']) {
  if (status === 'failed') return 'bg-destructive/10 text-destructive border-destructive/30';
  if (status === 'processing') return 'bg-info/10 text-info border-info/30';
  if (status === 'synced') return 'bg-success/10 text-success border-success/30';
  return 'bg-warning/10 text-warning border-warning/30';
}

export function SyncQueueSheet({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [operations, setOperations] = useState<PendingOperationRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getAllOperations();
      setOperations(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const id = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(id);
  }, [open, refresh]);

  const pendingOrFailed = useMemo(
    () => operations.filter((op) => op.status === 'pending' || op.status === 'failed'),
    [operations],
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Sync Queue</SheetTitle>
          <SheetDescription>
            Review failed and pending offline operations, then retry or remove them.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {pendingOrFailed.length} pending/failed operation
              {pendingOrFailed.length === 1 ? '' : 's'}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('offline-sync-request'));
                void refresh();
              }}
            >
              <RefreshCcw className="w-3.5 h-3.5 mr-1" />
              Retry all
            </Button>
          </div>

          {loading && (
            <p className="text-xs text-muted-foreground">Loading sync queue...</p>
          )}

          {!loading && pendingOrFailed.length === 0 && (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              Queue is clear. No pending or failed operations.
            </div>
          )}

          {!loading &&
            pendingOrFailed.map((op) => (
              <div key={op.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {op.entity} / {op.action}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {summarizePayload(op)}
                    </p>
                  </div>
                  <Badge variant="outline" className={statusClass(op.status)}>
                    {op.status}
                  </Badge>
                </div>

                {op.last_error && (
                  <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{op.last_error}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock3 className="w-3.5 h-3.5" />
                    Retries: {op.retries}
                  </span>
                  <span>{new Date(op.created_at).toLocaleString()}</span>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-8 text-xs"
                    onClick={async () => {
                      await retryOperation(op.id);
                      window.dispatchEvent(
                        new CustomEvent('offline-sync-request', {
                          detail: { operationId: op.id },
                        }),
                      );
                      await refresh();
                    }}
                  >
                    <RefreshCcw className="w-3.5 h-3.5 mr-1" />
                    Retry
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={async () => {
                      await deleteOperation(op.id);
                      await refresh();
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
