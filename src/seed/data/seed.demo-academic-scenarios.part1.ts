import { and, asc, eq } from 'drizzle-orm';
import {
  formationLevels,
  formationTeachers,
  formations,
  languages,
} from '@/database/schema';
import type { AcademicSeedContext } from './context';
import { addDays } from './context';

const CLOSED_SALE_TITLE = 'CEIL Academic Demo — Inscriptions fermées';

export function setUtcTime(d: Date, hour: number, minute: number): Date {
  const o = new Date(d);
  o.setUTCHours(hour, minute, 0, 0);
  return o;
}

export async function firstLanguageLevelIds(
  db: AcademicSeedContext['db'],
): Promise<{ languageId: string; levelId: string }> {
  const [row] = await db
    .select({
      languageId: formationLevels.languageId,
      levelId: formationLevels.id,
    })
    .from(formationLevels)
    .innerJoin(languages, eq(formationLevels.languageId, languages.id))
    .where(eq(formationLevels.isActive, true))
    .orderBy(asc(languages.code), asc(formationLevels.order))
    .limit(1);
  if (!row) {
    throw new Error('Academic demo: no language/level');
  }
  return row;
}

export async function seedClosedSaleFormation(
  ctx: AcademicSeedContext,
  adminId: string,
  languageId: string,
  levelId: string,
  mainTeacherId: string,
): Promise<void> {
  const { db } = ctx;
  const closedStart = new Date('2030-01-15T08:00:00.000Z');
  const closedEnd = addDays(closedStart, 35);
  let closedFormationId: string;
  const existingClosed = await db
    .select({ id: formations.id })
    .from(formations)
    .where(eq(formations.title, CLOSED_SALE_TITLE))
    .limit(1);
  if (existingClosed[0]) {
    closedFormationId = existingClosed[0].id;
  } else {
    const [ins] = await db
      .insert(formations)
      .values({
        title: CLOSED_SALE_TITLE,
        description:
          'Démo pédagogique · vente fermée · données de test CEIL uniquement',
        languageId,
        levelId,
        creatorId: adminId,
        price: '0',
        capacity: 15,
        isSaleOpen: false,
        startDate: closedStart,
        endDate: closedEnd,
      })
      .returning({ id: formations.id });
    closedFormationId = ins.id;
    ctx.counters.formationsInserted += 1;
  }

  const closedFt = await db
    .select({ id: formationTeachers.id })
    .from(formationTeachers)
    .where(
      and(
        eq(formationTeachers.formationId, closedFormationId),
        eq(formationTeachers.teacherId, mainTeacherId),
      ),
    )
    .limit(1);
  if (!closedFt[0]) {
    await db.insert(formationTeachers).values({
      formationId: closedFormationId,
      teacherId: mainTeacherId,
      assignedById: adminId,
      role: 'MAIN_TEACHER',
    });
    ctx.counters.formationTeachersInserted += 1;
  }
}
