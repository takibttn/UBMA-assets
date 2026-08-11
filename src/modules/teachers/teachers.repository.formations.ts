import { and, asc, count, desc, eq, ilike, sql } from 'drizzle-orm';
import {
  enrollments,
  formationLevels,
  formationTeachers,
  formations,
  languages,
} from '@/database/schema';
import { TeachersStatsRepository } from './teachers.repository.stats';
import { FindTeacherFormationsQueryDto } from './dto/find-teacher-formations-query.dto';

export abstract class TeachersFormationsRepository extends TeachersStatsRepository {
  async findTeacherFormationsPaginated(
    teacherId: string,
    query: FindTeacherFormationsQueryDto,
  ) {
    const filters = [
      eq(formationTeachers.teacherId, teacherId),
      query.search ? ilike(formations.title, `%${query.search}%`) : undefined,
      query.languageId
        ? eq(formations.languageId, query.languageId)
        : undefined,
      query.levelId ? eq(formations.levelId, query.levelId) : undefined,
    ].filter(Boolean);
    const whereClause = and(...filters);

    const sortColumns = {
      createdAt: formations.createdAt,
      title: formations.title,
      startDate: formations.startDate,
    } as const;
    const requestedSortBy = query.sortBy as
      | keyof typeof sortColumns
      | undefined;
    const sortColumn =
      requestedSortBy && requestedSortBy in sortColumns
        ? sortColumns[requestedSortBy]
        : sortColumns.createdAt;
    const order =
      query.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    const dataQuery = this.db
      .select({
        id: formations.id,
        title: formations.title,
        description: formations.description,
        languageId: formations.languageId,
        levelId: formations.levelId,
        price: formations.price,
        capacity: formations.capacity,
        isSaleOpen: formations.isSaleOpen,
        startDate: formations.startDate,
        endDate: formations.endDate,
        createdAt: formations.createdAt,
        enrolledCount: sql<number>`(
          SELECT cast(count(*) as int)
          FROM ${enrollments}
          WHERE ${enrollments.formationId} = ${formations.id}
            AND ${enrollments.status} = 'ENROLLED'
        )`.as('enrolled_count'),
        assignmentRole: formationTeachers.role,
        assignedAt: formationTeachers.assignedAt,
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
      })
      .from(formationTeachers)
      .innerJoin(formations, eq(formationTeachers.formationId, formations.id))
      .leftJoin(languages, eq(formations.languageId, languages.id))
      .leftJoin(formationLevels, eq(formations.levelId, formationLevels.id))
      .where(whereClause)
      .orderBy(order);

    const countQuery = this.db
      .select({ total: count() })
      .from(formationTeachers)
      .innerJoin(formations, eq(formationTeachers.formationId, formations.id))
      .where(whereClause);

    return this.paginate({
      query: dataQuery,
      countQuery,
      page: query.page,
      limit: query.limit,
    });
  }

  async findTeacherFormationById(teacherId: string, formationId: string) {
    const result = await this.db
      .select({
        id: formations.id,
        title: formations.title,
        description: formations.description,
        languageId: formations.languageId,
        levelId: formations.levelId,
        price: formations.price,
        capacity: formations.capacity,
        isSaleOpen: formations.isSaleOpen,
        startDate: formations.startDate,
        endDate: formations.endDate,
        createdAt: formations.createdAt,
        assignmentRole: formationTeachers.role,
        assignedAt: formationTeachers.assignedAt,
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
      })
      .from(formationTeachers)
      .innerJoin(formations, eq(formationTeachers.formationId, formations.id))
      .leftJoin(languages, eq(formations.languageId, languages.id))
      .leftJoin(formationLevels, eq(formations.levelId, formationLevels.id))
      .where(
        and(
          eq(formationTeachers.teacherId, teacherId),
          eq(formationTeachers.formationId, formationId),
        ),
      )
      .limit(1);

    return result[0];
  }

  async isTeacherAssignedToFormation(teacherId: string, formationId: string) {
    const result = await this.db
      .select({ id: formationTeachers.id })
      .from(formationTeachers)
      .where(
        and(
          eq(formationTeachers.teacherId, teacherId),
          eq(formationTeachers.formationId, formationId),
        ),
      )
      .limit(1);

    return Boolean(result[0]);
  }
}
