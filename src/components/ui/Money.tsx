import { cn } from '@/lib/utils';
import { formatKES, formatKESAmount } from '@/lib/formatKES';

export type MoneyDisplaySize = 'md' | 'lg' | 'xl' | 'hero';

const DISPLAY_SIZE_CLASS: Record<MoneyDisplaySize, string> = {
  md: 'text-[20px] leading-[1.1] tracking-[-0.01em]',
  lg: 'text-[24px] leading-[1.1] tracking-[-0.01em]',
  xl: 'text-[32px] leading-[1.1] tracking-[-0.01em]',
  hero: 'text-[40px] leading-[1.1] tracking-[-0.01em] md:text-[56px]',
};

const KES_LABEL_CLASS: Record<MoneyDisplaySize, string> = {
  md: 'text-[min(13px,0.45em)]',
  lg: 'text-[max(13px,0.45em)]',
  xl: 'text-[max(13px,0.45em)]',
  hero: 'text-[max(13px,0.45em)]',
};

/** @deprecated Prefer MoneyDisplaySize tokens */
export type MoneyLegacySize = 24 | 28 | 32 | 40;

function resolveSize(size: MoneyDisplaySize | MoneyLegacySize): MoneyDisplaySize {
  if (typeof size === 'string') return size;
  if (size === 24) return 'lg';
  if (size === 28) return 'lg';
  if (size === 32) return 'xl';
  return 'hero';
}

export function Money({
  value,
  variant = 'inline',
  size = 'lg',
  signed = false,
  /** Stylistic minus before a positive deduction (e.g. paid so far). */
  sign = 'none',
  strike = false,
  muted = false,
  className,
  /** @deprecated Use default inline mono, or display variant. */
  sansInline = false,
  /** @deprecated Display variant uses a separate KES label. */
  currencyLabel = true,
  align,
}: {
  value: number;
  variant?: 'display' | 'inline';
  size?: MoneyDisplaySize | MoneyLegacySize;
  signed?: boolean;
  sign?: 'none' | 'minus';
  strike?: boolean;
  muted?: boolean;
  className?: string;
  sansInline?: boolean;
  currencyLabel?: boolean;
  align?: 'left' | 'right';
}) {
  const resolved = resolveSize(size);
  const ariaLabel =
    sign === 'minus' && value >= 0
      ? `\u2212${formatKES(Math.abs(value))}`
      : formatKES(value, { signed });
  const isNegative = value < 0 && sign === 'none';
  const amountPart = formatKESAmount(Math.abs(value));

  const strikeClass = strike ? 'line-through' : '';
  const inkClass = muted ? 'text-ink-2' : 'text-ink';

  if (variant === 'display') {
    const kesLabel = currencyLabel ? (
      <span
        className={cn(
          'shrink-0 font-semibold text-ink-2',
          KES_LABEL_CLASS[resolved],
        )}
        aria-hidden
      >
        {isNegative ? '\u2212KES' : 'KES'}
      </span>
    ) : null;

    return (
      <span
        role="text"
        aria-label={ariaLabel}
        className={cn(
          'inline-flex items-baseline gap-1.5 font-sans font-bold tabular-nums',
          inkClass,
          DISPLAY_SIZE_CLASS[resolved],
          strikeClass,
          align === 'right' && 'ml-auto text-right',
          className,
        )}
      >
        {kesLabel}
        <span aria-hidden>
          {sign === 'minus' && value >= 0 ? '\u2212' : signed && value > 0 ? '+' : ''}
          {amountPart}
        </span>
      </span>
    );
  }

  const inlineText =
    sign === 'minus' && value >= 0
      ? `\u2212${formatKES(Math.abs(value))}`
      : formatKES(value, { signed });

  return (
    <span
      role="text"
      aria-label={ariaLabel}
      className={cn(
        'tabular-nums',
        sansInline ? 'font-sans' : 'font-mono',
        inkClass,
        strikeClass,
        align === 'right' && 'block text-right',
        className,
      )}
    >
      <span aria-hidden>{inlineText}</span>
    </span>
  );
}
