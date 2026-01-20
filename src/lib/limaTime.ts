const LIMA_TIMEZONE = 'America/Lima';

const limaDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: LIMA_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Returns YYYY-MM-DD in America/Lima for a given Date or ISO timestamp string.
 */
export function getLimaDateKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return limaDateFormatter.format(d);
}
