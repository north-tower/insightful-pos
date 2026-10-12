const NAIROBI = 'Africa/Nairobi';

/** Calendar date in Nairobi, e.g. "12 Oct 2026". */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: NAIROBI,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
