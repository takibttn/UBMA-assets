import { and, asc, eq } from 'drizzle-orm';
import {
  formationLevels,
  formationTeachers,
  formations,
  languages,
} from '@/database/schema';
import type { AcademicSeedContext } from './context';
import { addDays } from './context';

const FORMATION_COUNT = 20;
/** Anchor for non-overlapping windows: teacher `t` gets slots at +90t days and +90t+45 days (30-day courses, ≈15-day gap). */
const ACADEMIC_WINDOW_BASE = new Date('2026-09-01T08:00:00.000Z');

export async function seedFormationsAndAssignments(
  ctx: AcademicSeedContext,
  adminId: string,
  teachersOrdered: Array<{ id: string }>,
): Promise<string[]> {
  if (teachersOrdered.length < 10) {
    throw new Error('Expected at least 10 teachers from seed');
  }

  const { db } = ctx;
  const combos = await db
    .select({
      languageId: formationLevels.languageId,
      levelId: formationLevels.id,
      langCode: languages.code,
      levelCode: formationLevels.code,
    })
    .from(formationLevels)
    .innerJoin(languages, eq(formationLevels.languageId, languages.id))
    .where(eq(formationLevels.isActive, true))
    .orderBy(asc(languages.code), asc(formationLevels.order));

  if (combos.length === 0) {
    throw new Error(
      'No language/level combinations; run languages/levels seed first',
    );
  }

  const formationIds: string[] = [];

  for (let i = 0; i < FORMATION_COUNT; i += 1) {
    const combo = combos[i % combos.length];
    const teacherIndex = Math.floor(i / 2);
    const isFirstOfPair = i % 2 === 0;
    const blockOffsetDays = teacherIndex * 90;
    const intraBlockDays = isFirstOfPair ? 0 : 45;
    const startDate = addDays(
      addDays(ACADEMIC_WINDOW_BASE, blockOffsetDays),
      intraBlockDays,
    );
    const endDate = addDays(startDate, 30);

    const title = `CEIL Academic Formation ${String(i + 1).padStart(2, '0')}`;
    let formationId: string;

    const existing = await db
      .select({ id: formations.id })
      .from(formations)
      .where(eq(formations.title, title))
      .limit(1);

    if (existing[0]) {
      formationId = existing[0].id;
    } else {
      const inserted = await db
        .insert(formations)
        .values({
          title,
          description: `Integrated academic seed · ${combo.langCode} ${combo.levelCode} · teacher slot ${teacherIndex + 1}`,
          languageId: combo.languageId,
          levelId: combo.levelId,
          creatorId: adminId,
          price: (1200 + i * 50).toString(),
          /** Must be ≤ smallest room used for sessions (LAB-01 = 20). See `seed.formation-sessions`. */
          capacity: 20,
          isSaleOpen: true,
          startDate,
          endDate,
        })
        .returning({ id: formations.id });
      formationId = inserted[0].id;
      ctx.counters.formationsInserted += 1;
    }

    formationIds.push(formationId);

    const existingFt = await db
      .select({ id: formationTeachers.id })
      .from(formationTeachers)
      .where(
        and(
          eq(formationTeachers.formationId, formationId),
          eq(formationTeachers.teacherId, teachersOrdered[teacherIndex].id),
        ),
      )
      .limit(1);

    if (!existingFt[0]) {
      await db.insert(formationTeachers).values({
        formationId,
        teacherId: teachersOrdered[teacherIndex].id,
        assignedById: adminId,
        role: 'MAIN_TEACHER',
      });
      ctx.counters.formationTeachersInserted += 1;
    }
  }

  return formationIds;
}
