import type { AcademicSeedContext } from './context';
import {
  buildSlots,
  resolveSameDayFormationTargets,
  seedSameDayFormationSlots,
} from './seed.same-day-formations.part1';

/** Same calendar day (UTC); multiple short sessions — non-overlapping so teacher assignment rules pass. */
const DEFAULT_SAME_DAY_UTC = { year: 2026, monthIndex: 4, day: 15 } as const;

export type SameDaySeedOptions = {
  /** Must already exist from academic seed (or any teacher). */
  teacherEmail?: string;
  year?: number;
  /** 0 = January */
  monthIndex?: number;
  day?: number;
  /** How many back-to-back-safe slots to create (default 10). */
  slotCount?: number;
};

/**
 * Extra seed: attach many formations on **one calendar day** (UTC), different times, close together.
 * Run **after** `npm run db:seed` so admin, teacher, and languages/levels exist.
 *
 * Does not use Nest services — inserts satisfy overlap math (gaps between sessions).
 */
export async function seedSameDayFormationsForExistingTeacher(
  ctx: AcademicSeedContext,
  options: SameDaySeedOptions = {},
): Promise<{
  formationsCreated: number;
  assignmentsCreated: number;
  teacherEmail: string;
  dayISO: string;
  slots: Array<{ title: string; start: string; end: string }>;
}> {
  const {
    teacherEmail = 'teacher.01@email.com',
    year = DEFAULT_SAME_DAY_UTC.year,
    monthIndex = DEFAULT_SAME_DAY_UTC.monthIndex,
    day = DEFAULT_SAME_DAY_UTC.day,
    slotCount = 10,
  } = options;

  const emailLower = teacherEmail.toLowerCase();

  const targets = await resolveSameDayFormationTargets(ctx, teacherEmail);
  const slots = buildSlots(year, monthIndex, day, slotCount);
  const dayISO = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const {
    formationsCreated,
    assignmentsCreated,
    slots: outSlots,
  } = await seedSameDayFormationSlots(ctx, targets, slots, dayISO);

  return {
    formationsCreated,
    assignmentsCreated,
    teacherEmail: emailLower,
    dayISO,
    slots: outSlots,
  };
}
