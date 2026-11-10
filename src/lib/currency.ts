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

import { formatKES, type FormatKESOptions } from '@/lib/formatKES';

/** The currency code used as a display prefix, e.g. "KES" */
export const CURRENCY_SYMBOL = 'KES';

/**
 * Format a number as currency (display strings, SMS, toasts).
 * Delegates to formatKES for consistent decimals and KES labelling.
 */
export function formatCurrency(amount: number, options?: FormatKESOptions): string {
  return formatKES(amount, options);
}

/** Short alias for formatCurrency */
export const fc = formatCurrency;
