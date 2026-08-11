import { and, eq } from 'drizzle-orm';
import {
  certificates,
  enrollments,
  formationLevels,
  formations,
  formationTeachers,
  languages,
  users,
} from '@/database/schema';
import { enrolledCountSubquery } from './enrollment.query-fragments';
import { EnrollmentsAdminRepository } from './enrollments.admin.repository';

export abstract class EnrollmentsDetailRepository extends EnrollmentsAdminRepository {
  async findEnrollmentDetailForTeacher(
    teacherId: string,
    enrollmentId: string,
  ): Promise<{
    enrollment: {
      id: string;
      studentId: string;
      formationId: string;
      status: 'ENROLLED' | 'CANCELLED' | 'PENDING_PAYMENT';
      enrolledAt: Date;
    };
    student: {
      id: string;
      firstName: string;
      lastName: string;
      email: string | null;
      matricule: string | null;
      accountType: string;
      bacYear: number | null;
      dob: string | null;
    };
    formation: {
      id: string;
      title: string;
      description: string | null;
      price: string | null;
      capacity: number | null;
      isSaleOpen: boolean;
      startDate: Date | null;
      endDate: Date | null;
      createdAt: Date;
      enrolledCount: number;
      language: {
        id: string | null;
        name: string | null;
        code: string | null;
      };
      level: {
        id: string | null;
        code: string | null;
        name: string | null;
      };
    };
    certificate: {
      id: string;
      enrollmentId: string;
      certificateNumber: string;
      verificationCode: string;
      issuedAt: Date;
      pdfUrl: string | null;
    } | null;
  } | null> {
    const row = await this.db
      .select({
        enrollmentId: enrollments.id,
        enrollmentStudentId: enrollments.studentId,
        enrollmentFormationId: enrollments.formationId,
        enrollmentStatus: enrollments.status,
        enrollmentEnrolledAt: enrollments.enrolledAt,
        studentId: users.id,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
        studentEmail: users.email,
        studentMatricule: users.matricule,
        studentAccountType: users.accountType,
        studentBacYear: users.bacYear,
        studentDob: users.dob,
        formationId: formations.id,
        formationTitle: formations.title,
        formationDescription: formations.description,
        formationPrice: formations.price,
        formationCapacity: formations.capacity,
        formationIsSaleOpen: formations.isSaleOpen,
        formationStartDate: formations.startDate,
        formationEndDate: formations.endDate,
        formationCreatedAt: formations.createdAt,
        formationEnrolledCount: enrolledCountSubquery(),
        languageId: languages.id,
        languageName: languages.name,
        languageCode: languages.code,
        levelId: formationLevels.id,
        levelCode: formationLevels.code,
        levelName: formationLevels.name,
        certificateId: certificates.id,
        certificateEnrollmentId: certificates.enrollmentId,
        certificateNumber: certificates.certificateNumber,
        certificateVerificationCode: certificates.verificationCode,
        certificateIssuedAt: certificates.issuedAt,
        certificatePdfUrl: certificates.pdfUrl,
      })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.studentId, users.id))
      .innerJoin(formations, eq(enrollments.formationId, formations.id))
      .innerJoin(
        formationTeachers,
        and(
          eq(formationTeachers.formationId, formations.id),
          eq(formationTeachers.teacherId, teacherId),
        ),
      )
      .leftJoin(languages, eq(formations.languageId, languages.id))
      .leftJoin(formationLevels, eq(formations.levelId, formationLevels.id))
      .leftJoin(certificates, eq(certificates.enrollmentId, enrollments.id))
      .where(
        and(
          eq(enrollments.id, enrollmentId),
          eq(enrollments.status, 'ENROLLED'),
        ),
      )
      .limit(1);

    const r = row[0];
    if (!r) return null;

    const certificate =
      r.certificateId != null &&
      r.certificateEnrollmentId != null &&
      r.certificateNumber != null &&
      r.certificateVerificationCode != null &&
      r.certificateIssuedAt != null
        ? {
            id: r.certificateId,
            enrollmentId: r.certificateEnrollmentId,
            certificateNumber: r.certificateNumber,
            verificationCode: r.certificateVerificationCode,
            issuedAt: r.certificateIssuedAt,
            pdfUrl: r.certificatePdfUrl,
          }
        : null;

    return {
      enrollment: {
        id: r.enrollmentId,
        studentId: r.enrollmentStudentId,
        formationId: r.enrollmentFormationId,
        status: r.enrollmentStatus,
        enrolledAt: r.enrollmentEnrolledAt,
      },
      student: {
        id: r.studentId,
        firstName: r.studentFirstName,
        lastName: r.studentLastName,
        email: r.studentEmail,
        matricule: r.studentMatricule,
        accountType: r.studentAccountType,
        bacYear: r.studentBacYear,
        dob: r.studentDob,
      },
      formation: {
        id: r.formationId,
        title: r.formationTitle,
        description: r.formationDescription,
        price: r.formationPrice,
        capacity: r.formationCapacity,
        isSaleOpen: r.formationIsSaleOpen,
        startDate: r.formationStartDate,
        endDate: r.formationEndDate,
        createdAt: r.formationCreatedAt,
        enrolledCount: Number(r.formationEnrolledCount ?? 0),
        language: {
          id: r.languageId,
          name: r.languageName,
          code: r.languageCode,
        },
        level: {
          id: r.levelId,
          code: r.levelCode,
          name: r.levelName,
        },
      },
      certificate,
    };
  }
}
