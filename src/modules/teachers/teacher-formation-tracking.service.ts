import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { buildCertificateReadiness } from '@lib/formation-insights/certificate-readiness.util';
import { FormationFeedbackRepository } from '@lib/repositories/formation-feedback/formation-feedback.repository';
import { FormationTrackingRepository } from '@lib/repositories/formation-tracking/formation-tracking.repository';
import { EnrollmentsRepository } from '@lib/repositories/enrollments/enrollments.repository';
import { TeachersRepository } from './teachers.repository';

@Injectable()
export class TeacherFormationTrackingService {
  constructor(
    private readonly trackingRepository: FormationTrackingRepository,
    private readonly feedbackRepository: FormationFeedbackRepository,
    private readonly enrollmentsRepository: EnrollmentsRepository,
    private readonly teachersRepository: TeachersRepository,
  ) {}

  async getTeacherFormationTracking(
    teacherUserId: string,
    formationId: string,
  ) {
    const ok = await this.teachersRepository.isTeacherAssignedToFormation(
      teacherUserId,
      formationId,
    );
    if (!ok) {
      throw new ForbiddenException('Not assigned to this formation');
    }

    const formation = await this.teachersRepository.findTeacherFormationById(
      teacherUserId,
      formationId,
    );
    if (!formation) {
      throw new NotFoundException('Formation not found for this teacher');
    }

    const enrollStats =
      await this.trackingRepository.getEnrollmentFormationStats(formationId);
    const sessionStats =
      await this.trackingRepository.getSessionStats(formationId);
    const rollup = await this.trackingRepository.getAttendanceRollup(
      formationId,
      enrollStats.activeEnrolled,
    );
    const avgAttendance =
      await this.trackingRepository.computeAverageLearnerAttendanceRate(
        formationId,
      );

    const next = await this.trackingRepository.getNextSession(formationId);

    const feedbackAgg =
      await this.feedbackRepository.getAggregateForFormation(formationId);
    const latestComments =
      await this.feedbackRepository.listLatestCommentsForFormation({
        formationId,
        limit: 10,
      });

    const learners =
      await this.enrollmentsRepository.findFormationEnrollmentsWithStudents(
        formationId,
      );
    const enrollmentIds = learners.map((l) => l.enrollmentId);
    const summaries =
      await this.enrollmentsRepository.getAttendanceSummariesByEnrollmentIds(
        enrollmentIds,
      );
    const certified =
      await this.enrollmentsRepository.findIssuedCertificateEnrollmentIds(
        enrollmentIds,
      );

    const now = new Date();
    const formationEnded = Boolean(
      formation.endDate && formation.endDate < now,
    );

    return {
      formation: {
        id: formation.id,
        title: formation.title,
        startDate: formation.startDate?.toISOString() ?? null,
        endDate: formation.endDate?.toISOString() ?? null,
        capacity: formation.capacity ?? null,
        language: {
          id: formation.language?.id ?? null,
          code: formation.language?.code ?? null,
          name: formation.language?.name ?? null,
        },
        level: {
          id: formation.level?.id ?? null,
          code: formation.level?.code ?? null,
          name: formation.level?.name ?? null,
        },
      },
      sessions: {
        total: sessionStats.total,
        scheduled: sessionStats.scheduled,
        completed: sessionStats.completed,
        cancelled: sessionStats.cancelled,
        completionRate: sessionStats.completionRate,
        nextSession: next
          ? {
              id: next.id,
              startAt: next.startAt.toISOString(),
              endAt: next.endAt.toISOString(),
              roomCode: next.roomCode ?? null,
            }
          : null,
      },
      enrollments: {
        totalEnrolled: enrollStats.totalEnrolled,
        activeEnrolled: enrollStats.activeEnrolled,
        cancelled: enrollStats.cancelled,
        capacity: enrollStats.capacity,
        occupancyRate: enrollStats.occupancyRate,
      },
      attendance: {
        totalSessionsCount: rollup.totalSessionsCount,
        totalMarkedRecords: rollup.totalMarkedRecords,
        presentCount: rollup.presentCount,
        absentCount: rollup.absentCount,
        lateCount: rollup.lateCount,
        excusedCount: rollup.excusedCount,
        unmarkedCount: rollup.unmarkedCount,
        averageAttendanceRate: avgAttendance,
      },
      learners: learners.map((l) => {
        const summary = summaries.get(l.enrollmentId) ?? {
          presentCount: 0,
          absentCount: 0,
          lateCount: 0,
          excusedCount: 0,
          unmarkedCount: 0,
          totalSessionsCount: 0,
          attendanceRate: 0,
        };
        const alreadyCertified = certified.has(l.enrollmentId);
        return {
          enrollmentId: l.enrollmentId,
          student: {
            id: l.studentId,
            firstName: l.studentFirstName,
            lastName: l.studentLastName,
            email: l.studentEmail,
            matricule: l.studentMatricule,
            accountType: l.studentAccountType,
          },
          enrollmentStatus: l.enrollmentStatus,
          enrolledAt: l.enrolledAt.toISOString(),
          attendanceSummary: summary,
          certificateReadiness: buildCertificateReadiness({
            attendanceRate: summary.attendanceRate,
            formationEnded,
            alreadyCertified,
          }),
        };
      }),
      feedback: {
        averageRating: feedbackAgg.averageRating,
        ratingCount: feedbackAgg.ratingCount,
        ratingDistribution: feedbackAgg.distribution,
        latestComments: latestComments.map((c) => ({
          id: c.id,
          rating: c.rating,
          comment: c.comment,
          createdAt: c.createdAt.toISOString(),
          student: c.student,
        })),
      },
    };
  }
}
