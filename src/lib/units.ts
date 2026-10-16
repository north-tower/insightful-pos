/** Normalized unit token for display (lowercase, trimmed). */
export function normalizeUnit(unit: string | null | undefined): string {
  return (unit || 'pcs').trim().toLowerCase();
}

/** POS tile/list unit suffix (display only; does not change stored values). */
export function formatDisplayUnit(unit: string | null | undefined): string {
  const u = normalizeUnit(unit);
  if (u === 'kgs') return 'kg';
  return u;
}

const DECIMAL_UNITS = new Set([
  'kg',
  'kgs',
  'kilogram',
  'kilograms',
  'g',
  'gram',
  'grams',
  'l',
  'ltr',
  'liter',
  'liters',
  'litre',
  'litres',
  'metre',
  'metres',
  'meter',
  'meters',
  'm',
]);

const INTEGER_UNITS = new Set([
  'pcs',
  'pc',
  'piece',
  'pieces',
  'bag',
  'bags',
  'each',
  'ea',
]);

/**
 * Whether the product unit supports fractional quantities in POS.
 * No separate flag on Product — mapping lives here (see INTEGER_UNITS / DECIMAL_UNITS).
 */
export function isDecimalUnit(unit: string | null | undefined): boolean {
  const u = normalizeUnit(unit);
  if (INTEGER_UNITS.has(u)) return false;
  if (DECIMAL_UNITS.has(u)) return true;
  // Unknown units default to integer (safe for count-based sales).
  return false;
}

function formatQtyNumber(qty: number): string {
  const rounded = Math.round(qty * 1000) / 1000;
  if (!Number.isFinite(rounded)) return '0';

  const abs = Math.abs(rounded);
  const sign = rounded < 0 ? '-' : '';

  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
    return sign + new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(abs);
  }

  const raw = abs.toFixed(3).replace(/\.?0+$/, '');
  const [intPart, decPart] = raw.split('.');
  const intFormatted = new Intl.NumberFormat('en-KE').format(Number(intPart));
  return decPart ? `${sign}${intFormatted}.${decPart}` : `${sign}${intFormatted}`;
}

/** Human-readable quantity with unit, e.g. "2.5 kg", "4,230 kgs", "3 pcs". */
export function formatQty(qty: number, unit: string | null | undefined): string {
  const u = normalizeUnit(unit);
  return `${formatQtyNumber(qty)} ${u}`;
}

/** Numeric portion only (for compact badges). */
export function formatQtyAmount(qty: number): string {
  return formatQtyNumber(qty);
}
