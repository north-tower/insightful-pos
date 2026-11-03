import { formatKESAmount } from '@/lib/formatKES';

/** Loose numeric string while the user is typing (no thousands separators). */
const LOOSE_NUMBER = /^-?(?:\d+\.?\d*|\.\d*)$/;

/**
 * Format a in-progress numeric field for display beneath the input.
 * Returns null when empty, invalid, or formatting would not help (e.g. "42" → "42").
 */
export function formatTypedNumberPreview(raw: string): string | null {
  const trimmed = raw.trim().replace(/,/g, '');
  if (!trimmed || trimmed === '-' || trimmed === '.') return null;
  if (!LOOSE_NUMBER.test(trimmed)) return null;

  const trailingDot =
    trimmed.endsWith('.') && trimmed.indexOf('.') === trimmed.length - 1;
  const numericPart = trailingDot ? trimmed.slice(0, -1) : trimmed;
  if (!numericPart || numericPart === '-') return null;

  const value = Number(numericPart);
  if (!Number.isFinite(value)) return null;

  let formatted = formatKESAmount(value);
  if (trailingDot) formatted += '.';

  const rawComparable = trimmed.replace(/\.$/, '');
  const formattedComparable = formatted.replace(/,/g, '').replace(/\.$/, '');
  if (formattedComparable === rawComparable) return null;

  return formatted;
}
