import { and, count, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import {
  enrollments,
  formations,
  payments,
  users,
  Payment,
} from '@/database/schema';
import { PaymentsBaseRepository } from './payments.repository.base';

export abstract class PaymentsStatsRepository extends PaymentsBaseRepository {
  async findMyPaymentsPaginated(params: {
    studentId: string;
    page: number;
    limit: number;
    status?: Payment['status'];
    formationId?: string;
  }) {
    const filters = [
      eq(payments.studentId, params.studentId),
      params.status ? eq(payments.status, params.status) : undefined,
      params.formationId
        ? eq(payments.formationId, params.formationId)
        : undefined,
    ].filter(Boolean);
    const whereClause = and(...filters);

    const dataQuery = this.db
      .select({
        payment: payments,
        formationTitle: formations.title,
        enrollmentStatus: enrollments.status,
      })
      .from(payments)
      .innerJoin(formations, eq(payments.formationId, formations.id))
      .innerJoin(enrollments, eq(payments.enrollmentId, enrollments.id))
      .where(whereClause)
      .orderBy(desc(payments.createdAt));

    const countQuery = this.db
      .select({ total: count() })
      .from(payments)
      .where(whereClause);

    return this.paginate({
      query: dataQuery,
      countQuery,
      page: params.page,
      limit: params.limit,
    });
  }

  async findAdminPaymentsPaginated(params: {
    page: number;
    limit: number;
    status?: Payment['status'];
    formationId?: string;
    studentId?: string;
    search?: string;
    from?: Date;
    to?: Date;
  }) {
    const filters = [
      params.status ? eq(payments.status, params.status) : undefined,
      params.formationId
        ? eq(payments.formationId, params.formationId)
        : undefined,
      params.studentId ? eq(payments.studentId, params.studentId) : undefined,
      params.from ? gte(payments.createdAt, params.from) : undefined,
      params.to ? lte(payments.createdAt, params.to) : undefined,
      params.search
        ? or(
            ilike(users.firstName, `%${params.search}%`),
            ilike(users.lastName, `%${params.search}%`),
            ilike(users.email, `%${params.search}%`),
            ilike(users.matricule, `%${params.search}%`),
            ilike(formations.title, `%${params.search}%`),
          )
        : undefined,
    ].filter(Boolean);
    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const dataQuery = this.db
      .select({
        payment: payments,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
        studentEmail: users.email,
        studentMatricule: users.matricule,
        formationTitle: formations.title,
        formationPrice: formations.price,
        enrollmentStatus: enrollments.status,
      })
      .from(payments)
      .innerJoin(users, eq(payments.studentId, users.id))
      .innerJoin(formations, eq(payments.formationId, formations.id))
      .innerJoin(enrollments, eq(payments.enrollmentId, enrollments.id))
      .where(whereClause)
      .orderBy(desc(payments.createdAt));

    const countQuery = this.db
      .select({ total: count() })
      .from(payments)
      .innerJoin(users, eq(payments.studentId, users.id))
      .innerJoin(formations, eq(payments.formationId, formations.id))
      .where(whereClause);

    return this.paginate({
      query: dataQuery,
      countQuery,
      page: params.page,
      limit: params.limit,
    });
  }

  async adminStats(): Promise<{
    pendingCount: number;
    paidCount: number;
    failedCount: number;
    cancelledCount: number;
    expiredCount: number;
    totalPaidAmount: string;
  }> {
    const statusCounts = await this.db
      .select({
        status: payments.status,
        n: sql<number>`cast(count(*) as int)`,
      })
      .from(payments)
      .groupBy(payments.status);

    const map = new Map<string, number>();
    for (const r of statusCounts) {
      map.set(r.status, r.n);
    }

    const [sumRow] = await this.db
      .select({
        total: sql<string>`coalesce(sum(${payments.amount})::text, '0')`,
      })
      .from(payments)
      .where(eq(payments.status, 'PAID'));

    return {
      pendingCount: (map.get('PENDING') ?? 0) + (map.get('PROCESSING') ?? 0),
      paidCount: map.get('PAID') ?? 0,
      failedCount: map.get('FAILED') ?? 0,
      cancelledCount: map.get('CANCELLED') ?? 0,
      expiredCount: map.get('EXPIRED') ?? 0,
      totalPaidAmount: sumRow?.total ?? '0',
    };
  }
}
