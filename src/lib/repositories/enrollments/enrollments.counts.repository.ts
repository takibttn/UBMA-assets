import { and, count, eq, inArray, sql } from 'drizzle-orm';
import { certificates, enrollments } from '@/database/schema';
import { EnrollmentsLearnerRepository } from './enrollments.learner.repository';

export abstract class EnrollmentsCountsRepository extends EnrollmentsLearnerRepository {
  async countReservedByFormation(formationId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.formationId, formationId),
          inArray(enrollments.status, ['ENROLLED', 'PENDING_PAYMENT']),
        ),
      );
    return result[0]?.count ?? 0;
  }

  async countActiveByFormation(formationId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.formationId, formationId),
          eq(enrollments.status, 'ENROLLED'),
        ),
      );
    return result[0]?.count ?? 0;
  }

  async countEnrollmentsInFormation(
    enrollmentIds: string[],
    formationId: string,
  ): Promise<number> {
    if (enrollmentIds.length === 0) return 0;
    const [r] = await this.db
      .select({ n: count() })
      .from(enrollments)
      .where(
        and(
          inArray(enrollments.id, enrollmentIds),
          eq(enrollments.formationId, formationId),
          eq(enrollments.status, 'ENROLLED'),
        ),
      );
    return Number(r?.n ?? 0);
  }

  async findIssuedCertificateEnrollmentIds(
    enrollmentIds: string[],
  ): Promise<Set<string>> {
    const set = new Set<string>();
    if (enrollmentIds.length === 0) return set;
    const rows = await this.db
      .select({ enrollmentId: certificates.enrollmentId })
      .from(certificates)
      .where(inArray(certificates.enrollmentId, enrollmentIds));
    for (const r of rows) {
      set.add(r.enrollmentId);
    }
    return set;
  }
}
