export type FormatKESOptions = {
  /** Prefix positive amounts with + (negatives always use − before KES). */
  signed?: boolean;
};

const MINUS = '\u2212';

/**
 * Numeric portion of a KES display (thousands separators; 0 or 2 fraction digits).
 * @example formatKESAmount(6793) → "6,793"
 * @example formatKESAmount(6793.5) → "6,793.50"
 */
export function formatKESAmount(amount: number): string {
  const abs = Math.abs(amount);
  const hasFraction = Math.abs(abs % 1) > 1e-9;
  return new Intl.NumberFormat('en-KE', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(abs);
}

/**
 * Display KES amounts: whole amounts omit decimals; otherwise exactly two.
 * Negatives render as "−KES 2,000" (U+2212 before KES).
 * @example formatKES(340) → "KES 340"
 * @example formatKES(6793.5) → "KES 6,793.50"
 * @example formatKES(-2000) → "−KES 2,000"
 */
export function formatKES(amount: number, options?: FormatKESOptions): string {
  if (amount === 0 || Math.abs(amount) < 1e-9) {
    return 'KES 0';
  }
  const num = formatKESAmount(amount);
  if (amount < 0) {
    return `${MINUS}KES ${num}`;
  }
  if (options?.signed) {
    return `+KES ${num}`;
  }
  return `KES ${num}`;
}

function formatKESAxisCore(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    const v = amount / 1_000_000;
    const decimals = Math.abs(v) >= 10 ? 0 : 1;
    return `${v.toFixed(decimals)}M`;
  }
  if (abs >= 1_000) {
    const v = amount / 1_000;
    const decimals = Math.abs(v) >= 10 ? 0 : 1;
    return `${v.toFixed(decimals)}K`;
  }
  const hasFraction = Math.abs(amount % 1) > 1e-9;
  return new Intl.NumberFormat('en-KE', {
    minimumFractionDigits: hasFraction ? 1 : 0,
    maximumFractionDigits: hasFraction ? 1 : 0,
  }).format(amount);
}

/** Compact KES for chart axes (K / M abbreviations only). */
export function formatKESCompact(amount: number): string {
  return formatKESAxisCore(amount);
}

/** Compact axis label with currency prefix (wider viewports). */
export function formatKESAxis(amount: number): string {
  return `KES ${formatKESAxisCore(amount)}`;
}

/** Chart Y-axis ticks without currency prefix (narrow viewports). */
export function formatKESAxisTick(amount: number): string {
  return formatKESCompact(amount);
}

/**
 * KES amounts for SMS: same grouping/decimals as the app, with ASCII minus (GSM-7) not Unicode −.
 * Commas are fine — the gateway receives the full body via POST JSON, not a GET query string.
 */
export function formatKESForSms(amount: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 'KES 0';
  if (n === 0 || Math.abs(n) < 1e-9) return 'KES 0';

  const numeric = formatKESAmount(n);
  if (n < 0) return `-KES ${numeric}`;
  return `KES ${numeric}`;
}
