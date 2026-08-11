/**
 * Parse API `from` / `to` query params for calendar overlap.
 * - Plain date `YYYY-MM-DD`: inclusive in UTC (start 00:00:00.000Z, end 23:59:59.999Z).
 * - Full ISO datetimes: used as-is for comparisons.
 */
export function parseTeacherCalendarBoundary(
  iso: string,
  endOfDay: boolean,
): Date {
  const s = iso.trim();
  if (!s) {
    throw new Error('Empty date string');
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(endOfDay ? `${s}T23:59:59.999Z` : `${s}T00:00:00.000Z`);
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new Error('Invalid date');
  }
  return d;
}

export function tryParseTeacherCalendarBoundary(
  iso: string,
  endOfDay: boolean,
): Date | null {
  try {
    return parseTeacherCalendarBoundary(iso, endOfDay);
  } catch {
    return null;
  }
}
