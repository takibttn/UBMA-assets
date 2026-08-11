import { and, asc, eq } from 'drizzle-orm';
import {
  formationLevels,
  formationTeachers,
  formations,
  languages,
  teachers,
  users,
} from '@/database/schema';
import type { AcademicSeedContext } from './context';
import { ADMIN_EMAIL } from './types';

const TITLE_PREFIX = 'CEIL SameDay Slot';

/**
 * N sessions on one UTC day: each 60 minutes, 15-minute gap between (no overlap for assignment rules).
 */
export function buildSlots(
  year: number,
  monthIndex: number,
  day: number,
  count: number,
): Array<{ start: Date; end: Date }> {
  const slots: Array<{ start: Date; end: Date }> = [];
  let cursorMin = 8 * 60;
  for (let i = 0; i < count; i += 1) {
    const startMin = cursorMin;
    const endMin = cursorMin + 60;
    cursorMin = endMin + 15;
    const start = new Date(
      Date.UTC(
        year,
        monthIndex,
        day,
        Math.floor(startMin / 60),
        startMin % 60,
        0,
      ),
    );
    const end = new Date(
      Date.UTC(year, monthIndex, day, Math.floor(endMin / 60), endMin % 60, 0),
    );
    slots.push({ start, end });
  }
  return slots;
}

export type SameDayFormationTargets = {
  adminId: string;
  teacherId: string;
  languageId: string;
  levelId: string;
};

export async function resolveSameDayFormationTargets(
  ctx: AcademicSeedContext,
  teacherEmail: string,
): Promise<SameDayFormationTargets> {
  const { db } = ctx;
  const emailLower = teacherEmail.toLowerCase();

  const adminRow = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL.toLowerCase()))
    .limit(1);
  if (!adminRow[0]) {
    throw new Error(
      `Admin not found (${ADMIN_EMAIL}). Run npm run db:seed first.`,
    );
  }

  const teacherRow = await db
    .select({ id: teachers.id })
    .from(teachers)
    .where(eq(teachers.email, emailLower))
    .limit(1);
  if (!teacherRow[0]) {
    throw new Error(
      `Teacher not found (${teacherEmail}). Run npm run db:seed first.`,
    );
  }

  const combo = await db
    .select({
      languageId: formationLevels.languageId,
      levelId: formationLevels.id,
    })
    .from(formationLevels)
    .innerJoin(languages, eq(formationLevels.languageId, languages.id))
    .where(eq(formationLevels.isActive, true))
    .orderBy(asc(languages.code), asc(formationLevels.order))
    .limit(1);

  if (!combo[0]) {
    throw new Error('No language/level row found. Run npm run db:seed first.');
  }

  return {
    adminId: adminRow[0].id,
    teacherId: teacherRow[0].id,
    languageId: combo[0].languageId,
    levelId: combo[0].levelId,
  };
}

export type SameDaySlotResult = {
  formationsCreated: number;
  assignmentsCreated: number;
  slots: Array<{ title: string; start: string; end: string }>;
};

export async function seedSameDayFormationSlots(
  ctx: AcademicSeedContext,
  targets: SameDayFormationTargets,
  slots: Array<{ start: Date; end: Date }>,
  dayISO: string,
): Promise<SameDaySlotResult> {
  const { db } = ctx;
  const { adminId, teacherId, languageId, levelId } = targets;

  let formationsCreated = 0;
  let assignmentsCreated = 0;
  const outSlots: Array<{ title: string; start: string; end: string }> = [];

  for (let i = 0; i < slots.length; i += 1) {
    const { start, end } = slots[i];
    const title = `${TITLE_PREFIX} ${String(i + 1).padStart(2, '0')} · ${dayISO}`;

    const existing = await db
      .select({ id: formations.id })
      .from(formations)
      .where(eq(formations.title, title))
      .limit(1);

    let formationId: string;
    if (existing[0]) {
      formationId = existing[0].id;
    } else {
      const inserted = await db
        .insert(formations)
        .values({
          title,
          description: `Dense same-day seed · UTC ${dayISO} · slot ${i + 1}/${slots.length}`,
          languageId,
          levelId,
          creatorId: adminId,
          price: '400',
          capacity: 20,
          isSaleOpen: true,
          startDate: start,
          endDate: end,
        })
        .returning({ id: formations.id });
      formationId = inserted[0].id;
      formationsCreated += 1;
    }

    outSlots.push({
      title,
      start: start.toISOString(),
      end: end.toISOString(),
    });

    const existingFt = await db
      .select({ id: formationTeachers.id })
      .from(formationTeachers)
      .where(
        and(
          eq(formationTeachers.formationId, formationId),
          eq(formationTeachers.teacherId, teacherId),
        ),
      )
      .limit(1);

    if (!existingFt[0]) {
      await db.insert(formationTeachers).values({
        formationId,
        teacherId,
        assignedById: adminId,
        role: 'MAIN_TEACHER',
      });
      assignmentsCreated += 1;
    }
  }

  return { formationsCreated, assignmentsCreated, slots: outSlots };
}
