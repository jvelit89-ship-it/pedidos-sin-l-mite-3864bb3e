const LIMA_TIMEZONE = 'America/Lima';

// Business day cutoff: 22:30 Lima time
// Orders from 22:30 of day X to 22:29:59 of day X+1 belong to day X+1
const BUSINESS_DAY_CUTOFF_HOUR = 22;
const BUSINESS_DAY_CUTOFF_MINUTE = 30;

const limaDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: LIMA_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const limaFullFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: LIMA_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * Returns YYYY-MM-DD in America/Lima for a given Date or ISO timestamp string.
 * This is a calendar-based date (00:00-23:59).
 */
export function getLimaDateKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return limaDateFormatter.format(d);
}

/**
 * Get Lima time components (hours, minutes, date parts) from a Date
 */
function getLimaTimeParts(date: Date): { hours: number; minutes: number; month: number; day: number; year: number } {
  const parts = limaFullFormatter.formatToParts(date);
  const getValue = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
  
  return {
    hours: getValue('hour'),
    minutes: getValue('minute'),
    day: getValue('day'),
    month: getValue('month'),
    year: getValue('year'),
  };
}

/**
 * Returns the "business day" (YYYY-MM-DD) based on 22:30-22:30 cutoff.
 * Orders created after 22:30 belong to the NEXT day.
 * Example: Order at 23:00 on Jan 20 → belongs to Jan 21
 */
export function getBusinessDateKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Get Lima time components using formatToParts for accuracy
  const { hours, minutes } = getLimaTimeParts(d);
  
  // If after 22:30, the order belongs to the next business day
  if (hours > BUSINESS_DAY_CUTOFF_HOUR || 
      (hours === BUSINESS_DAY_CUTOFF_HOUR && minutes >= BUSINESS_DAY_CUTOFF_MINUTE)) {
    // Add one day
    const nextDay = new Date(d.getTime() + 24 * 60 * 60 * 1000);
    return limaDateFormatter.format(nextDay);
  }
  
  return limaDateFormatter.format(d);
}

/**
 * Returns today's business date key (based on 22:30 cutoff).
 */
export function getTodayBusinessDateKey(): string {
  return getBusinessDateKey(new Date());
}

/**
 * Returns today's calendar date key in Lima timezone.
 */
export function getTodayLimaDateKey(): string {
  return getLimaDateKey(new Date());
}

/**
 * Returns the business day cutoff constants for display purposes.
 */
export function getBusinessDayCutoff(): { hour: number; minute: number } {
  return { hour: BUSINESS_DAY_CUTOFF_HOUR, minute: BUSINESS_DAY_CUTOFF_MINUTE };
}
