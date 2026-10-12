/**
 * Numeric portion of a KES display (thousands separators; 0 or 2 fraction digits).
 * @example formatKESAmount(6793) → "6,793"
 * @example formatKESAmount(6793.5) → "6,793.50"
 */
export function formatKESAmount(amount: number): string {
  const hasFraction = Math.abs(amount % 1) > 1e-9;
  return new Intl.NumberFormat('en-KE', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(amount);
}

/**
 * Display KES amounts for POS receipt UI: whole amounts omit decimals; otherwise exactly two.
 * @example formatKES(340) → "KES 340"
 * @example formatKES(6793.5) → "KES 6,793.50"
 */
export function formatKES(amount: number): string {
  return `KES ${formatKESAmount(amount)}`;
}

/** Compact KES for chart axes (K / M abbreviations only). */
export function formatKESAxis(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    const v = amount / 1_000_000;
    const decimals = Math.abs(v) >= 10 ? 0 : 1;
    return `KES ${v.toFixed(decimals)}M`;
  }
  if (abs >= 1_000) {
    const v = amount / 1_000;
    const decimals = Math.abs(v) >= 10 ? 0 : 1;
    return `KES ${v.toFixed(decimals)}K`;
  }
  const hasFraction = Math.abs(amount % 1) > 1e-9;
  const formatted = new Intl.NumberFormat('en-KE', {
    minimumFractionDigits: hasFraction ? 1 : 0,
    maximumFractionDigits: hasFraction ? 1 : 0,
  }).format(amount);
  return `KES ${formatted}`;
}
