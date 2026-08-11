import { and, count, eq } from 'drizzle-orm';
import {
  enrollments,
  formationLevels,
  formations,
  languages,
} from '@/database/schema';
import { FindLearnerProfileEnrollmentsQueryDto } from '@modules/enrollments/dto/find-learner-profile-enrollments-query.dto';
import type { LearnerProfileEnrollmentBucketFilter } from '@modules/enrollments/dto/find-learner-profile-enrollments-query.dto';
import {
  enrolledCountSubquery,
  resolveEnrollmentOrderBy,
} from './enrollment.query-fragments';
import type { LearnerProfileEnrollmentCardRow } from './enrollment.repository.types';
import { whereLearnerProfileBucket } from './enrollment.repository.types';
import { EnrollmentsTeacherRepository } from './enrollments.teacher.repository';

export abstract class EnrollmentsLearnerRepository extends EnrollmentsTeacherRepository {
  async countEnrolledLearnerEnrollments(studentId: string): Promise<number> {
    const result = await this.db
      .select({ total: count() })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.status, 'ENROLLED'),
        ),
      );
    return Number(result[0]?.total ?? 0);
  }

  async countEnrolledLearnerEnrollmentsByProfileBucket(
    studentId: string,
    bucket: 'IN_PROGRESS' | 'COMPLETED',
    now: Date,
  ): Promise<number> {
    const bucketClause = whereLearnerProfileBucket(bucket, now);
    const result = await this.db
      .select({ total: count() })
      .from(enrollments)
      .innerJoin(formations, eq(enrollments.formationId, formations.id))
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.status, 'ENROLLED'),
          bucketClause,
        ),
      );
    return Number(result[0]?.total ?? 0);
  }

  async findLearnerInProgressEnrollmentCardRows(
    studentId: string,
    now: Date,
    maxRows: number,
  ): Promise<LearnerProfileEnrollmentCardRow[]> {
    const bucketClause = whereLearnerProfileBucket('IN_PROGRESS', now);
    const rows = await this.db
      .select({
        enrollmentId: enrollments.id,
        enrollmentStatus: enrollments.status,
        enrolledAt: enrollments.enrolledAt,
        formationId: formations.id,
        title: formations.title,
        description: formations.description,
        startDate: formations.startDate,
        endDate: formations.endDate,
        price: formations.price,
        capacity: formations.capacity,
        isSaleOpen: formations.isSaleOpen,
        enrolledCount: enrolledCountSubquery('enrolled_count'),
        language: {
          id: languages.id,
          name: languages.name,
          code: languages.code,
        },
        level: {
          id: formationLevels.id,
          code: formationLevels.code,
          name: formationLevels.name,
        },
      })
      .from(enrollments)
      .innerJoin(formations, eq(enrollments.formationId, formations.id))
      .leftJoin(languages, eq(formations.languageId, languages.id))
      .leftJoin(formationLevels, eq(formations.levelId, formationLevels.id))
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.status, 'ENROLLED'),
          bucketClause,
        ),
      )
      .limit(maxRows);

    return rows.map((r) => ({
      ...r,
      enrollmentStatus: r.enrollmentStatus,
    }));
  }

  async findLearnerProfileEnrollmentsPaginated(
    studentId: string,
    query: FindLearnerProfileEnrollmentsQueryDto,
    now: Date,
  ) {
    const bucket: LearnerProfileEnrollmentBucketFilter = query.bucket ?? 'ALL';
    const bucketClause = whereLearnerProfileBucket(bucket, now);

    const order = resolveEnrollmentOrderBy(query.sortBy, query.sortOrder, {
      enrolledAt: enrollments.enrolledAt,
      formationStartDate: formations.startDate,
      formationEndDate: formations.endDate,
    } as const);

    const baseWhere = and(
      eq(enrollments.studentId, studentId),
      eq(enrollments.status, 'ENROLLED'),
      bucketClause,
    );

    const dataQuery = this.db
      .select({
        enrollmentId: enrollments.id,
        enrollmentStatus: enrollments.status,
        enrolledAt: enrollments.enrolledAt,
        formationId: formations.id,
        title: formations.title,
        description: formations.description,
        startDate: formations.startDate,
        endDate: formations.endDate,
        price: formations.price,
        capacity: formations.capacity,
        isSaleOpen: formations.isSaleOpen,
        enrolledCount: enrolledCountSubquery('enrolled_count'),
        language: {
          id: languages.id,
          name: languages.name,
          code: languages.code,
        },
        level: {
          id: formationLevels.id,
          code: formationLevels.code,
          name: formationLevels.name,
        },
      })
      .from(enrollments)
      .innerJoin(formations, eq(enrollments.formationId, formations.id))
      .leftJoin(languages, eq(formations.languageId, languages.id))
      .leftJoin(formationLevels, eq(formations.levelId, formationLevels.id))
      .where(baseWhere)
      .orderBy(order);

    const countQuery = this.db
      .select({ total: count() })
      .from(enrollments)
      .innerJoin(formations, eq(enrollments.formationId, formations.id))
      .where(baseWhere);

    return this.paginate({
      query: dataQuery,
      countQuery,
      page: query.page,
      limit: query.limit,
    });
  }
}
