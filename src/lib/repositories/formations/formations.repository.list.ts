import { and, asc, count, desc, eq, ilike, sql } from 'drizzle-orm';
import {
  Formation,
  enrollments,
  formationLevels,
  formations,
  languages,
} from '@/database/schema';
import { FindFormationsQueryDto } from '@modules/formations/dto/find-formations-query.dto';
import { FormationsBaseRepository } from './formations.repository.base';

export abstract class FormationsListRepository extends FormationsBaseRepository {
  async findAllPaginated(query: FindFormationsQueryDto) {
    const saleFilter =
      query.saleStatus === 'OPEN'
        ? eq(formations.isSaleOpen, true)
        : query.saleStatus === 'CLOSED'
          ? eq(formations.isSaleOpen, false)
          : undefined;

    const conditions = [
      query.search ? ilike(formations.title, `%${query.search}%`) : undefined,
      query.languageId
        ? eq(formations.languageId, query.languageId)
        : undefined,
      query.levelId ? eq(formations.levelId, query.levelId) : undefined,
      saleFilter,
    ].filter(Boolean);

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const sortColumns = {
      createdAt: formations.createdAt,
      title: formations.title,
      startDate: formations.startDate,
      price: formations.price,
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

    const {
      teacherIdSub,
      teacherFirstNameSub,
      teacherLastNameSub,
      teacherEmailSub,
    } = this.teacherSubqueries;

    const dataQuery = this.db
      .select({
        id: formations.id,
        title: formations.title,
        description: formations.description,
        creatorId: formations.creatorId,
        languageId: formations.languageId,
        levelId: formations.levelId,
        price: formations.price,
        capacity: formations.capacity,
        isSaleOpen: formations.isSaleOpen,
        startDate: formations.startDate,
        endDate: formations.endDate,
        createdAt: formations.createdAt,
        // Correlated subquery — keeps row count stable (no GROUP BY needed)
        enrolledCount: sql<number>`(
          SELECT cast(count(*) as int)
          FROM ${enrollments}
          WHERE ${enrollments.formationId} = ${formations.id}
            AND ${enrollments.status} = 'ENROLLED'
        )`.as('enrolled_count'),
        reservedCount: sql<number>`(
          SELECT cast(count(*) as int)
          FROM ${enrollments}
          WHERE ${enrollments.formationId} = ${formations.id}
            AND ${enrollments.status} IN ('ENROLLED', 'PENDING_PAYMENT')
        )`.as('reserved_count'),
        assignedTeacherId: teacherIdSub,
        assignedTeacherFirstName: teacherFirstNameSub,
        assignedTeacherLastName: teacherLastNameSub,
        assignedTeacherEmail: teacherEmailSub,
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
      .from(formations)
      .leftJoin(languages, eq(formations.languageId, languages.id))
      .leftJoin(formationLevels, eq(formations.levelId, formationLevels.id))
      .where(whereClause)
      .orderBy(order);

    const countQuery = this.db
      .select({ total: count() })
      .from(formations)
      .where(whereClause);

    return this.paginate({
      query: dataQuery,
      countQuery,
      page: query.page,
      limit: query.limit,
    });
  }

  async findById(id: string): Promise<Formation | undefined> {
    const result = await this.db
      .select()
      .from(formations)
      .where(eq(formations.id, id))
      .limit(1);
    return result[0];
  }
}
