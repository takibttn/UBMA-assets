import { randomUUID } from 'crypto';

/**
 * Session generation uses UTC calendar days and UTC clock times.
 * `formation.startDate` / `formation.endDate` from the DB are compared as Date values
 * (timestamps; API layer should send ISO 8601 with explicit offset, preferably Z).
 */
export type GeneratedSessionCandidate = {
  tempId: string;
  formationId: string;
  roomId: string;
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date;
  dayOfWeek: number;
  /** Zero-based index into the request `weeklySlots` array (frontend maps conflicts per slot). */
  slotIndex: number;
};

export function parseTimeToHoursMinutes(time: string): {
  hour: number;
  minute: number;
} {
  const s = time.trim();
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s);
  if (!m) {
    throw new Error('INVALID_TIME');
  }
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

export function combineDateWithTime(dateUtcMidnight: Date, time: string): Date {
  const { hour, minute } = parseTimeToHoursMinutes(time);
  const y = dateUtcMidnight.getUTCFullYear();
  const mon = dateUtcMidnight.getUTCMonth();
  const d = dateUtcMidnight.getUTCDate();
  return new Date(Date.UTC(y, mon, d, hour, minute, 0, 0));
}

export function getIsoDayOfWeek(date: Date): number {
  const js = date.getUTCDay();
  return js === 0 ? 7 : js;
}

export function utcCalendarStart(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addUtcDays(utcMidnight: Date, n: number): Date {
  const x = new Date(utcMidnight.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

/**
 * First calendar date (UTC, start-of-day) on or after `startDate` that matches ISO weekday (1=Mon..7=Sun).
 */
export function findFirstDateForDayOfWeek(
  startDate: Date,
  dayOfWeek: number,
): Date {
  const base = utcCalendarStart(startDate);
  for (let i = 0; i < 7; i += 1) {
    const d = addUtcDays(base, i);
    if (getIsoDayOfWeek(d) === dayOfWeek) {
      return d;
    }
  }
  return base;
}

function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

export type WeeklySlotInput = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  roomId: string;
  title?: string;
  description?: string | null;
};

export function generateWeeklySessionCandidates(
  formationId: string,
  formationTitle: string,
  periodStart: Date,
  periodEnd: Date,
  weeklySlots: WeeklySlotInput[],
): GeneratedSessionCandidate[] {
  const out: GeneratedSessionCandidate[] = [];
  weeklySlots.forEach((slot, slotIndex) => {
    const firstDay = findFirstDateForDayOfWeek(periodStart, slot.dayOfWeek);
    let cursor = firstDay;
    while (true) {
      const startAt = combineDateWithTime(cursor, slot.startTime);
      if (startAt.getTime() > periodEnd.getTime()) {
        break;
      }
      const endAt = combineDateWithTime(cursor, slot.endTime);
      if (
        startAt.getTime() >= periodStart.getTime() &&
        endAt.getTime() <= periodEnd.getTime()
      ) {
        const title = slot.title?.trim() || `${formationTitle} - Séance`;
        out.push({
          tempId: randomUUID(),
          formationId,
          roomId: slot.roomId,
          title,
          description: slot.description?.trim()
            ? slot.description.trim()
            : null,
          startAt,
          endAt,
          dayOfWeek: slot.dayOfWeek,
          slotIndex,
        });
      }
      cursor = addUtcDays(cursor, 7);
    }
  });
  out.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  return out;
}

/**
 * Same expansion as one entry in {@link generateWeeklySessionCandidates}, without room / title.
 * Used for room weekly availability (admin UX) and must stay aligned with preview/generate.
 */
export function generateWeeklySlotIntervals(
  periodStart: Date,
  periodEnd: Date,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
): Array<{ startAt: Date; endAt: Date }> {
  const out: Array<{ startAt: Date; endAt: Date }> = [];
  const firstDay = findFirstDateForDayOfWeek(periodStart, dayOfWeek);
  let cursor = firstDay;
  while (true) {
    const startAt = combineDateWithTime(cursor, startTime);
    if (startAt.getTime() > periodEnd.getTime()) {
      break;
    }
    const endAt = combineDateWithTime(cursor, endTime);
    if (
      startAt.getTime() >= periodStart.getTime() &&
      endAt.getTime() <= periodEnd.getTime()
    ) {
      out.push({ startAt, endAt });
    }
    cursor = addUtcDays(cursor, 7);
  }
  return out;
}

export function sessionIntervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return rangesOverlap(aStart, aEnd, bStart, bEnd);
}

export function candidatesRoomOverlap(
  a: GeneratedSessionCandidate,
  b: GeneratedSessionCandidate,
): boolean {
  if (a.roomId !== b.roomId) return false;
  return rangesOverlap(a.startAt, a.endAt, b.startAt, b.endAt);
}

export function candidatesFormationOverlap(
  a: GeneratedSessionCandidate,
  b: GeneratedSessionCandidate,
): boolean {
  if (a.formationId !== b.formationId) return false;
  return rangesOverlap(a.startAt, a.endAt, b.startAt, b.endAt);
}
