import { count, desc, eq, inArray, sql } from 'drizzle-orm';
import { formationFeedback, users } from '@/database/schema';
import {
  FeedbackAggregateRow,
  FormationFeedbackBaseRepository,
  RatingDistribution,
} from './formation-feedback.repository.base';

export abstract class FormationFeedbackStatsRepository extends FormationFeedbackBaseRepository {
  async getAggregateForFormation(
    formationId: string,
  ): Promise<FeedbackAggregateRow> {
    const distRows = await this.db
      .select({
        rating: formationFeedback.rating,
        n: count(),
      })
      .from(formationFeedback)
      .where(eq(formationFeedback.formationId, formationId))
      .groupBy(formationFeedback.rating);

    const distribution: RatingDistribution = {
      zero: 0,
      one: 0,
      two: 0,
      three: 0,
      four: 0,
      five: 0,
    };
    for (const r of distRows) {
      const idx = r.rating;
      if (idx === 0) distribution.zero = Number(r.n);
      else if (idx === 1) distribution.one = Number(r.n);
      else if (idx === 2) distribution.two = Number(r.n);
      else if (idx === 3) distribution.three = Number(r.n);
      else if (idx === 4) distribution.four = Number(r.n);
      else if (idx === 5) distribution.five = Number(r.n);
    }

    const ratingCount = Object.values(distribution).reduce((a, b) => a + b, 0);

    const [avgRow] = await this.db
      .select({
        avg: sql<
          number | null
        >`round(avg(${formationFeedback.rating})::numeric, 2)`,
      })
      .from(formationFeedback)
      .where(eq(formationFeedback.formationId, formationId));

    return {
      averageRating: avgRow?.avg != null ? Number(avgRow.avg) : null,
      ratingCount,
      distribution,
    };
  }

  async listAdminPaginated(params: {
    formationId: string;
    page: number;
    limit: number;
  }) {
    const offset = (params.page - 1) * params.limit;
    const whereClause = eq(formationFeedback.formationId, params.formationId);

    const data = await this.db
      .select({
        id: formationFeedback.id,
        formationId: formationFeedback.formationId,
        studentId: formationFeedback.studentId,
        enrollmentId: formationFeedback.enrollmentId,
        rating: formationFeedback.rating,
        comment: formationFeedback.comment,
        createdAt: formationFeedback.createdAt,
        updatedAt: formationFeedback.updatedAt,
        student: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          matricule: users.matricule,
          accountType: users.accountType,
        },
      })
      .from(formationFeedback)
      .innerJoin(users, eq(formationFeedback.studentId, users.id))
      .where(whereClause)
      .orderBy(desc(formationFeedback.createdAt))
      .limit(params.limit)
      .offset(offset);

    const aggregate = await this.getAggregateForFormation(params.formationId);

    const [totalRow] = await this.db
      .select({ total: count() })
      .from(formationFeedback)
      .where(whereClause);

    return {
      data,
      aggregate,
      total: Number(totalRow?.total ?? 0),
      page: params.page,
      limit: params.limit,
    };
  }

  /**
   * Batch aggregates for dashboard top formations (limited N ids).
   */
  async getAggregatesForFormations(
    formationIds: string[],
  ): Promise<
    Map<string, { averageRating: number | null; ratingCount: number }>
  > {
    const map = new Map<
      string,
      { averageRating: number | null; ratingCount: number }
    >();
    if (formationIds.length === 0) return map;

    const rows = await this.db
      .select({
        formationId: formationFeedback.formationId,
        avg: sql<
          number | null
        >`round(avg(${formationFeedback.rating})::numeric, 2)`,
        ratingCount: count(),
      })
      .from(formationFeedback)
      .where(inArray(formationFeedback.formationId, formationIds))
      .groupBy(formationFeedback.formationId);

    for (const id of formationIds) {
      map.set(id, { averageRating: null, ratingCount: 0 });
    }
    for (const r of rows) {
      map.set(r.formationId, {
        averageRating: r.avg != null ? Number(r.avg) : null,
        ratingCount: Number(r.ratingCount),
      });
    }
    return map;
  }
}
