import { Injectable, Inject } from '@nestjs/common';
import { and, count, desc, eq, inArray, ne } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import {
  enrollments,
  formationSessions,
  sessionAttendance,
  users,
} from '@/database/schema';
import {
  buildAttendanceSummaryMap,
  EnrollmentAttendanceSummary,
} from './enrollment.repository.types';
import { EnrollmentsCountsRepository } from './enrollments.counts.repository';

export type { EnrollmentAttendanceSummary } from './enrollment.repository.types';
export type { LearnerProfileEnrollmentCardRow } from './enrollment.repository.types';

@Injectable()
export class EnrollmentsRepository extends EnrollmentsCountsRepository {
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDB) {
    super(db);
  }

  async findFormationEnrollmentsWithStudents(formationId: string): Promise<
    Array<{
      enrollmentId: string;
      enrollmentStatus: 'ENROLLED' | 'CANCELLED' | 'PENDING_PAYMENT';
      enrolledAt: Date;
      studentId: string;
      studentFirstName: string;
      studentLastName: string;
      studentEmail: string | null;
      studentMatricule: string | null;
      studentAccountType: string | null;
    }>
  > {
    const rows = await this.db
      .select({
        enrollmentId: enrollments.id,
        enrollmentStatus: enrollments.status,
        enrolledAt: enrollments.enrolledAt,
        studentId: users.id,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
        studentEmail: users.email,
        studentMatricule: users.matricule,
        studentAccountType: users.accountType,
      })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.studentId, users.id))
      .where(eq(enrollments.formationId, formationId))
      .orderBy(desc(enrollments.enrolledAt));

    return rows.map((r) => ({
      ...r,
      enrollmentStatus: r.enrollmentStatus,
    }));
  }

  async getAttendanceSummariesByEnrollmentIds(
    enrollmentIds: string[],
  ): Promise<Map<string, EnrollmentAttendanceSummary>> {
    const map = new Map<string, EnrollmentAttendanceSummary>();
    if (enrollmentIds.length === 0) return map;

    const enrollRows = await this.db
      .select({
        id: enrollments.id,
        formationId: enrollments.formationId,
      })
      .from(enrollments)
      .where(inArray(enrollments.id, enrollmentIds));

    const formationIds = [...new Set(enrollRows.map((e) => e.formationId))];

    const totalByFormation = new Map<string, number>();
    if (formationIds.length > 0) {
      const totals = await this.db
        .select({
          formationId: formationSessions.formationId,
          n: count(),
        })
        .from(formationSessions)
        .where(
          and(
            inArray(formationSessions.formationId, formationIds),
            ne(formationSessions.status, 'CANCELLED'),
          ),
        )
        .groupBy(formationSessions.formationId);
      for (const t of totals) {
        totalByFormation.set(t.formationId, Number(t.n));
      }
    }

    const attRows = await this.db
      .select({
        enrollmentId: sessionAttendance.enrollmentId,
        status: sessionAttendance.status,
        n: count(),
      })
      .from(sessionAttendance)
      .innerJoin(
        formationSessions,
        eq(sessionAttendance.sessionId, formationSessions.id),
      )
      .where(
        and(
          inArray(sessionAttendance.enrollmentId, enrollmentIds),
          ne(formationSessions.status, 'CANCELLED'),
        ),
      )
      .groupBy(sessionAttendance.enrollmentId, sessionAttendance.status);

    const enrollToFormation = new Map(
      enrollRows.map((r) => [r.id, r.formationId] as const),
    );

    return buildAttendanceSummaryMap(
      enrollmentIds,
      enrollToFormation,
      totalByFormation,
      attRows,
    );
  }
}
