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

function nairobiCalendarKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: NAIROBI,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function nairobiYesterdayKey(from: Date): string {
  const key = nairobiCalendarKey(from);
  const [y, m, d] = key.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() - 1);
  return utc.toISOString().slice(0, 10);
}

const NAIROBI_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: NAIROBI,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const NAIROBI_DAY_MONTH = new Intl.DateTimeFormat('en-GB', {
  timeZone: NAIROBI,
  day: 'numeric',
  month: 'short',
});

/** Recent sale row time: HH:mm today; "Yesterday HH:mm"; "12 Oct" when older. */
export function formatRecentSaleTime(iso: string, referenceNow: Date = new Date()): string {
  const sale = new Date(iso);
  const saleKey = nairobiCalendarKey(sale);
  const todayKey = nairobiCalendarKey(referenceNow);
  const time = NAIROBI_TIME.format(sale);

  if (saleKey === todayKey) return time;
  if (saleKey === nairobiYesterdayKey(referenceNow)) return `Yesterday ${time}`;
  return NAIROBI_DAY_MONTH.format(sale);
}
