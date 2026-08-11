import { and, eq, gt, inArray, lt, ne } from 'drizzle-orm';
import type { DrizzleDB } from '@/database/database.module';
import {
  formationSessions,
  formationTeachers,
  rooms,
  teachers,
} from '@/database/schema';
import type {
  ScheduleConflictResult,
  SessionGenerationProbe,
} from './schedule-conflict.types';
import { ScheduleConflictServiceBase } from './schedule-conflict.service.base';

export abstract class ScheduleConflictProbesService extends ScheduleConflictServiceBase {
  /**
   * For many proposed sessions at once: loads overlapping DB sessions in the overall window,
   * then classifies conflicts per probe (same rules as `checkSessionConflicts`).
   */
  async checkGenerationProbesAgainstDb(
    formationId: string,
    probes: SessionGenerationProbe[],
    executor: DrizzleDB = this.db,
  ): Promise<Map<string, ScheduleConflictResult>> {
    const emptyResult = (): ScheduleConflictResult => ({
      hasConflict: false,
      roomConflicts: [],
      teacherConflicts: [],
      formationConflicts: [],
    });

    const byTempId = new Map<string, ScheduleConflictResult>();
    if (probes.length === 0) return byTempId;

    for (const p of probes) {
      byTempId.set(p.tempId, emptyResult());
    }

    const windowStart = new Date(
      Math.min(...probes.map((p) => p.startAt.getTime())),
    );
    const windowEnd = new Date(
      Math.max(...probes.map((p) => p.endAt.getTime())),
    );
    const roomIds = [...new Set(probes.map((p) => p.roomId))];

    const teacherIdRows = await executor
      .selectDistinct({ teacherId: formationTeachers.teacherId })
      .from(formationTeachers)
      .where(eq(formationTeachers.formationId, formationId));
    const teacherIds = teacherIdRows.map((r) => r.teacherId);

    const overlapClause = and(
      ne(formationSessions.status, 'CANCELLED'),
      lt(formationSessions.startAt, windowEnd),
      gt(formationSessions.endAt, windowStart),
    );

    const roomRows = await executor
      .select({
        roomId: rooms.id,
        roomCode: rooms.code,
        sessionId: formationSessions.id,
        sessionTitle: formationSessions.title,
        sessionRoomId: formationSessions.roomId,
        startAt: formationSessions.startAt,
        endAt: formationSessions.endAt,
      })
      .from(formationSessions)
      .innerJoin(rooms, eq(formationSessions.roomId, rooms.id))
      .where(and(overlapClause, inArray(formationSessions.roomId, roomIds)));

    const formationRows = await executor
      .select({
        formationId: formationSessions.formationId,
        sessionId: formationSessions.id,
        sessionTitle: formationSessions.title,
        startAt: formationSessions.startAt,
        endAt: formationSessions.endAt,
      })
      .from(formationSessions)
      .where(
        and(overlapClause, eq(formationSessions.formationId, formationId)),
      );

    type TeacherRow = {
      teacherId: string;
      teacherFirst: string;
      teacherLast: string;
      formationId: string;
      sessionId: string;
      sessionTitle: string;
      startAt: Date;
      endAt: Date;
    };
    let teacherRows: TeacherRow[] = [];
    if (teacherIds.length > 0) {
      teacherRows = await executor
        .select({
          teacherId: teachers.id,
          teacherFirst: teachers.firstName,
          teacherLast: teachers.lastName,
          formationId: formationSessions.formationId,
          sessionId: formationSessions.id,
          sessionTitle: formationSessions.title,
          startAt: formationSessions.startAt,
          endAt: formationSessions.endAt,
        })
        .from(formationSessions)
        .innerJoin(
          formationTeachers,
          eq(formationTeachers.formationId, formationSessions.formationId),
        )
        .innerJoin(teachers, eq(teachers.id, formationTeachers.teacherId))
        .where(
          and(overlapClause, inArray(formationTeachers.teacherId, teacherIds)),
        );
    }

    const overlapsProbe = (
      probe: SessionGenerationProbe,
      s: { startAt: Date; endAt: Date },
    ) => probe.startAt < s.endAt && probe.endAt > s.startAt;

    for (const probe of probes) {
      const roomConflicts = roomRows
        .filter(
          (r) => r.sessionRoomId === probe.roomId && overlapsProbe(probe, r),
        )
        .map((r) => ({
          roomId: r.roomId,
          roomCode: r.roomCode,
          sessionId: r.sessionId,
          sessionTitle: r.sessionTitle,
          startAt: r.startAt.toISOString(),
          endAt: r.endAt.toISOString(),
        }));

      const formationConflicts = formationRows
        .filter((r) => overlapsProbe(probe, r))
        .map((r) => ({
          formationId: r.formationId,
          sessionId: r.sessionId,
          sessionTitle: r.sessionTitle,
          startAt: r.startAt.toISOString(),
          endAt: r.endAt.toISOString(),
        }));

      const teacherConflicts = teacherRows
        .filter((r) => overlapsProbe(probe, r))
        .map((r) => ({
          teacherId: r.teacherId,
          teacherName: `${r.teacherFirst} ${r.teacherLast}`,
          formationId: r.formationId,
          sessionId: r.sessionId,
          sessionTitle: r.sessionTitle,
          startAt: r.startAt.toISOString(),
          endAt: r.endAt.toISOString(),
        }));

      const hasConflict =
        roomConflicts.length > 0 ||
        formationConflicts.length > 0 ||
        teacherConflicts.length > 0;

      byTempId.set(probe.tempId, {
        hasConflict,
        roomConflicts,
        teacherConflicts,
        formationConflicts,
      });
    }

    return byTempId;
  }
}
