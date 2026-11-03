import { cn } from '@/lib/utils';
import { formatTypedNumberPreview } from '@/lib/typedNumberPreview';

type TypedNumberHintProps = {
  value: string;
  className?: string;
  /** Optional prefix, e.g. "KES " */
  prefix?: string;
};

/** Shows comma-separated preview under numeric inputs while typing (e.g. 300000 → 300,000). */
export function TypedNumberHint({ value, className, prefix = '' }: TypedNumberHintProps) {
  const preview = formatTypedNumberPreview(value);
  if (!preview) return null;

  return (
    <p
      className={cn('text-xs text-muted-foreground tabular-nums', className)}
      aria-live="polite"
    >
      {prefix}
      {preview}
    </p>
  );
}
