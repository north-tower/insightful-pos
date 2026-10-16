import { useEffect, useRef, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { formatKES } from '@/lib/formatKES';
import { formatQty, isDecimalUnit, normalizeUnit } from '@/lib/units';
import {
  qtyKeypadInputReducer,
  parseKeypadQuantityString,
  qtyKeypadQuickValues,
  type QtyKeypadInputAction,
} from '@/lib/qtyKeypadInput';
import { getRetailLineTotal } from '@/lib/retailCartQty';
import type { Product } from '@/hooks/useProducts';
import { Delete } from 'lucide-react';

export type QuantityKeypadMode = 'add' | 'edit';

export interface QuantityKeypadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  mode: QuantityKeypadMode;
  unitPrice: number;
  inputValue: string;
  onInputChange: (value: string) => void;
  onConfirm: (quantity: number) => void;
  onRemove?: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

function KeypadBody({
  product,
  mode,
  unitPrice,
  inputValue,
  onInputChange,
  onConfirm,
  onRemove,
  onCancel,
}: Omit<QuantityKeypadProps, 'open' | 'onOpenChange' | 'returnFocusRef'> & {
  onCancel: () => void;
}) {
  const allowDecimal = isDecimalUnit(product.unit);
  const unitLabel = normalizeUnit(product.unit);
  const parsedQty = parseKeypadQuantityString(inputValue, allowDecimal);
  const lineTotal =
    parsedQty !== null ? getRetailLineTotal(unitPrice, parsedQty) : null;

  const primaryDisabled = parsedQty === null;

  const disabledReason = parsedQty === null ? 'Enter a quantity' : null;

  const dispatch = useCallback(
    (action: QtyKeypadInputAction) => {
      onInputChange(qtyKeypadInputReducer(inputValue, action, allowDecimal));
    },
    [allowDecimal, inputValue, onInputChange],
  );

  const handleConfirm = useCallback(() => {
    if (primaryDisabled || parsedQty === null) return;
    onConfirm(parsedQty);
  }, [primaryDisabled, parsedQty, onConfirm]);

  const quickValues = qtyKeypadQuickValues(allowDecimal);

  const primaryLabel =
    mode === 'add'
      ? parsedQty !== null && lineTotal !== null
        ? `Add ${formatQty(parsedQty, product.unit)} · ${formatKES(lineTotal)}`
        : 'Add to cart'
      : parsedQty !== null && lineTotal !== null
        ? `Update quantity · ${formatQty(parsedQty, product.unit)} · ${formatKES(lineTotal)}`
        : 'Update quantity';

  const displayAriaLabel = `Quantity${parsedQty !== null ? ` ${formatQty(parsedQty, product.unit)}` : ''}`;

  return (
    <div className="flex flex-col gap-3" data-testid="qty-keypad">
      <header className="space-y-1 pr-8 text-left">
        <h2 className="line-clamp-2 text-left text-base font-semibold leading-snug text-ink">
          {product.name}
        </h2>
        <p className="font-mono text-sm text-ink num">
          {formatKES(unitPrice)} / {unitLabel}
        </p>
        <p className="text-sm text-ink-2">
          {formatQty(product.stock, product.unit)} in stock
        </p>
      </header>

      <div
        role="textbox"
        aria-readonly="true"
        aria-label={displayAriaLabel}
        data-testid="qty-keypad-display"
        className="flex items-baseline justify-center gap-2 py-1"
      >
        <span className="font-sans text-[2.5rem] font-semibold tabular-nums leading-none text-ink num">
          {inputValue || '0'}
        </span>
        <span className="text-lg text-ink-2">{unitLabel}</span>
      </div>

      <p className="text-center text-sm text-ink-2" aria-live="polite">
        {lineTotal !== null ? `= ${formatKES(lineTotal)}` : '\u00a0'}
      </p>

      <div
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        role="group"
        aria-label="Quick quantities"
      >
        {quickValues.map((v) => (
          <button
            key={v}
            type="button"
            data-testid={`qty-keypad-quick-${v}`}
            onClick={() =>
              onInputChange(
                qtyKeypadInputReducer(
                  '',
                  { type: 'set', value: String(v) },
                  allowDecimal,
                ),
              )
            }
            className="focus-ring shrink-0 rounded-[var(--radius)] border border-hairline bg-paper px-4 text-sm font-semibold tabular-nums text-ink num active:scale-[0.98] min-h-[var(--tap-min)]"
          >
            {v}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Numeric keypad">
        {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((digit) => (
          <button
            key={digit}
            type="button"
            data-testid={`qty-keypad-key-${digit}`}
            onClick={() => dispatch({ type: 'append', char: digit })}
            className="focus-ring flex min-h-[var(--tap-primary)] items-center justify-center rounded-[var(--radius)] border border-hairline bg-surface font-sans text-2xl font-semibold tabular-nums text-ink num active:scale-[0.98]"
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          data-testid="qty-keypad-key-decimal"
          aria-disabled={!allowDecimal || inputValue.includes('.')}
          disabled={!allowDecimal || inputValue.includes('.')}
          onClick={() => dispatch({ type: 'append', char: '.' })}
          className="focus-ring flex min-h-[var(--tap-primary)] items-center justify-center rounded-[var(--radius)] border border-hairline bg-surface font-sans text-2xl font-semibold tabular-nums text-ink num active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          .
        </button>
        <button
          type="button"
          data-testid="qty-keypad-key-0"
          onClick={() => dispatch({ type: 'append', char: '0' })}
          className="focus-ring flex min-h-[var(--tap-primary)] items-center justify-center rounded-[var(--radius)] border border-hairline bg-surface font-sans text-2xl font-semibold tabular-nums text-ink num active:scale-[0.98]"
        >
          0
        </button>
        <button
          type="button"
          data-testid="qty-keypad-key-backspace"
          aria-label="Backspace"
          onClick={() => dispatch({ type: 'backspace' })}
          className="focus-ring flex min-h-[var(--tap-primary)] items-center justify-center rounded-[var(--radius)] border border-hairline bg-surface text-ink active:scale-[0.98]"
        >
          <Delete className="h-6 w-6" aria-hidden />
        </button>
      </div>

      {primaryDisabled && disabledReason && (
        <p className="text-center text-xs text-ink-2">{disabledReason}</p>
      )}

      <button
        type="button"
        data-testid="qty-keypad-primary"
        disabled={primaryDisabled}
        aria-disabled={primaryDisabled}
        onClick={handleConfirm}
        className={cn(
          'focus-ring flex min-h-[var(--tap-primary)] w-full items-center justify-center rounded-[var(--radius)] px-3 text-base font-bold active:scale-[0.98]',
          primaryDisabled
            ? 'cursor-not-allowed border border-hairline bg-[hsl(var(--hairline))] text-ink-2'
            : 'bg-primary text-primary-foreground',
        )}
      >
        {primaryLabel}
      </button>

      {mode === 'edit' && onRemove && (
        <button
          type="button"
          data-testid="qty-keypad-remove"
          onClick={onRemove}
          className="focus-ring min-h-[var(--tap-min)] w-full text-sm text-ink-2 underline-offset-2 hover:text-ink hover:underline"
        >
          Remove from cart
        </button>
      )}

      <button
        type="button"
        onClick={onCancel}
        className="focus-ring min-h-[var(--tap-min)] w-full text-sm font-semibold text-ink-2"
      >
        Cancel
      </button>
    </div>
  );
}

export function QuantityKeypad({
  open,
  onOpenChange,
  returnFocusRef,
  ...bodyProps
}: QuantityKeypadProps) {
  const isMobile = useIsMobile();
  const contentRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(
    (next: boolean) => {
      if (!next) {
        onOpenChange(false);
        requestAnimationFrame(() => returnFocusRef?.current?.focus());
      } else {
        onOpenChange(true);
      }
    },
    [onOpenChange, returnFocusRef],
  );

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => contentRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose(false);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const allowDecimal = isDecimalUnit(bodyProps.product.unit);
        const parsed = parseKeypadQuantityString(bodyProps.inputValue, allowDecimal);
        if (parsed !== null) {
          bodyProps.onConfirm(parsed);
        }
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        bodyProps.onInputChange(
          qtyKeypadInputReducer(
            bodyProps.inputValue,
            { type: 'backspace' },
            isDecimalUnit(bodyProps.product.unit),
          ),
        );
        return;
      }
      if (e.key === '.' || e.key === ',') {
        e.preventDefault();
        bodyProps.onInputChange(
          qtyKeypadInputReducer(
            bodyProps.inputValue,
            { type: 'append', char: '.' },
            isDecimalUnit(bodyProps.product.unit),
          ),
        );
        return;
      }
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        bodyProps.onInputChange(
          qtyKeypadInputReducer(
            bodyProps.inputValue,
            { type: 'append', char: e.key },
            isDecimalUnit(bodyProps.product.unit),
          ),
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, bodyProps, handleClose]);

  const onCancel = useCallback(() => handleClose(false), [handleClose]);

  const inner = useMemo(
    () => <KeypadBody {...bodyProps} onCancel={onCancel} />,
    [bodyProps, onCancel],
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent
          side="bottom"
          ref={contentRef as React.RefObject<HTMLDivElement>}
          tabIndex={-1}
          className="max-h-[85vh] overflow-y-auto rounded-t-[var(--radius)] border-hairline bg-paper p-4 shadow-float motion-reduce:animate-none focus:outline-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SheetTitle className="sr-only">{bodyProps.product.name}</SheetTitle>
          {inner}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        ref={contentRef}
        tabIndex={-1}
        className="max-w-[400px] gap-0 border-hairline bg-paper p-4 motion-reduce:animate-none focus:outline-none sm:rounded-[var(--radius)]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">{bodyProps.product.name}</DialogTitle>
        {inner}
      </DialogContent>
    </Dialog>
  );
}
