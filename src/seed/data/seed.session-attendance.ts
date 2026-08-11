import { and, asc, eq } from 'drizzle-orm';
import {
  enrollments,
  formationSessions,
  formationTeachers,
  sessionAttendance,
} from '@/database/schema';
import type { AcademicSeedContext } from './context';

const DEMO_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const;

/**
 * Deterministic demo rows for attendance APIs / enrollment summaries.
 * - First **3** formations in `formationIds`: for each, first **2** sessions get marks for all ENROLLED learners.
 * - Status cycles PRESENT → ABSENT → LATE → EXCUSED over (learner × session) index.
 * Idempotent: skips existing `(sessionId, enrollmentId)`.
 */
export async function seedSessionAttendanceDemo(
  ctx: AcademicSeedContext,
  formationIds: string[],
): Promise<void> {
  const { db } = ctx;
  const targetFormations = formationIds.slice(0, 3);
  if (targetFormations.length === 0) return;

  let markIndex = 0;

  for (const formationId of targetFormations) {
    const [ft] = await db
      .select({ teacherId: formationTeachers.teacherId })
      .from(formationTeachers)
      .where(eq(formationTeachers.formationId, formationId))
      .limit(1);

    const teacherId = ft?.teacherId;
    if (!teacherId) continue;

    const sessions = await db
      .select({
        id: formationSessions.id,
        startAt: formationSessions.startAt,
      })
      .from(formationSessions)
      .where(
        and(
          eq(formationSessions.formationId, formationId),
          eq(formationSessions.status, 'SCHEDULED'),
        ),
      )
      .orderBy(asc(formationSessions.startAt))
      .limit(2);

    if (sessions.length === 0) continue;

    const enrRows = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.formationId, formationId),
          eq(enrollments.status, 'ENROLLED'),
        ),
      )
      .orderBy(asc(enrollments.enrolledAt));

    const markedAt = new Date();

    for (const session of sessions) {
      let learnerIdx = 0;
      for (const enr of enrRows) {
        // Create varied profiles:
        // Learner 0-2: Always PRESENT (Top Learners)
        // Learner 3-4: Always ABSENT
        // Others: Cycle statuses
        let status: (typeof DEMO_STATUSES)[number];
        if (learnerIdx <= 2) {
          status = 'PRESENT';
        } else if (learnerIdx <= 4) {
          status = 'ABSENT';
        } else {
          status = DEMO_STATUSES[markIndex % DEMO_STATUSES.length];
        }

        markIndex += 1;
        learnerIdx += 1;

        const existing = await db
          .select({ id: sessionAttendance.id })
          .from(sessionAttendance)
          .where(
            and(
              eq(sessionAttendance.sessionId, session.id),
              eq(sessionAttendance.enrollmentId, enr.id),
            ),
          )
          .limit(1);

        if (existing[0]) continue;

        await db.insert(sessionAttendance).values({
          sessionId: session.id,
          enrollmentId: enr.id,
          status,
          markedAt,
          markedByTeacherId: teacherId,
        });
        ctx.counters.sessionAttendanceInserted += 1;
      }
    }
  }
}
