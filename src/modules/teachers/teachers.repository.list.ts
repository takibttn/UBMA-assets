import { asc, count, desc, ilike, or } from 'drizzle-orm';
import { teachers } from '@/database/schema';
import { TeachersBaseRepository } from './teachers.repository.base';
import { FindTeachersQueryDto } from './dto/find-teachers-query.dto';

export abstract class TeachersListRepository extends TeachersBaseRepository {
  async findTeachersPaginated(query: FindTeachersQueryDto) {
    const whereClause = query.search
      ? or(
          ilike(teachers.firstName, `%${query.search}%`),
          ilike(teachers.lastName, `%${query.search}%`),
          ilike(teachers.email, `%${query.search}%`),
        )
      : undefined;

    const sortColumns = {
      createdAt: teachers.createdAt,
      firstName: teachers.firstName,
      lastName: teachers.lastName,
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
        id: teachers.id,
        firstName: teachers.firstName,
        lastName: teachers.lastName,
        email: teachers.email,
        createdAt: teachers.createdAt,
      })
      .from(teachers)
      .where(whereClause)
      .orderBy(order);

    const countQuery = this.db
      .select({ total: count() })
      .from(teachers)
      .where(whereClause);

    return this.paginate({
      query: dataQuery,
      countQuery,
      page: query.page,
      limit: query.limit,
    });
  }
}
