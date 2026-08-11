import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import {
  enrollments,
  formationLevels,
  formationSessions,
  formationTeachers,
  formations,
  languages,
  rooms,
} from '@/database/schema';
import { TeachersSessionsRepository } from './teachers.repository.sessions';
import { FindTeacherCalendarQueryDto } from './dto/find-teacher-calendar-query.dto';
import { parseTeacherCalendarBoundary } from './utils/teacher-calendar-query.util';

export abstract class TeachersCalendarRepository extends TeachersSessionsRepository {
  async findTeacherCalendarEvents(
    teacherId: string,
    query: FindTeacherCalendarQueryDto,
  ) {
    const parts: SQL[] = [eq(formationTeachers.teacherId, teacherId)];

    const searchRaw = query.search?.trim();
    if (searchRaw) {
      const term = `%${searchRaw}%`;
      parts.push(
        or(
          ilike(formationSessions.title, term),
          ilike(formations.title, term),
          ilike(languages.name, term),
          ilike(languages.code, term),
          ilike(formationLevels.code, term),
          ilike(formationLevels.name, term),
          ilike(rooms.code, term),
          ilike(rooms.name, term),
        )!,
      );
    }

    const hasFrom = query.from?.trim();
    const hasTo = query.to?.trim();
    if (hasFrom || hasTo) {
      const fromTs = hasFrom
        ? parseTeacherCalendarBoundary(hasFrom, false)
        : null;
      const toTs = hasTo ? parseTeacherCalendarBoundary(hasTo, true) : null;
      let overlap: SQL;
      if (fromTs && toTs) {
        overlap = sql`${formationSessions.startAt} < ${toTs} AND ${formationSessions.endAt} > ${fromTs}`;
      } else if (fromTs) {
        overlap = sql`${formationSessions.endAt} > ${fromTs}`;
      } else {
        overlap = sql`${formationSessions.startAt} < ${toTs!}`;
      }
      parts.push(overlap);
    }

    const whereClause = parts.length === 1 ? parts[0] : and(...parts);

    return this.db
      .select({
        sessionId: formationSessions.id,
        formationId: formations.id,
        title: formationSessions.title,
        startAt: formationSessions.startAt,
        endAt: formationSessions.endAt,
        status: formationSessions.status,
        capacity: formations.capacity,
        room: {
          id: rooms.id,
          code: rooms.code,
          name: rooms.name,
        },
        language: {
          id: languages.id,
          name: languages.name,
          code: languages.code,
        },
        level: {
          id: formationLevels.id,
          code: formationLevels.code,
          name: formationLevels.name,
        },
        enrolledCount: sql<number>`cast(count(${enrollments.id}) as int)`,
      })
      .from(formationSessions)
      .innerJoin(formations, eq(formationSessions.formationId, formations.id))
      .innerJoin(
        formationTeachers,
        eq(formationTeachers.formationId, formations.id),
      )
      .innerJoin(rooms, eq(formationSessions.roomId, rooms.id))
      .leftJoin(languages, eq(formations.languageId, languages.id))
      .leftJoin(formationLevels, eq(formations.levelId, formationLevels.id))
      .leftJoin(
        enrollments,
        and(
          eq(enrollments.formationId, formations.id),
          eq(enrollments.status, 'ENROLLED'),
        ),
      )
      .where(whereClause)
      .groupBy(
        formationSessions.id,
        formationSessions.formationId,
        formationSessions.title,
        formationSessions.startAt,
        formationSessions.endAt,
        formationSessions.status,
        formations.id,
        formations.capacity,
        rooms.id,
        rooms.code,
        rooms.name,
        languages.id,
        languages.name,
        languages.code,
        formationLevels.id,
        formationLevels.code,
        formationLevels.name,
      )
      .orderBy(asc(formationSessions.startAt));
  }
}
