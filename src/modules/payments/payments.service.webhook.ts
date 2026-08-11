import { eq } from 'drizzle-orm';
import { enrollments, payments } from '@/database/schema';
import { resolveWebhookPaymentKind } from './utils/payment-webhook-kind.util';
import { PaymentsCheckoutService } from './payments.service.checkout';

export abstract class PaymentsWebhookService extends PaymentsCheckoutService {
  async handleProviderWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ received: true }> {
    const event = await this.provider.verifyAndParseWebhook({
      rawBody,
      headers,
    });

    const checkoutId = event.checkout.id;
    if (!checkoutId) {
      this.log.warn('Webhook sans checkout id');
      return { received: true };
    }

    const kind = resolveWebhookPaymentKind(event);

    await this.db.transaction(async (tx) => {
      const [pay] = await tx
        .select()
        .from(payments)
        .where(eq(payments.providerCheckoutId, checkoutId))
        .limit(1);

      if (!pay) {
        this.log.warn(`Webhook: paiement inconnu pour checkout ${checkoutId}`);
        return;
      }

      if (kind === 'unknown') {
        return;
      }

      if (kind === 'paid') {
        if (pay.status === 'PAID') {
          return;
        }
        const expectedMinor = Math.round(Number(pay.amount));
        if (
          !Number.isFinite(event.checkout.amount) ||
          event.checkout.amount !== expectedMinor
        ) {
          this.log.warn(
            `Montant webhook (${event.checkout.amount}) ≠ paiement local (${expectedMinor}) pour ${pay.id}`,
          );
          await tx
            .update(payments)
            .set({
              failureReason: 'amount_mismatch',
              metadata: { webhookEvent: event.raw },
              updatedAt: new Date(),
            })
            .where(eq(payments.id, pay.id));
          return;
        }

        await tx
          .update(payments)
          .set({
            status: 'PAID',
            paidAt: new Date(),
            providerPaymentId: event.checkout.providerPaymentId ?? null,
            metadata: { webhookEvent: event.raw },
            failureReason: null,
            updatedAt: new Date(),
          })
          .where(eq(payments.id, pay.id));

        await tx
          .update(enrollments)
          .set({ status: 'ENROLLED' })
          .where(eq(enrollments.id, pay.enrollmentId));
        return;
      }

      if (kind === 'failed') {
        await tx
          .update(payments)
          .set({
            status: 'FAILED',
            failureReason:
              typeof event.checkout.raw === 'object' &&
              event.checkout.raw &&
              'message' in event.checkout.raw
                ? String((event.checkout.raw as { message?: unknown }).message)
                : 'checkout_failed',
            metadata: { webhookEvent: event.raw },
            updatedAt: new Date(),
          })
          .where(eq(payments.id, pay.id));
        return;
      }

      if (kind === 'cancelled') {
        await tx
          .update(payments)
          .set({
            status: 'CANCELLED',
            metadata: { webhookEvent: event.raw },
            updatedAt: new Date(),
          })
          .where(eq(payments.id, pay.id));
        await tx
          .update(enrollments)
          .set({ status: 'CANCELLED' })
          .where(eq(enrollments.id, pay.enrollmentId));
        return;
      }

      if (kind === 'expired') {
        await tx
          .update(payments)
          .set({
            status: 'EXPIRED',
            metadata: { webhookEvent: event.raw },
            updatedAt: new Date(),
          })
          .where(eq(payments.id, pay.id));
        await tx
          .update(enrollments)
          .set({ status: 'CANCELLED' })
          .where(eq(enrollments.id, pay.enrollmentId));
        return;
      }

      if (kind === 'processing') {
        await tx
          .update(payments)
          .set({
            status: 'PROCESSING',
            metadata: { webhookEvent: event.raw },
            updatedAt: new Date(),
          })
          .where(eq(payments.id, pay.id));
        return;
      }

      if (kind === 'pending') {
        await tx
          .update(payments)
          .set({
            status: 'PENDING',
            metadata: { webhookEvent: event.raw },
            updatedAt: new Date(),
          })
          .where(eq(payments.id, pay.id));
      }
    });

    return { received: true };
  }
}
