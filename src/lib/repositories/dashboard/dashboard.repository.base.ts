import { Inject } from '@nestjs/common';
import { and, count, eq, isNotNull, isNull, lt } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import { certificates, enrollments, formations } from '@/database/schema';

export abstract class DashboardBaseRepository {
  protected readonly db: DrizzleDB;
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDB) {
    this.db = db;
  }

  /**
   * Pending enrollments count.
   * The current enrollment flow auto-enrolls (no PENDING status in the schema).
   * This will return 0 until a PENDING status is added via migration.
   */
  getPendingEnrollmentsCount(): Promise<number> {
    // TODO: update when a PENDING enrollment status is introduced in the schema
    return Promise.resolve(0);
  }

  /**
   * Count ENROLLED enrollments where formation.endDate < now and no
   * certificate row exists for that enrollment.
   */
  async getCertificatesToGenerateCount(): Promise<number> {
    const now = new Date();
    const result = await this.db
      .select({ value: count() })
      .from(enrollments)
      .innerJoin(formations, eq(enrollments.formationId, formations.id))
      .leftJoin(certificates, eq(certificates.enrollmentId, enrollments.id))
      .where(
        and(
          eq(enrollments.status, 'ENROLLED'),
          isNotNull(formations.endDate),
          lt(formations.endDate, now),
          isNull(certificates.id),
        ),
      );

    return Number(result[0]?.value ?? 0);
  }
}
