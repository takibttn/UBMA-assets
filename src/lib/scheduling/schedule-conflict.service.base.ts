import { ConflictException, Inject } from '@nestjs/common';
import { and, eq, gt, inArray, lt, ne } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import {
  formationSessions,
  formationTeachers,
  rooms,
  teachers,
} from '@/database/schema';
import type {
  CheckSessionConflictsInput,
  ScheduleConflictResult,
} from './schedule-conflict.types';

export abstract class ScheduleConflictServiceBase {
  protected readonly db: DrizzleDB;

  constructor(@Inject(DRIZZLE_DB) db: DrizzleDB) {
    this.db = db;
  }

  /**
   * Pass `executor` as the Drizzle transaction client when inside `db.transaction`.
   */
  async checkSessionConflicts(
    input: CheckSessionConflictsInput,
    executor: DrizzleDB = this.db,
  ): Promise<ScheduleConflictResult> {
    const { formationId, roomId, startAt, endAt, excludeSessionId } = input;

    const roomWhere = [
      eq(formationSessions.roomId, roomId),
      ne(formationSessions.status, 'CANCELLED'),
      lt(formationSessions.startAt, endAt),
      gt(formationSessions.endAt, startAt),
      ...(excludeSessionId ? [ne(formationSessions.id, excludeSessionId)] : []),
    ];

    const roomRows = await executor
      .select({
        roomId: rooms.id,
        roomCode: rooms.code,
        sessionId: formationSessions.id,
        sessionTitle: formationSessions.title,
        startAt: formationSessions.startAt,
        endAt: formationSessions.endAt,
      })
      .from(formationSessions)
      .innerJoin(rooms, eq(formationSessions.roomId, rooms.id))
      .where(and(...roomWhere));

    const formationWhere = [
      eq(formationSessions.formationId, formationId),
      ne(formationSessions.status, 'CANCELLED'),
      lt(formationSessions.startAt, endAt),
      gt(formationSessions.endAt, startAt),
      ...(excludeSessionId ? [ne(formationSessions.id, excludeSessionId)] : []),
    ];

    const formationRows = await executor
      .select({
        formationId: formationSessions.formationId,
        sessionId: formationSessions.id,
        sessionTitle: formationSessions.title,
        startAt: formationSessions.startAt,
        endAt: formationSessions.endAt,
      })
      .from(formationSessions)
      .where(and(...formationWhere));

    const teacherIdRows = await executor
      .selectDistinct({ teacherId: formationTeachers.teacherId })
      .from(formationTeachers)
      .where(eq(formationTeachers.formationId, formationId));

    const teacherIds = teacherIdRows.map((r) => r.teacherId);
    let teacherRows: Array<{
      teacherId: string;
      teacherFirst: string;
      teacherLast: string;
      formationId: string;
      sessionId: string;
      sessionTitle: string;
      startAt: Date;
      endAt: Date;
    }> = [];

    if (teacherIds.length > 0) {
      const tw = [
        inArray(formationTeachers.teacherId, teacherIds),
        ne(formationSessions.status, 'CANCELLED'),
        lt(formationSessions.startAt, endAt),
        gt(formationSessions.endAt, startAt),
        ...(excludeSessionId
          ? [ne(formationSessions.id, excludeSessionId)]
          : []),
      ];

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
        .where(and(...tw));
    }

    const roomConflicts = roomRows.map((r) => ({
      roomId: r.roomId,
      roomCode: r.roomCode,
      sessionId: r.sessionId,
      sessionTitle: r.sessionTitle,
      startAt: r.startAt.toISOString(),
      endAt: r.endAt.toISOString(),
    }));

    const formationConflicts = formationRows.map((r) => ({
      formationId: r.formationId,
      sessionId: r.sessionId,
      sessionTitle: r.sessionTitle,
      startAt: r.startAt.toISOString(),
      endAt: r.endAt.toISOString(),
    }));

    const teacherConflicts = teacherRows.map((r) => ({
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

    return {
      hasConflict,
      roomConflicts,
      teacherConflicts,
      formationConflicts,
    };
  }

  assertNoConflicts(result: ScheduleConflictResult): void {
    if (!result.hasConflict) return;
    throw new ConflictException({
      message: 'Schedule conflict detected',
      roomConflicts: result.roomConflicts,
      teacherConflicts: result.teacherConflicts,
      formationConflicts: result.formationConflicts,
    });
  }
}
