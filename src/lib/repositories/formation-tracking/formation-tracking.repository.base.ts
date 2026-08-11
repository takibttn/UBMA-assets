import { Inject } from '@nestjs/common';
import { and, count, eq, ne } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import {
  enrollments,
  formationSessions,
  formations,
  sessionAttendance,
} from '@/database/schema';

export type SessionStats = {
  total: number;
  scheduled: number;
  completed: number;
  cancelled: number;
  completionRate: number;
};

export type EnrollmentFormationStats = {
  totalEnrolled: number;
  activeEnrolled: number;
  cancelled: number;
  capacity: number | null;
  occupancyRate: number | null;
};

export type AttendanceRollup = {
  totalSessionsCount: number;
  totalMarkedRecords: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  unmarkedCount: number;
};

export abstract class FormationTrackingBaseRepository {
  protected readonly db: DrizzleDB;

  constructor(@Inject(DRIZZLE_DB) db: DrizzleDB) {
    this.db = db;
  }

  async getSessionStats(formationId: string): Promise<SessionStats> {
    const rows = await this.db
      .select({
        status: formationSessions.status,
        n: count(),
      })
      .from(formationSessions)
      .where(eq(formationSessions.formationId, formationId))
      .groupBy(formationSessions.status);

    const byStatus = { SCHEDULED: 0, COMPLETED: 0, CANCELLED: 0 };
    for (const r of rows) {
      byStatus[r.status] = Number(r.n);
    }
    const total = byStatus.SCHEDULED + byStatus.COMPLETED + byStatus.CANCELLED;
    const completionRate =
      total > 0 ? Math.round((byStatus.COMPLETED / total) * 100) : 0;

    return {
      total,
      scheduled: byStatus.SCHEDULED,
      completed: byStatus.COMPLETED,
      cancelled: byStatus.CANCELLED,
      completionRate,
    };
  }

  async getEnrollmentFormationStats(
    formationId: string,
  ): Promise<EnrollmentFormationStats> {
    const [f] = await this.db
      .select({ capacity: formations.capacity })
      .from(formations)
      .where(eq(formations.id, formationId))
      .limit(1);

    const statusRows = await this.db
      .select({
        status: enrollments.status,
        n: count(),
      })
      .from(enrollments)
      .where(eq(enrollments.formationId, formationId))
      .groupBy(enrollments.status);

    let activeEnrolled = 0;
    let cancelled = 0;
    for (const r of statusRows) {
      if (r.status === 'ENROLLED') activeEnrolled = Number(r.n);
      if (r.status === 'CANCELLED') cancelled = Number(r.n);
    }

    const capacity = f?.capacity ?? null;
    const occupancyRate =
      capacity != null && capacity > 0
        ? Math.round((activeEnrolled / capacity) * 100)
        : null;

    return {
      totalEnrolled: activeEnrolled + cancelled,
      activeEnrolled,
      cancelled,
      capacity,
      occupancyRate,
    };
  }

  /**
   * Counts attendance rows only for non-cancelled sessions.
   */
  async getAttendanceRollup(
    formationId: string,
    activeEnrolled: number,
  ): Promise<AttendanceRollup> {
    const [sessRow] = await this.db
      .select({ n: count() })
      .from(formationSessions)
      .where(
        and(
          eq(formationSessions.formationId, formationId),
          ne(formationSessions.status, 'CANCELLED'),
        ),
      );

    const totalSessionsCount = Number(sessRow?.n ?? 0);

    const statusRows = await this.db
      .select({
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
          eq(formationSessions.formationId, formationId),
          ne(formationSessions.status, 'CANCELLED'),
        ),
      )
      .groupBy(sessionAttendance.status);

    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;
    for (const r of statusRows) {
      const n = Number(r.n);
      if (r.status === 'PRESENT') presentCount = n;
      else if (r.status === 'ABSENT') absentCount = n;
      else if (r.status === 'LATE') lateCount = n;
      else if (r.status === 'EXCUSED') excusedCount = n;
    }

    const totalMarkedRecords =
      presentCount + absentCount + lateCount + excusedCount;

    const totalSlots = totalSessionsCount * activeEnrolled;
    const unmarkedCount = Math.max(0, totalSlots - totalMarkedRecords);

    return {
      totalSessionsCount,
      totalMarkedRecords,
      presentCount,
      absentCount,
      lateCount,
      excusedCount,
      unmarkedCount,
    };
  }
}
