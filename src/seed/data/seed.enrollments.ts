import { and, eq } from 'drizzle-orm';
import { enrollments } from '@/database/schema';
import type { AcademicSeedContext } from './context';

/**
 * One ENROLLED row per learner: learner i → formationIds[i].
 * Disjoint date windows across formations guarantee no learner has overlapping courses.
 */
export async function seedEnrollments(
  ctx: AcademicSeedContext,
  learnersOrdered: Array<{ id: string }>,
  formationIdsInOrder: string[],
): Promise<void> {
  if (learnersOrdered.length !== formationIdsInOrder.length) {
    throw new Error(
      'Expected 20 learners and 20 formations for 1:1 academic seed enrollments',
    );
  }

  const { db } = ctx;
  for (let i = 0; i < learnersOrdered.length; i += 1) {
    const studentId = learnersOrdered[i].id;
    const formationId = formationIdsInOrder[i];
    const exists = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.formationId, formationId),
        ),
      )
      .limit(1);

    if (exists[0]) continue;

    await db.insert(enrollments).values({
      studentId,
      formationId,
      status: 'ENROLLED',
    });
    ctx.counters.enrollmentsInserted += 1;
  }
}
