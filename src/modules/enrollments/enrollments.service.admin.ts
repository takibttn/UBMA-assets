import { NotFoundException } from '@nestjs/common';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { FindEnrollmentsQueryDto } from './dto/find-enrollments-query.dto';
import { resolveStudentIdentifier } from './utils/student-identifier.util';
import {
  EMPTY_ATTENDANCE,
  type JoinedStudentIdentity,
} from './enrollments.service.base';
import { EnrollmentsLearnerService } from './enrollments.service.learner';

export abstract class EnrollmentsAdminService extends EnrollmentsLearnerService {
  async getAllEnrollments(query: FindEnrollmentsQueryDto) {
    const page = await this.enrollmentsRepository.findAllPaginated(query);
    const ids = page.data.map((r) => r.id);
    const summaries =
      await this.enrollmentsRepository.getAttendanceSummariesByEnrollmentIds(
        ids,
      );
    return {
      ...page,
      data: page.data.map((row) => {
        const {
          formation: f,
          enrolledAt,
          formationEnrolledCount,
          ...rest
        } = row;
        return {
          ...rest,
          enrolledAt: enrolledAt.toISOString(),
          formation: this.mapJoinedFormationCard({
            ...f,
            enrolledCount: formationEnrolledCount,
          }),
          attendanceSummary: summaries.get(row.id) ?? EMPTY_ATTENDANCE,
        };
      }),
    };
  }

  async getFormationEnrollments(
    formationId: string,
    query: FindEnrollmentsQueryDto,
  ) {
    const formation = await this.formationsRepository.findById(formationId);
    if (!formation) {
      throw new NotFoundException('Formation not found');
    }
    const page = await this.enrollmentsRepository.findByFormationPaginated(
      formationId,
      query,
    );
    const ids = page.data.map((r) => r.id);
    const summaries =
      await this.enrollmentsRepository.getAttendanceSummariesByEnrollmentIds(
        ids,
      );
    return {
      ...page,
      data: page.data.map((row) => {
        const {
          formation: f,
          enrolledAt,
          formationEnrolledCount,
          ...rest
        } = row;
        const student = row.student as JoinedStudentIdentity;
        const first = student.firstName?.trim() ?? '';
        const last = student.lastName?.trim() ?? '';
        const studentName =
          [first, last].filter(Boolean).join(' ').trim() || null;
        return {
          id: rest.id,
          studentId: rest.studentId,
          formationId: rest.formationId,
          status: rest.status,
          enrolledAt: enrolledAt.toISOString(),
          studentName,
          student: {
            id: student.id,
            firstName: student.firstName,
            lastName: student.lastName,
            email: student.email,
            matricule: student.matricule,
          },
          formation: this.mapJoinedFormationCard({
            ...f,
            enrolledCount: formationEnrolledCount,
          }),
          attendanceSummary: summaries.get(row.id) ?? EMPTY_ATTENDANCE,
        };
      }),
    };
  }

  async getTeacherEnrollments(user: AuthUser, query: FindEnrollmentsQueryDto) {
    const result = await this.enrollmentsRepository.findForTeacherPaginated(
      user.id,
      query,
    );
    const ids = result.data.map((r) => r.id);
    const summaries =
      await this.enrollmentsRepository.getAttendanceSummariesByEnrollmentIds(
        ids,
      );
    return {
      ...result,
      data: result.data.map((row) => {
        const student = row.student as JoinedStudentIdentity;
        const idFields = resolveStudentIdentifier(
          student.email,
          student.matricule,
        );
        return {
          id: row.id,
          status: row.status,
          enrolledAt: row.enrolledAt.toISOString(),
          formation: this.mapJoinedFormationCard({
            ...row.formation,
            enrolledCount: row.formationEnrolledCount,
          }),
          student: {
            id: student.id,
            firstName: student.firstName,
            lastName: student.lastName,
            email: student.email,
            matricule: student.matricule,
            identifierKind: idFields.identifierKind,
            identifier: idFields.identifier,
          },
          attendanceSummary: summaries.get(row.id) ?? EMPTY_ATTENDANCE,
        };
      }),
    };
  }

  async getTeacherEnrollmentById(user: AuthUser, enrollmentId: string) {
    const row = await this.enrollmentsRepository.findEnrollmentDetailForTeacher(
      user.id,
      enrollmentId,
    );
    if (!row) {
      throw new NotFoundException('Enrollment not found or inaccessible');
    }
    const sums =
      await this.enrollmentsRepository.getAttendanceSummariesByEnrollmentIds([
        row.enrollment.id,
      ]);
    const idFields = resolveStudentIdentifier(
      row.student.email,
      row.student.matricule,
    );
    return {
      enrollment: {
        ...row.enrollment,
        enrolledAt: row.enrollment.enrolledAt.toISOString(),
      },
      student: {
        ...row.student,
        identifierKind: idFields.identifierKind,
        identifier: idFields.identifier,
      },
      formation: this.mapJoinedFormationCard({
        ...row.formation,
      }),
      certificate: row.certificate,
      attendanceSummary: sums.get(row.enrollment.id) ?? EMPTY_ATTENDANCE,
    };
  }
}
