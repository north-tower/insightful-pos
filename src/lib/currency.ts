/**
 * Centralized currency formatting utility.
 *
 * Default currency: KES (Kenyan Shilling)
 *
 * Usage:
 *   import { formatCurrency, fc, CURRENCY_SYMBOL } from '@/lib/currency';
 *   fc(1234.5)               → "KES 1,234.50"
 *   CURRENCY_SYMBOL           → "KES"
 */

const DEFAULT_CURRENCY = 'KES';
const DEFAULT_LOCALE = 'en-KE';

const formatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
  style: 'currency',
  currency: DEFAULT_CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** The currency code used as a display prefix, e.g. "KES" */
export const CURRENCY_SYMBOL = DEFAULT_CURRENCY;

/**
 * Format a number as currency.
 * @param amount  The numeric amount to format
 * @returns       Formatted string, e.g. "KES 1,234.50"
 */
export function formatCurrency(amount: number): string {
  return formatter.format(amount);
}

/** Short alias for formatCurrency */
export const fc = formatCurrency;
