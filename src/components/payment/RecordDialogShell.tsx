import type { ReactNode } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const ICON_BTN_48 =
  'focus-ring inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius)] border border-hairline bg-surface text-ink active:scale-[0.98]';

export function RecordDialogShell({
  open,
  onOpenChange,
  isDesktopMd,
  title,
  subtitle,
  children,
  footer,
  blockClose = false,
  titleId,
  descriptionId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDesktopMd: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  blockClose?: boolean;
  titleId?: string;
  descriptionId?: string;
}) {
  const handleOpenChange = (next: boolean) => {
    if (blockClose && !next) return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        hideClose
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={cn(
          'flex flex-col gap-0 overflow-hidden p-0 shadow-lg',
          isDesktopMd
            ? 'max-h-[90vh] w-[520px] max-w-[520px]'
            : 'fixed inset-0 h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 left-0 top-0 rounded-none border-0',
        )}
      >
        <header className="shrink-0 border-b border-hairline bg-background px-5 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex items-start gap-2">
            {!isDesktopMd ? (
              <button
                type="button"
                className={ICON_BTN_48}
                aria-label="Back"
                onClick={() => handleOpenChange(false)}
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-xl font-semibold text-ink">
                {title}
              </h2>
              {subtitle ? (
                <p id={descriptionId} className="mt-0.5 text-sm text-ink-2">
                  {subtitle}
                </p>
              ) : null}
            </div>
            {isDesktopMd ? (
              <button
                type="button"
                className={ICON_BTN_48}
                aria-label="Close"
                onClick={() => handleOpenChange(false)}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            ) : null}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-gutter:stable] px-5 py-4">
          {children}
        </div>

        <footer className="shrink-0 border-t border-hairline bg-background px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {footer}
        </footer>
      </DialogContent>
    </Dialog>
  );
}

export const RECORD_OUTLINED_BTN =
  'focus-ring inline-flex h-12 min-h-12 flex-1 items-center justify-center rounded-[var(--radius)] border border-hairline bg-surface px-4 text-sm font-semibold text-ink active:scale-[0.98]';

export const RECORD_PRIMARY_BTN =
  'focus-ring inline-flex h-14 min-h-14 flex-1 items-center justify-center gap-2 rounded-[var(--radius)] bg-primary px-4 text-base font-semibold text-primary-foreground active:scale-[0.98] disabled:pointer-events-none disabled:border disabled:border-hairline disabled:bg-surface disabled:text-ink-2';
