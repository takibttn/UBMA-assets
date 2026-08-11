import { and, count, desc, eq, ilike } from 'drizzle-orm';
import {
  certificates,
  enrollments,
  formationLevels,
  formations,
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
import { EnrollmentsBaseRepository } from './enrollments.repository.base';

export abstract class EnrollmentsAdminRepository extends EnrollmentsBaseRepository {
  async findAllPaginated(query: FindEnrollmentsQueryDto) {
    const filters = [
      query.status ? eq(enrollments.status, query.status) : undefined,
      query.formationId
        ? eq(enrollments.formationId, query.formationId)
        : undefined,
      query.search ? ilike(enrollments.status, `%${query.search}%`) : undefined,
    ].filter(Boolean);

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

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
        student: studentIdentitySelect(true),
        formationEnrolledCount: enrolledCountSubquery(),
        formation: formationCardSelect(),
        certificate: {
          id: certificates.id,
          certificateNumber: certificates.certificateNumber,
          verificationCode: certificates.verificationCode,
          issuedAt: certificates.issuedAt,
          pdfUrl: certificates.pdfUrl,
        },
      })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.studentId, users.id))
      .innerJoin(formations, eq(enrollments.formationId, formations.id))
      .leftJoin(languages, eq(formations.languageId, languages.id))
      .leftJoin(formationLevels, eq(formations.levelId, formationLevels.id))
      .leftJoin(certificates, eq(enrollments.id, certificates.enrollmentId))
      .where(whereClause)
      .orderBy(order);

    const countQuery = this.db
      .select({ total: count() })
      .from(enrollments)
      .where(whereClause);

    return this.paginate({
      query: dataQuery,
      countQuery,
      page: query.page,
      limit: query.limit,
    });
  }

  async findByStudentPaginated(
    studentId: string,
    query: FindEnrollmentsQueryDto,
  ) {
    const whereClause = and(
      eq(enrollments.studentId, studentId),
      query.status ? eq(enrollments.status, query.status) : undefined,
    );

    const dataQuery = this.db
      .select({
        id: enrollments.id,
        studentId: enrollments.studentId,
        formationId: enrollments.formationId,
        status: enrollments.status,
        enrolledAt: enrollments.enrolledAt,
        formationEnrolledCount: enrolledCountSubquery(),
        formation: formationCardSelect(),
      })
      .from(enrollments)
      .innerJoin(formations, eq(enrollments.formationId, formations.id))
      .leftJoin(languages, eq(formations.languageId, languages.id))
      .leftJoin(formationLevels, eq(formations.levelId, formationLevels.id))
      .where(whereClause)
      .orderBy(desc(enrollments.enrolledAt));

    const countQuery = this.db
      .select({ total: count() })
      .from(enrollments)
      .where(whereClause);

    return this.paginate({
      query: dataQuery,
      countQuery,
      page: query.page,
      limit: query.limit,
    });
  }

  async updateEnrollment(
    enrollmentId: string,
    data: Partial<{
      status: (typeof enrollments.$inferSelect)['status'];
      enrolledAt: Date;
    }>,
  ): Promise<void> {
    await this.db
      .update(enrollments)
      .set(data)
      .where(eq(enrollments.id, enrollmentId));
  }
}
