import { AuthUser } from '@modules/auth/types/auth-user.type';
import type { EnrollmentAttendanceSummary } from '@lib/repositories/enrollments/enrollments.repository';
import type { LearnerProfileEnrollmentCardRow } from '@lib/repositories/enrollments/enrollments.repository';
import { FindLearnerProfileEnrollmentsQueryDto } from './dto/find-learner-profile-enrollments-query.dto';
import {
  compareForNextFormationHighlight,
  resolveLearnerEnrollmentProgressState,
  resolveLearnerProfileBucket,
} from './domain/learner-enrollment-progress';
import { mapFormationBaseDto } from '@lib/formations/formation-base.mapper';
import { EMPTY_ATTENDANCE } from './enrollments.service.base';
import { EnrollmentsMyEnrollmentsService } from './enrollments.service.my-enrollments';

const MAX_IN_PROGRESS_ROWS_FOR_HIGHLIGHT = 250;

export abstract class EnrollmentsLearnerService extends EnrollmentsMyEnrollmentsService {
  async getLearnerProfileOverview(user: AuthUser) {
    const now = new Date();
    const studentId = user.id;
    const [
      totalEnrollmentsCount,
      inProgressEnrollmentsCount,
      completedEnrollmentsCount,
      certificatesCount,
      highlightCandidates,
    ] = await Promise.all([
      this.enrollmentsRepository.countEnrolledLearnerEnrollments(studentId),
      this.enrollmentsRepository.countEnrolledLearnerEnrollmentsByProfileBucket(
        studentId,
        'IN_PROGRESS',
        now,
      ),
      this.enrollmentsRepository.countEnrolledLearnerEnrollmentsByProfileBucket(
        studentId,
        'COMPLETED',
        now,
      ),
      this.certificatesRepository.countByStudentId(studentId),
      this.enrollmentsRepository.findLearnerInProgressEnrollmentCardRows(
        studentId,
        now,
        MAX_IN_PROGRESS_ROWS_FOR_HIGHLIGHT,
      ),
    ]);

    let nextFormation:
      | (ReturnType<
          EnrollmentsLearnerService['mapRowToLearnerEnrollmentCard']
        > & {
          attendanceSummary: EnrollmentAttendanceSummary;
        })
      | null = null;
    if (highlightCandidates.length > 0) {
      const sorted = [...highlightCandidates].sort((a, b) =>
        compareForNextFormationHighlight(
          {
            startDate: a.startDate,
            endDate: a.endDate,
            enrolledAt: a.enrolledAt,
          },
          {
            startDate: b.startDate,
            endDate: b.endDate,
            enrolledAt: b.enrolledAt,
          },
          now,
        ),
      );
      const first = sorted[0];
      const sums =
        await this.enrollmentsRepository.getAttendanceSummariesByEnrollmentIds([
          first.enrollmentId,
        ]);
      nextFormation = {
        ...this.mapRowToLearnerEnrollmentCard(first, now),
        attendanceSummary: sums.get(first.enrollmentId) ?? EMPTY_ATTENDANCE,
      };
    }

    return {
      summary: {
        totalEnrollmentsCount,
        inProgressEnrollmentsCount,
        completedEnrollmentsCount,
        certificatesCount,
      },
      nextFormation,
    };
  }

  async getMyProfileEnrollments(
    user: AuthUser,
    query: FindLearnerProfileEnrollmentsQueryDto,
  ) {
    const now = new Date();
    const page =
      await this.enrollmentsRepository.findLearnerProfileEnrollmentsPaginated(
        user.id,
        query,
        now,
      );
    const ids = page.data.map((row) => row.enrollmentId);
    const summaries =
      await this.enrollmentsRepository.getAttendanceSummariesByEnrollmentIds(
        ids,
      );

    return {
      ...page,
      data: page.data.map((row) => ({
        ...this.mapRowToLearnerEnrollmentCard(row, now),
        attendanceSummary: summaries.get(row.enrollmentId) ?? EMPTY_ATTENDANCE,
      })),
    };
  }

  protected mapRowToLearnerEnrollmentCard(
    row: LearnerProfileEnrollmentCardRow,
    now: Date,
  ) {
    const progressState = resolveLearnerEnrollmentProgressState(
      { startDate: row.startDate, endDate: row.endDate },
      now,
    );
    const profileBucket = resolveLearnerProfileBucket(progressState);
    return {
      enrollmentId: row.enrollmentId,
      enrollmentStatus: row.enrollmentStatus,
      enrolledAt: row.enrolledAt.toISOString(),
      progressState,
      profileBucket,
      formation: mapFormationBaseDto(
        {
          id: row.formationId,
          title: row.title,
          description: row.description,
          price: row.price,
          capacity: row.capacity,
          isSaleOpen: row.isSaleOpen,
          startDate: row.startDate,
          endDate: row.endDate,
          enrolledCount: row.enrolledCount,
          language: row.language,
          level: row.level,
        },
        {},
      ),
    };
  }
}
