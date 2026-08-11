import { AuthUser } from '@modules/auth/types/auth-user.type';
import {
  mapFormationBaseDto,
  type FormationLanguageDto,
  type FormationLevelDto,
} from '@lib/formations/formation-base.mapper';
import { FindEnrollmentsQueryDto } from './dto/find-enrollments-query.dto';
import { EMPTY_ATTENDANCE } from './enrollments.service.base';
import { EnrollmentsEnrollService } from './enrollments.service.enroll';

export abstract class EnrollmentsMyEnrollmentsService extends EnrollmentsEnrollService {
  async getMyEnrollments(user: AuthUser, query: FindEnrollmentsQueryDto) {
    const page = await this.enrollmentsRepository.findByStudentPaginated(
      user.id,
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
        return {
          ...rest,
          enrolledAt: enrolledAt.toISOString(),
          formation: mapFormationBaseDto(
            {
              id: f.id,
              title: f.title,
              description: f.description,
              price: f.price,
              capacity: f.capacity,
              isSaleOpen: f.isSaleOpen,
              startDate: f.startDate,
              endDate: f.endDate,
              createdAt: f.createdAt,
              enrolledCount: formationEnrolledCount,
              language: f.language as FormationLanguageDto,
              level: f.level as FormationLevelDto,
            },
            { includeCreatedAt: true },
          ),
          attendanceSummary: summaries.get(row.id) ?? EMPTY_ATTENDANCE,
        };
      }),
    };
  }
}
