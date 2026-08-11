import { and, asc, count, desc, eq, ilike } from 'drizzle-orm';
import {
  certificates,
  enrollments,
  formationTeachers,
  formations,
  teachers,
  users,
} from '@/database/schema';
import { FindMyCertificatesQueryDto } from '@modules/certificates/dto/find-my-certificates-query.dto';
import { CertificatesBaseRepository } from './certificates.repository.base';

export abstract class CertificatesVerifyRepository extends CertificatesBaseRepository {
  async findByVerificationCode(verificationCode: string) {
    const result = await this.db
      .select({
        certificateNumber: certificates.certificateNumber,
        verificationCode: certificates.verificationCode,
        issuedAt: certificates.issuedAt,
        pdfUrl: certificates.pdfUrl,
        student: {
          firstName: users.firstName,
          lastName: users.lastName,
          matricule: users.matricule,
        },
        formation: {
          title: formations.title,
          id: formations.id,
        },
      })
      .from(certificates)
      .innerJoin(enrollments, eq(certificates.enrollmentId, enrollments.id))
      .innerJoin(users, eq(enrollments.studentId, users.id))
      .innerJoin(formations, eq(enrollments.formationId, formations.id))
      .where(eq(certificates.verificationCode, verificationCode))
      .limit(1);
    return result[0] ?? null;
  }

  async findByFormationPaginated(
    formationId: string,
    query: FindMyCertificatesQueryDto,
  ) {
    const whereClause = query.search
      ? and(
          eq(enrollments.formationId, formationId),
          ilike(certificates.certificateNumber, `%${query.search}%`),
        )
      : eq(enrollments.formationId, formationId);

    const sortColumns = {
      issuedAt: certificates.issuedAt,
      certificateNumber: certificates.certificateNumber,
    } as const;
    const requestedSortBy = query.sortBy as
      | keyof typeof sortColumns
      | undefined;
    const sortColumn =
      requestedSortBy && requestedSortBy in sortColumns
        ? sortColumns[requestedSortBy]
        : sortColumns.issuedAt;
    const order =
      query.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    const dataQuery = this.db
      .select({
        id: certificates.id,
        certificateNumber: certificates.certificateNumber,
        verificationCode: certificates.verificationCode,
        issuedAt: certificates.issuedAt,
        pdfUrl: certificates.pdfUrl,
        enrollmentId: enrollments.id,
        student: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          matricule: users.matricule,
        },
      })
      .from(certificates)
      .innerJoin(enrollments, eq(certificates.enrollmentId, enrollments.id))
      .innerJoin(users, eq(enrollments.studentId, users.id))
      .where(whereClause)
      .orderBy(order);

    const countQuery = this.db
      .select({ total: count() })
      .from(certificates)
      .innerJoin(enrollments, eq(certificates.enrollmentId, enrollments.id))
      .where(whereClause);

    return this.paginate({
      query: dataQuery,
      countQuery,
      page: query.page,
      limit: query.limit,
    });
  }

  async findTeacherByFormationId(formationId: string) {
    const result = await this.db
      .select({
        id: teachers.id,
        firstName: teachers.firstName,
        lastName: teachers.lastName,
      })
      .from(formationTeachers)
      .innerJoin(teachers, eq(formationTeachers.teacherId, teachers.id))
      .where(eq(formationTeachers.formationId, formationId))
      .orderBy(asc(formationTeachers.assignedAt))
      .limit(1);

    return result[0] ?? null;
  }

  async findByStudentPaginated(
    studentId: string,
    query: FindMyCertificatesQueryDto,
  ) {
    const whereClause = query.search
      ? and(
          eq(enrollments.studentId, studentId),
          ilike(formations.title, `%${query.search}%`),
        )
      : eq(enrollments.studentId, studentId);

    const sortColumns = {
      issuedAt: certificates.issuedAt,
      certificateNumber: certificates.certificateNumber,
    } as const;
    const requestedSortBy = query.sortBy as
      | keyof typeof sortColumns
      | undefined;
    const sortColumn =
      requestedSortBy && requestedSortBy in sortColumns
        ? sortColumns[requestedSortBy]
        : sortColumns.issuedAt;
    const order =
      query.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    const dataQuery = this.db
      .select({
        id: certificates.id,
        certificateNumber: certificates.certificateNumber,
        verificationCode: certificates.verificationCode,
        issuedAt: certificates.issuedAt,
        pdfUrl: certificates.pdfUrl,
        formation: {
          id: formations.id,
          title: formations.title,
          startDate: formations.startDate,
          endDate: formations.endDate,
        },
      })
      .from(certificates)
      .innerJoin(enrollments, eq(certificates.enrollmentId, enrollments.id))
      .innerJoin(formations, eq(enrollments.formationId, formations.id))
      .where(whereClause)
      .orderBy(order);

    const countQuery = this.db
      .select({ total: count() })
      .from(certificates)
      .innerJoin(enrollments, eq(certificates.enrollmentId, enrollments.id))
      .innerJoin(formations, eq(enrollments.formationId, formations.id))
      .where(whereClause);

    return this.paginate({
      query: dataQuery,
      countQuery,
      page: query.page,
      limit: query.limit,
    });
  }
}
