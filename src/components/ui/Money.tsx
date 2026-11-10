import { cn } from '@/lib/utils';
import { formatKES, formatKESAmount } from '@/lib/formatKES';

export type MoneyDisplaySize = 24 | 28 | 32 | 40;

const DISPLAY_SIZE_CLASS: Record<MoneyDisplaySize, string> = {
  24: 'text-[24px] leading-tight',
  28: 'text-[28px] leading-tight',
  32: 'text-[32px] leading-tight',
  40: 'text-[40px] leading-tight',
};

export function Money({
  value,
  variant = 'inline',
  size = 28,
  currencyLabel = true,
  sign = 'none',
  className,
  sansInline = false,
}: {
  value: number;
  variant?: 'display' | 'inline';
  size?: MoneyDisplaySize;
  /** Display variant only — show separate KES label beside the figure. */
  currencyLabel?: boolean;
  sign?: 'none' | 'minus';
  className?: string;
  /** Inline KES string in sans (e.g. primary dialog footer). */
  sansInline?: boolean;
}) {
  const prefix = sign === 'minus' ? '−' : '';

  if (variant === 'display') {
    return (
      <span
        className={cn(
          'inline-flex items-baseline gap-1.5 font-sans font-bold tabular-nums text-ink',
          DISPLAY_SIZE_CLASS[size],
          className,
        )}
      >
        {currencyLabel ? (
          <span className="text-sm font-semibold text-ink-2">KES</span>
        ) : null}
        <span>
          {prefix}
          {formatKESAmount(value)}
        </span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        'tabular-nums',
        sansInline ? 'font-sans' : 'font-mono',
        className,
      )}
    >
      {prefix}
      {formatKES(value)}
    </span>
  );
}
