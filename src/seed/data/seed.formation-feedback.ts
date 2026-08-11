import { and, asc, eq } from 'drizzle-orm';
import { enrollments, formationFeedback } from '@/database/schema';
import type { AcademicSeedContext } from './context';

const DEMO_RATINGS = [5, 4, 5, 3, 4, 2, 5, 0, 1, 4] as const;
const DEMO_COMMENTS = [
  'Très satisfait du cours.',
  'Bon rythme, prof accessible.',
  'Matériel clair.',
  null,
  'Peut mieux faire sur les exercices oraux.',
  null,
  'Excellente dynamique de groupe.',
  null,
] as const;

export type SeedFormationFeedbackOptions = {
  /** How many formations from `formationIds` to process (default 8). */
  maxFormations?: number;
  /** Max feedback rows per formation — earliest ENROLLED enrollments first (default 5). */
  maxFeedbackPerFormation?: number;
};

/**
 * Idempotent `formation_feedback` rows for analytics / teacher tracking demos.
 * Links `enrollment_id`, `formation_id`, `student_id`; skips if `(formationId, studentId)` exists.
 *
 * Use with the main pipeline `formationIds` order, or call
 * `seedFormationFeedbackForExistingEnrollments` to attach to whatever is already in DB.
 */
export async function seedFormationFeedbackDemo(
  ctx: AcademicSeedContext,
  formationIds: string[],
  options: SeedFormationFeedbackOptions = {},
): Promise<void> {
  const maxFormations = options.maxFormations ?? 8;
  const maxPer = options.maxFeedbackPerFormation ?? 5;
  const target = formationIds.slice(0, maxFormations);
  if (target.length === 0) return;

  const { db } = ctx;
  let idx = 0;

  for (const formationId of target) {
    const enrRows = await db
      .select({
        id: enrollments.id,
        studentId: enrollments.studentId,
      })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.formationId, formationId),
          eq(enrollments.status, 'ENROLLED'),
        ),
      )
      .orderBy(asc(enrollments.enrolledAt))
      .limit(maxPer);

    for (const enr of enrRows) {
      const existing = await db
        .select({ id: formationFeedback.id })
        .from(formationFeedback)
        .where(
          and(
            eq(formationFeedback.formationId, formationId),
            eq(formationFeedback.studentId, enr.studentId),
          ),
        )
        .limit(1);

      if (existing[0]) continue;

      const rating = DEMO_RATINGS[idx % DEMO_RATINGS.length];
      const comment = DEMO_COMMENTS[idx % DEMO_COMMENTS.length];
      idx += 1;

      const now = new Date();
      await db.insert(formationFeedback).values({
        formationId,
        studentId: enr.studentId,
        enrollmentId: enr.id,
        rating,
        comment,
        createdAt: now,
        updatedAt: now,
      });
      ctx.counters.formationFeedbackInserted += 1;
    }
  }
}

/**
 * Standalone / repair: all formations that have at least one ENROLLED enrollment get demo feedback
 * (capped per formation). Safe on partially seeded DBs.
 */
export async function seedFormationFeedbackForExistingEnrollments(
  ctx: AcademicSeedContext,
  options: SeedFormationFeedbackOptions = {},
): Promise<void> {
  const maxPer = options.maxFeedbackPerFormation ?? 5;
  const { db } = ctx;

  const formationRows = await db
    .select({ formationId: enrollments.formationId })
    .from(enrollments)
    .where(eq(enrollments.status, 'ENROLLED'))
    .groupBy(enrollments.formationId);

  const formationIds = formationRows.map((r) => r.formationId);
  await seedFormationFeedbackDemo(ctx, formationIds, {
    maxFormations: formationIds.length,
    maxFeedbackPerFormation: maxPer,
  });
}
