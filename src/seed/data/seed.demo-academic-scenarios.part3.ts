import { and, asc, eq } from 'drizzle-orm';
import {
  formationSessions,
  formationTeachers,
  formations,
  rooms,
  users,
} from '@/database/schema';
import type { AcademicSeedContext } from './context';
import { addDays } from './context';
import { setUtcTime } from './seed.demo-academic-scenarios.part1';

const INTERNAL_BAC_YEAR = 2023;
const INTERNAL_MATRICULE = 'INT-CEIL-2023-001';

const DEMO_SESSION_CANCELLED_TITLE_SUFFIX = ' - Séance ANNULEE démo';
const DEMO_SESSION_COMPLETED_TITLE_SUFFIX = ' - Séance TERMINEE démo';

export async function seedInternalStudent(
  ctx: AcademicSeedContext,
): Promise<void> {
  const { db, hashedPassword } = ctx;
  const internalRows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.bacYear, INTERNAL_BAC_YEAR),
        eq(users.matricule, INTERNAL_MATRICULE),
      ),
    )
    .limit(1);
  if (!internalRows[0]) {
    await db.insert(users).values({
      firstName: 'Yacine',
      lastName: 'Bencherif',
      email: null,
      bacYear: INTERNAL_BAC_YEAR,
      matricule: INTERNAL_MATRICULE,
      dob: '2003-11-01',
      password: hashedPassword,
      role: 'APPRENANT',
      accountType: 'INTERNAL_STUDENT',
    });
    ctx.counters.learnersUpserted += 1;
  } else {
    await db
      .update(users)
      .set({
        password: hashedPassword,
        firstName: 'Yacine',
        lastName: 'Bencherif',
        role: 'APPRENANT',
        accountType: 'INTERNAL_STUDENT',
      })
      .where(eq(users.id, internalRows[0].id));
    ctx.counters.learnersUpserted += 1;
  }
}

export async function seedAssistantTeacher(
  ctx: AcademicSeedContext,
  adminId: string,
  assistantTeacherId: string,
  formation01Id: string | undefined,
): Promise<void> {
  const { db } = ctx;
  if (formation01Id) {
    const asstFt = await db
      .select({ id: formationTeachers.id })
      .from(formationTeachers)
      .where(
        and(
          eq(formationTeachers.formationId, formation01Id),
          eq(formationTeachers.teacherId, assistantTeacherId),
        ),
      )
      .limit(1);
    if (!asstFt[0]) {
      await db.insert(formationTeachers).values({
        formationId: formation01Id,
        teacherId: assistantTeacherId,
        assignedById: adminId,
        role: 'ASSISTANT',
      });
      ctx.counters.formationTeachersInserted += 1;
    }
  }
}

export async function seedFormation01ExtraSessions(
  ctx: AcademicSeedContext,
  adminId: string,
  formation01Id: string | undefined,
): Promise<void> {
  const { db } = ctx;
  if (formation01Id) {
    const [f01] = await db
      .select({
        id: formations.id,
        title: formations.title,
        startDate: formations.startDate,
        endDate: formations.endDate,
      })
      .from(formations)
      .where(eq(formations.id, formation01Id))
      .limit(1);
    if (f01?.startDate && f01.endDate) {
      const eligibleRooms = await db
        .select({ id: rooms.id })
        .from(rooms)
        .where(eq(rooms.isActive, true))
        .orderBy(asc(rooms.code))
        .limit(3);
      const roomId = eligibleRooms[0]?.id;
      if (roomId) {
        const titleCancelled = `${f01.title}${DEMO_SESSION_CANCELLED_TITLE_SUFFIX}`;
        const titleCompleted = `${f01.title}${DEMO_SESSION_COMPLETED_TITLE_SUFFIX}`;

        const existsCancelled = await db
          .select({ id: formationSessions.id })
          .from(formationSessions)
          .where(eq(formationSessions.title, titleCancelled))
          .limit(1);
        if (!existsCancelled[0]) {
          const dayC = addDays(f01.startDate, 12);
          let startC = setUtcTime(dayC, 10, 0);
          let endC = setUtcTime(dayC, 11, 30);
          if (startC < f01.startDate || endC > f01.endDate) {
            startC = setUtcTime(addDays(f01.startDate, 5), 16, 0);
            endC = setUtcTime(addDays(f01.startDate, 5), 17, 30);
          }
          if (startC < endC && startC >= f01.startDate && endC <= f01.endDate) {
            await db.insert(formationSessions).values({
              formationId: formation01Id,
              roomId,
              title: titleCancelled,
              description: 'Démo · séance annulée (hors conflits actifs)',
              startAt: startC,
              endAt: endC,
              status: 'CANCELLED',
              createdById: adminId,
            });
            ctx.counters.formationSessionsInserted += 1;
          }
        }

        const existsCompleted = await db
          .select({ id: formationSessions.id })
          .from(formationSessions)
          .where(eq(formationSessions.title, titleCompleted))
          .limit(1);
        if (!existsCompleted[0]) {
          const dayCp = addDays(f01.startDate, 14);
          let startCp = setUtcTime(dayCp, 9, 0);
          let endCp = setUtcTime(dayCp, 10, 30);
          if (startCp < f01.startDate || endCp > f01.endDate) {
            startCp = setUtcTime(addDays(f01.startDate, 8), 14, 0);
            endCp = setUtcTime(addDays(f01.startDate, 8), 15, 30);
          }
          if (
            startCp < endCp &&
            startCp >= f01.startDate &&
            endCp <= f01.endDate
          ) {
            await db.insert(formationSessions).values({
              formationId: formation01Id,
              roomId,
              title: titleCompleted,
              description: 'Démo · séance terminée',
              startAt: startCp,
              endAt: endCp,
              status: 'COMPLETED',
              createdById: adminId,
            });
            ctx.counters.formationSessionsInserted += 1;
          }
        }
      }
    }
  }
}
