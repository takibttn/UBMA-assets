import { Inject } from '@nestjs/common';
import { and, desc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import { payments, Payment, NewPayment } from '@/database/schema';
import { BaseRepository } from '@common/repositories/base.repository';

export abstract class PaymentsBaseRepository extends BaseRepository {
  protected readonly db: DrizzleDB;
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDB) {
    super();
    this.db = db;
  }

  async insertPayment(data: NewPayment): Promise<Payment> {
    const [row] = await this.db.insert(payments).values(data).returning();
    return row;
  }

  async updatePayment(
    paymentId: string,
    data: Partial<
      Pick<
        Payment,
        | 'status'
        | 'providerCheckoutId'
        | 'providerPaymentId'
        | 'checkoutUrl'
        | 'failureReason'
        | 'metadata'
        | 'paidAt'
        | 'expiresAt'
      >
    > & { updatedAt?: Date },
  ): Promise<void> {
    await this.db
      .update(payments)
      .set({ ...data, updatedAt: data.updatedAt ?? new Date() })
      .where(eq(payments.id, paymentId));
  }

  async findById(id: string): Promise<Payment | undefined> {
    const [row] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.id, id))
      .limit(1);
    return row;
  }

  async findByProviderCheckout(
    provider: string,
    providerCheckoutId: string,
  ): Promise<Payment | undefined> {
    const [row] = await this.db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.provider, provider),
          eq(payments.providerCheckoutId, providerCheckoutId),
        ),
      )
      .limit(1);
    return row;
  }

  /** Resolve webhook by checkout id (unique when set). */
  async findByProviderCheckoutId(
    providerCheckoutId: string,
  ): Promise<Payment | undefined> {
    const [row] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.providerCheckoutId, providerCheckoutId))
      .limit(1);
    return row;
  }

  async findLatestOpenCheckoutForEnrollment(
    enrollmentId: string,
  ): Promise<Payment | undefined> {
    const now = new Date();
    const [row] = await this.db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.enrollmentId, enrollmentId),
          inArray(payments.status, ['PENDING', 'PROCESSING']),
          sql`${payments.checkoutUrl} IS NOT NULL`,
          or(isNull(payments.expiresAt), gt(payments.expiresAt, now)),
        ),
      )
      .orderBy(desc(payments.createdAt))
      .limit(1);
    return row;
  }
}
