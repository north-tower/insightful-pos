/**
 * Display KES amounts for POS receipt UI: decimals only when non-zero fractional part.
 * @example formatKES(340) → "KES 340"
 * @example formatKES(1234.5) → "KES 1,234.5"
 */
export function formatKES(amount: number): string {
  const hasFraction = Math.abs(amount % 1) > 1e-9;
  const formatted = new Intl.NumberFormat('en-KE', {
    minimumFractionDigits: hasFraction ? 1 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return `KES ${formatted}`;
}
