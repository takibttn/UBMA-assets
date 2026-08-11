import { and, count, desc, eq } from 'drizzle-orm';
import {
  certificates,
  enrollments,
  formations,
  formationTeachers,
  users,
} from '@/database/schema';
import { TeachersFormationsRepository } from './teachers.repository.formations';

export abstract class TeachersRecordsRepository extends TeachersFormationsRepository {
  async findTeacherFormationEnrollmentsPaginated(
    teacherId: string,
    formationId: string,
    page: number,
    limit: number,
  ) {
    const whereClause = and(
      eq(formationTeachers.teacherId, teacherId),
      eq(enrollments.formationId, formationId),
      eq(enrollments.status, 'ENROLLED'),
    );

    const dataQuery = this.db
      .select({
        id: enrollments.id,
        studentId: enrollments.studentId,
        status: enrollments.status,
        enrolledAt: enrollments.enrolledAt,
        student: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          matricule: users.matricule,
        },
      })
      .from(enrollments)
      .innerJoin(formations, eq(enrollments.formationId, formations.id))
      .innerJoin(
        formationTeachers,
        eq(formationTeachers.formationId, formations.id),
      )
      .innerJoin(users, eq(enrollments.studentId, users.id))
      .where(whereClause)
      .orderBy(desc(enrollments.enrolledAt));

    const countQuery = this.db
      .select({ total: count() })
      .from(enrollments)
      .innerJoin(formations, eq(enrollments.formationId, formations.id))
      .innerJoin(
        formationTeachers,
        eq(formationTeachers.formationId, formations.id),
      )
      .where(whereClause);

    return this.paginate({ query: dataQuery, countQuery, page, limit });
  }

  async findTeacherFormationCertificatesPaginated(
    teacherId: string,
    formationId: string,
    page: number,
    limit: number,
  ) {
    const whereClause = and(
      eq(formationTeachers.teacherId, teacherId),
      eq(enrollments.formationId, formationId),
    );

    const dataQuery = this.db
      .select({
        id: certificates.id,
        enrollmentId: certificates.enrollmentId,
        certificateNumber: certificates.certificateNumber,
        verificationCode: certificates.verificationCode,
        issuedAt: certificates.issuedAt,
        pdfUrl: certificates.pdfUrl,
      })
      .from(certificates)
      .innerJoin(enrollments, eq(certificates.enrollmentId, enrollments.id))
      .innerJoin(formations, eq(enrollments.formationId, formations.id))
      .innerJoin(
        formationTeachers,
        eq(formationTeachers.formationId, formations.id),
      )
      .where(whereClause)
      .orderBy(desc(certificates.issuedAt));

    const countQuery = this.db
      .select({ total: count() })
      .from(certificates)
      .innerJoin(enrollments, eq(certificates.enrollmentId, enrollments.id))
      .innerJoin(formations, eq(enrollments.formationId, formations.id))
      .innerJoin(
        formationTeachers,
        eq(formationTeachers.formationId, formations.id),
      )
      .where(whereClause);

    return this.paginate({ query: dataQuery, countQuery, page, limit });
  }
}
