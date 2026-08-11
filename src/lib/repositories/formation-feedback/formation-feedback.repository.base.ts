import { Inject } from '@nestjs/common';
import { and, count, desc, eq } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import { formationFeedback, formations, users } from '@/database/schema';

export type RatingDistribution = {
  zero: number;
  one: number;
  two: number;
  three: number;
  four: number;
  five: number;
};

export type FeedbackAggregateRow = {
  averageRating: number | null;
  ratingCount: number;
  distribution: RatingDistribution;
};

export abstract class FormationFeedbackBaseRepository {
  protected readonly db: DrizzleDB;

  constructor(@Inject(DRIZZLE_DB) db: DrizzleDB) {
    this.db = db;
  }

  async upsertFeedback(params: {
    formationId: string;
    studentId: string;
    enrollmentId: string | null;
    rating: number;
    comment: string | null;
  }) {
    const now = new Date();
    const [row] = await this.db
      .insert(formationFeedback)
      .values({
        formationId: params.formationId,
        studentId: params.studentId,
        enrollmentId: params.enrollmentId,
        rating: params.rating,
        comment: params.comment,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [formationFeedback.formationId, formationFeedback.studentId],
        set: {
          rating: params.rating,
          comment: params.comment,
          enrollmentId: params.enrollmentId,
          updatedAt: now,
        },
      })
      .returning();

    return row;
  }

  async findFeedbackForStudent(formationId: string, studentId: string) {
    const [row] = await this.db
      .select()
      .from(formationFeedback)
      .where(
        and(
          eq(formationFeedback.formationId, formationId),
          eq(formationFeedback.studentId, studentId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async listLatestCommentsForFormation(params: {
    formationId: string;
    limit: number;
  }) {
    return this.db
      .select({
        id: formationFeedback.id,
        rating: formationFeedback.rating,
        comment: formationFeedback.comment,
        createdAt: formationFeedback.createdAt,
        student: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(formationFeedback)
      .innerJoin(users, eq(formationFeedback.studentId, users.id))
      .where(eq(formationFeedback.formationId, params.formationId))
      .orderBy(desc(formationFeedback.createdAt))
      .limit(params.limit);
  }

  async listCommentsPaginated(params: {
    formationId: string;
    page: number;
    limit: number;
  }) {
    const offset = (params.page - 1) * params.limit;
    const whereClause = eq(formationFeedback.formationId, params.formationId);

    const data = await this.db
      .select({
        id: formationFeedback.id,
        rating: formationFeedback.rating,
        comment: formationFeedback.comment,
        createdAt: formationFeedback.createdAt,
        student: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(formationFeedback)
      .innerJoin(users, eq(formationFeedback.studentId, users.id))
      .where(whereClause)
      .orderBy(desc(formationFeedback.createdAt))
      .limit(params.limit)
      .offset(offset);

    const [totalRow] = await this.db
      .select({ total: count() })
      .from(formationFeedback)
      .where(whereClause);

    return {
      data,
      total: Number(totalRow?.total ?? 0),
      page: params.page,
      limit: params.limit,
    };
  }

  async formationExists(formationId: string): Promise<boolean> {
    const [r] = await this.db
      .select({ id: formations.id })
      .from(formations)
      .where(eq(formations.id, formationId))
      .limit(1);
    return Boolean(r);
  }
}
