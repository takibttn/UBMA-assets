import { and, eq } from 'drizzle-orm';
import {
  formationSessions,
  formationTeachers,
  formations,
  rooms,
} from '@/database/schema';
import type { AcademicSeedContext } from './context';
import { addDays } from './context';
import { setUtcTime } from './seed.demo-academic-scenarios.part1';

/** Weekly room availability admin helper — fixed Mondays; see docs/room-weekly-availability-implementation.md */
const WEEKLY_ROOM_DEMO_TITLE = 'CEIL Academic Demo — Calendrier salle hebdo';

export async function seedWeeklyRoomDemo(
  ctx: AcademicSeedContext,
  adminId: string,
  languageId: string,
  levelId: string,
  mainTeacherId: string,
): Promise<void> {
  const { db } = ctx;
  const weeklyDemoStart = new Date('2026-05-04T08:00:00.000Z');
  const weeklyDemoEnd = addDays(weeklyDemoStart, 42);
  let weeklyDemoFormationId: string;
  const existingWeeklyForm = await db
    .select({ id: formations.id })
    .from(formations)
    .where(eq(formations.title, WEEKLY_ROOM_DEMO_TITLE))
    .limit(1);
  if (existingWeeklyForm[0]) {
    weeklyDemoFormationId = existingWeeklyForm[0].id;
  } else {
    const [ins] = await db
      .insert(formations)
      .values({
        title: WEEKLY_ROOM_DEMO_TITLE,
        description:
          'Démo · mai–juin 2026 · tester disponibilité salle par créneau hebdomadaire (voir docs/room-weekly-availability-implementation.md)',
        languageId,
        levelId,
        creatorId: adminId,
        price: '0',
        capacity: 20,
        isSaleOpen: true,
        startDate: weeklyDemoStart,
        endDate: weeklyDemoEnd,
      })
      .returning({ id: formations.id });
    weeklyDemoFormationId = ins.id;
    ctx.counters.formationsInserted += 1;
  }

  const weeklyFt = await db
    .select({ id: formationTeachers.id })
    .from(formationTeachers)
    .where(
      and(
        eq(formationTeachers.formationId, weeklyDemoFormationId),
        eq(formationTeachers.teacherId, mainTeacherId),
      ),
    )
    .limit(1);
  if (!weeklyFt[0]) {
    await db.insert(formationTeachers).values({
      formationId: weeklyDemoFormationId,
      teacherId: mainTeacherId,
      assignedById: adminId,
      role: 'MAIN_TEACHER',
    });
    ctx.counters.formationTeachersInserted += 1;
  }

  const [salle01w] = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(eq(rooms.code, 'SALLE-01'))
    .limit(1);
  const [salle02w] = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(eq(rooms.code, 'SALLE-02'))
    .limit(1);

  if (salle01w?.id) {
    const titleSched = `${WEEKLY_ROOM_DEMO_TITLE} - Lundi 10h–12h (occupation)`;
    const hasSched = await db
      .select({ id: formationSessions.id })
      .from(formationSessions)
      .where(eq(formationSessions.title, titleSched))
      .limit(1);
    if (!hasSched[0]) {
      const daySched = addDays(weeklyDemoStart, 7);
      const s0 = setUtcTime(daySched, 10, 0);
      const e0 = setUtcTime(daySched, 12, 0);
      if (s0 >= weeklyDemoStart && e0 <= weeklyDemoEnd) {
        await db.insert(formationSessions).values({
          formationId: weeklyDemoFormationId,
          roomId: salle01w.id,
          title: titleSched,
          description:
            'Démo · rend SALLE-01 OCCUPIÉE pour lundi 10:00–12:00 (UTC) sur la période',
          startAt: s0,
          endAt: e0,
          status: 'SCHEDULED',
          createdById: adminId,
        });
        ctx.counters.formationSessionsInserted += 1;
      }
    }
  }

  if (salle02w?.id) {
    const titleCancelledWeekly = `${WEEKLY_ROOM_DEMO_TITLE} - Lundi 10h–12h ANNULÉE`;
    const hasCw = await db
      .select({ id: formationSessions.id })
      .from(formationSessions)
      .where(eq(formationSessions.title, titleCancelledWeekly))
      .limit(1);
    if (!hasCw[0]) {
      const dayCw = addDays(weeklyDemoStart, 14);
      const sc = setUtcTime(dayCw, 10, 0);
      const ec = setUtcTime(dayCw, 12, 0);
      if (sc >= weeklyDemoStart && ec <= weeklyDemoEnd) {
        await db.insert(formationSessions).values({
          formationId: weeklyDemoFormationId,
          roomId: salle02w.id,
          title: titleCancelledWeekly,
          description: 'Démo · statut CANCELLED — ignorée par disponibilité',
          startAt: sc,
          endAt: ec,
          status: 'CANCELLED',
          createdById: adminId,
        });
        ctx.counters.formationSessionsInserted += 1;
      }
    }
  }
}
