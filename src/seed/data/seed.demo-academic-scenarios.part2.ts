import { and, eq } from 'drizzle-orm';
import {
  enrollments,
  formationSessions,
  formationTeachers,
  formations,
  rooms,
  users,
} from '@/database/schema';
import type { AcademicSeedContext } from './context';
import { addDays } from './context';
import { setUtcTime } from './seed.demo-academic-scenarios.part1';

const CANCELLED_COHORT_TITLE = 'CEIL Academic Demo — Cohort annulée';

export async function seedCancelledCohort(
  ctx: AcademicSeedContext,
  adminId: string,
  languageId: string,
  levelId: string,
  mainTeacherId: string,
): Promise<void> {
  const { db, hashedPassword } = ctx;
  const cancelStart = new Date('2030-03-01T08:00:00.000Z');
  const cancelEnd = addDays(cancelStart, 35);
  let cancelFormationId: string;
  const existingCancelForm = await db
    .select({ id: formations.id })
    .from(formations)
    .where(eq(formations.title, CANCELLED_COHORT_TITLE))
    .limit(1);
  if (existingCancelForm[0]) {
    cancelFormationId = existingCancelForm[0].id;
  } else {
    const [ins] = await db
      .insert(formations)
      .values({
        title: CANCELLED_COHORT_TITLE,
        description:
          'Démo pédagogique · inscription annulée · présence absente du profil actif apprenant',
        languageId,
        levelId,
        creatorId: adminId,
        price: '800',
        capacity: 18,
        isSaleOpen: true,
        startDate: cancelStart,
        endDate: cancelEnd,
      })
      .returning({ id: formations.id });
    cancelFormationId = ins.id;
    ctx.counters.formationsInserted += 1;
  }

  const cancelFt = await db
    .select({ id: formationTeachers.id })
    .from(formationTeachers)
    .where(
      and(
        eq(formationTeachers.formationId, cancelFormationId),
        eq(formationTeachers.teacherId, mainTeacherId),
      ),
    )
    .limit(1);
  if (!cancelFt[0]) {
    await db.insert(formationTeachers).values({
      formationId: cancelFormationId,
      teacherId: mainTeacherId,
      assignedById: adminId,
      role: 'MAIN_TEACHER',
    });
    ctx.counters.formationTeachersInserted += 1;
  }

  const demoLearnerEmail = 'learner.demo.annule@ceil-academic.seed';
  await db
    .insert(users)
    .values({
      firstName: 'Démo',
      lastName: 'Annulation',
      email: demoLearnerEmail,
      bacYear: null,
      matricule: null,
      dob: '1998-04-20',
      password: hashedPassword,
      role: 'APPRENANT',
      accountType: 'EXTERNAL_LEARNER',
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        password: hashedPassword,
        firstName: 'Démo',
        lastName: 'Annulation',
      },
    });
  ctx.counters.learnersUpserted += 1;

  const [demoLearner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, demoLearnerEmail))
    .limit(1);

  if (demoLearner) {
    const hasEnr = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, demoLearner.id),
          eq(enrollments.formationId, cancelFormationId),
        ),
      )
      .limit(1);
    if (!hasEnr[0]) {
      await db.insert(enrollments).values({
        studentId: demoLearner.id,
        formationId: cancelFormationId,
        status: 'CANCELLED',
      });
      ctx.counters.enrollmentsInserted += 1;
    }
  }

  const cancelSessRows = await db
    .select({ id: formationSessions.id })
    .from(formationSessions)
    .where(eq(formationSessions.formationId, cancelFormationId))
    .limit(1);

  if (!cancelSessRows[0]) {
    const [lab] = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(eq(rooms.code, 'LAB-01'))
      .limit(1);
    const roomId = lab?.id;
    if (roomId) {
      const s1 = setUtcTime(addDays(cancelStart, 2), 9, 0);
      const e1 = setUtcTime(addDays(cancelStart, 2), 11, 0);
      await db.insert(formationSessions).values({
        formationId: cancelFormationId,
        roomId,
        title: `${CANCELLED_COHORT_TITLE} - Séance 1`,
        description: 'Démo séance (cohorte annulée)',
        startAt: s1,
        endAt: e1,
        status: 'SCHEDULED',
        createdById: adminId,
      });
      ctx.counters.formationSessionsInserted += 1;
    }
  }
}
