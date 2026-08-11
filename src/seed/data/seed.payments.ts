import { eq, inArray } from 'drizzle-orm';
import { enrollments, payments } from '@/database/schema';
import type { AcademicSeedContext } from './context';

/**
 * Seed payments for existing enrollments.
 * Some are PAID, some PENDING.
 */
export async function seedPayments(
  ctx: AcademicSeedContext,
  formationIds: string[],
): Promise<void> {
  const { db } = ctx;

  // Find enrollments for the provided formations
  const enrRows = await db
    .select({
      id: enrollments.id,
      studentId: enrollments.studentId,
      formationId: enrollments.formationId,
      status: enrollments.status,
    })
    .from(enrollments)
    .where(inArray(enrollments.formationId, formationIds));

  for (const enr of enrRows) {
    // Skip if already has a payment
    const existing = await db
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.enrollmentId, enr.id))
      .limit(1);

    if (existing[0]) continue;

    // Deterministic status based on index or status
    // If enrollment is ENROLLED, it should usually be PAID or PENDING
    const isPaid = enr.status === 'ENROLLED';
    const status = isPaid ? 'PAID' : 'PENDING';
    const amount = '1500.00'; // Default amount

    await db.insert(payments).values({
      enrollmentId: enr.id,
      studentId: enr.studentId,
      formationId: enr.formationId,
      provider: 'STRIPE_MOCK',
      providerCheckoutId: `mock_checkout_${enr.id.slice(0, 8)}`,
      amount,
      status,
      paidAt: isPaid ? new Date() : null,
    });

    ctx.counters.paymentsInserted += 1;
  }
}
