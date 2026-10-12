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

/** Weekday + calendar date in Nairobi, e.g. "Mon 12 Oct 2026". */
export function formatDateWithWeekday(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: NAIROBI,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/** Sync timestamp for dashboard header, e.g. "12 Oct 2026, 11:27". */
export function formatSyncedDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: NAIROBI,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}
