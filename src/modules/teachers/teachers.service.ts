import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { PaginationQueryDto } from '@common/pagination/dto/pagination-query.dto';
import { computeSpotsRemaining } from '@lib/formations/formation-base.mapper';
import { EnrollmentsRepository } from '@lib/repositories/enrollments/enrollments.repository';
import { FormationFeedbackRepository } from '@lib/repositories/formation-feedback/formation-feedback.repository';
import { FormationTrackingRepository } from '@lib/repositories/formation-tracking/formation-tracking.repository';
import { FindTeacherCalendarQueryDto } from './dto/find-teacher-calendar-query.dto';
import { TeachersRepository } from './teachers.repository';
import { TeachersServiceFormation } from './teachers.service.formation';

@Injectable()
export class TeachersService extends TeachersServiceFormation {
  constructor(
    @Inject(TeachersRepository) teachersRepository: TeachersRepository,
    @Inject(EnrollmentsRepository)
    enrollmentsRepository: EnrollmentsRepository,
    @Inject(FormationTrackingRepository)
    formationTrackingRepository: FormationTrackingRepository,
    @Inject(FormationFeedbackRepository)
    formationFeedbackRepository: FormationFeedbackRepository,
  ) {
    super(
      teachersRepository,
      enrollmentsRepository,
      formationTrackingRepository,
      formationFeedbackRepository,
    );
  }

  async getTeacherFormationFeedback(
    teacherId: string,
    formationId: string,
    query: PaginationQueryDto,
  ) {
    const ok = await this.teachersRepository.isTeacherAssignedToFormation(
      teacherId,
      formationId,
    );
    if (!ok) {
      throw new ForbiddenException('Not assigned to this formation');
    }

    const aggregate =
      await this.formationFeedbackRepository.getAggregateForFormation(
        formationId,
      );
    const page = await this.formationFeedbackRepository.listCommentsPaginated({
      formationId,
      page: query.page,
      limit: query.limit,
    });

    return {
      averageRating: aggregate.averageRating,
      ratingCount: aggregate.ratingCount,
      ratingDistribution: aggregate.distribution,
      comments: {
        data: page.data.map((c) => ({
          id: c.id,
          rating: c.rating,
          comment: c.comment,
          createdAt: c.createdAt.toISOString(),
          student: c.student,
        })),
        total: page.total,
        page: page.page,
        limit: page.limit,
      },
    };
  }

  async getTeacherFormationEnrollments(
    teacherId: string,
    formationId: string,
    query: PaginationQueryDto,
  ) {
    const page =
      await this.teachersRepository.findTeacherFormationEnrollmentsPaginated(
        teacherId,
        formationId,
        query.page,
        query.limit,
      );
    const ids = page.data.map((row) => row.id);
    const summaries =
      await this.enrollmentsRepository.getAttendanceSummariesByEnrollmentIds(
        ids,
      );
    const empty = {
      presentCount: 0,
      absentCount: 0,
      lateCount: 0,
      excusedCount: 0,
      unmarkedCount: 0,
      totalSessionsCount: 0,
      attendanceRate: 0,
    };
    return {
      ...page,
      data: page.data.map((row) => ({
        ...row,
        attendanceSummary: summaries.get(row.id) ?? empty,
      })),
    };
  }

  async getTeacherFormationCertificates(
    teacherId: string,
    formationId: string,
    query: PaginationQueryDto,
  ) {
    return this.teachersRepository.findTeacherFormationCertificatesPaginated(
      teacherId,
      formationId,
      query.page,
      query.limit,
    );
  }

  async getTeacherCalendar(
    teacherId: string,
    query: FindTeacherCalendarQueryDto,
  ) {
    const events = await this.teachersRepository.findTeacherCalendarEvents(
      teacherId,
      query,
    );
    return {
      data: events.map((event) => {
        const cap = event.capacity;
        const enrolled = Number(event.enrolledCount ?? 0);
        const spotsRemaining = computeSpotsRemaining(cap, enrolled);
        return {
          id: event.sessionId,
          sessionId: event.sessionId,
          formationId: event.formationId,
          title: event.title,
          startsAt: event.startAt.toISOString(),
          endsAt: event.endAt.toISOString(),
          room: event.room,
          language: event.language,
          level: event.level,
          status: event.status,
          enrolledCount: enrolled,
          capacity: cap ?? null,
          spotsRemaining,
          type: 'SESSION' as const,
        };
      }),
    };
  }

  async isTeacherAssignedToFormation(teacherId: string, formationId: string) {
    return this.teachersRepository.isTeacherAssignedToFormation(
      teacherId,
      formationId,
    );
  }
}
