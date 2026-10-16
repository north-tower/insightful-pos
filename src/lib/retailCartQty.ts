import { isDecimalUnit } from '@/lib/units';

/** Same line total as retail cart rows and checkout subtotal (unit price × quantity). */
export function getRetailLineTotal(unitPrice: number, quantity: number): number {
  return unitPrice * quantity;
}

/**
 * Parse committed quantity from cart inline edit or keypad confirm.
 * Matches prior cart rules: integers for count units; positive decimals (≤3 dp) for weight/volume units.
 */
export function parseCommittedCartQuantity(
  raw: string,
  unit: string | null | undefined,
): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (isDecimalUnit(unit)) {
    const val = parseFloat(trimmed);
    if (!Number.isFinite(val) || val <= 0) return null;
    return Math.round(val * 1000) / 1000;
  }

  const val = parseInt(trimmed, 10);
  if (!Number.isFinite(val) || val <= 0) return null;
  return val;
}
