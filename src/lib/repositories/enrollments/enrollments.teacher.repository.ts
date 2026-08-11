import { and, count, eq, ilike, or } from 'drizzle-orm';
import {
  enrollments,
  formationLevels,
  formations,
  formationTeachers,
  languages,
  users,
} from '@/database/schema';
import { FindEnrollmentsQueryDto } from '@modules/enrollments/dto/find-enrollments-query.dto';
import {
  enrolledCountSubquery,
  formationCardSelect,
  resolveEnrollmentOrderBy,
  studentIdentitySelect,
} from './enrollment.query-fragments';
import { ENROLLMENT_SORT_COLUMNS } from './enrollment.repository.types';
import { EnrollmentsDetailRepository } from './enrollments.detail.repository';

export abstract class EnrollmentsTeacherRepository extends EnrollmentsDetailRepository {
  async findByFormationPaginated(
    formationId: string,
    query: FindEnrollmentsQueryDto,
  ) {
    const searchRaw = query.search?.trim();
    const searchClause = searchRaw
      ? or(
          ilike(users.firstName, `%${searchRaw}%`),
          ilike(users.lastName, `%${searchRaw}%`),
          ilike(users.email, `%${searchRaw}%`),
          ilike(users.matricule, `%${searchRaw}%`),
        )
      : undefined;

    const whereClause = and(
      eq(enrollments.formationId, formationId),
      query.status ? eq(enrollments.status, query.status) : undefined,
      searchClause,
    );

    const order = resolveEnrollmentOrderBy(
      query.sortBy,
      query.sortOrder,
      ENROLLMENT_SORT_COLUMNS,
    );

    const dataQuery = this.db
      .select({
        id: enrollments.id,
        studentId: enrollments.studentId,
        formationId: enrollments.formationId,
        status: enrollments.status,
        enrolledAt: enrollments.enrolledAt,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- drizzle 0.45 nested select requirement
        student: studentIdentitySelect(),
        formationEnrolledCount: enrolledCountSubquery(),
        formation: formationCardSelect(),
      })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.studentId, users.id))
      .innerJoin(formations, eq(enrollments.formationId, formations.id))
      .leftJoin(languages, eq(formations.languageId, languages.id))
      .leftJoin(formationLevels, eq(formations.levelId, formationLevels.id))
      .where(whereClause)
      .orderBy(order);

    const countQuery = this.db
      .select({ total: count() })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.studentId, users.id))
      .where(whereClause);

    return this.paginate({
      query: dataQuery,
      countQuery,
      page: query.page,
      limit: query.limit,
    });
  }

  async findForTeacherPaginated(
    teacherId: string,
    query: FindEnrollmentsQueryDto,
  ) {
    const whereClause = and(
      eq(formationTeachers.teacherId, teacherId),
      eq(enrollments.status, 'ENROLLED'),
      query.formationId
        ? eq(enrollments.formationId, query.formationId)
        : undefined,
      query.search
        ? or(
            ilike(formations.title, `%${query.search}%`),
            ilike(enrollments.status, `%${query.search}%`),
            ilike(users.firstName, `%${query.search}%`),
            ilike(users.lastName, `%${query.search}%`),
            ilike(users.email, `%${query.search}%`),
            ilike(users.matricule, `%${query.search}%`),
          )
        : undefined,
    );

    const order = resolveEnrollmentOrderBy(
      query.sortBy,
      query.sortOrder,
      ENROLLMENT_SORT_COLUMNS,
    );

    const dataQuery = this.db
      .select({
        id: enrollments.id,
        status: enrollments.status,
        enrolledAt: enrollments.enrolledAt,
        formationEnrolledCount: enrolledCountSubquery(),
        formation: formationCardSelect(),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- drizzle 0.45 nested select requirement
        student: studentIdentitySelect(),
      })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.studentId, users.id))
      .innerJoin(formations, eq(enrollments.formationId, formations.id))
      .innerJoin(
        formationTeachers,
        eq(formationTeachers.formationId, formations.id),
      )
      .leftJoin(languages, eq(formations.languageId, languages.id))
      .leftJoin(formationLevels, eq(formations.levelId, formationLevels.id))
      .where(whereClause)
      .orderBy(order);

    const countQuery = this.db
      .select({ total: count() })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.studentId, users.id))
      .innerJoin(formations, eq(enrollments.formationId, formations.id))
      .innerJoin(
        formationTeachers,
        eq(formationTeachers.formationId, formations.id),
      )
      .where(whereClause);

    return this.paginate({
      query: dataQuery,
      countQuery,
      page: query.page,
      limit: query.limit,
    });
  }
}
