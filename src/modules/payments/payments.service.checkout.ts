import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  formationPriceToMinorDzd,
  minorDzdToDecimalString,
} from './utils/payment-amount.util';
import { PaymentsServiceBase } from './payments.service.base';

export abstract class PaymentsCheckoutService extends PaymentsServiceBase {
  /**
   * Creates a provider checkout for an enrollment already in PENDING_PAYMENT.
   */
  async createCheckoutForPendingEnrollment(params: {
    enrollmentId: string;
    studentId: string;
    formationId: string;
    formationPrice: unknown;
    formationTitle: string;
  }): Promise<ReturnType<PaymentsServiceBase['mapToCheckoutDto']>> {
    this.assertPaidCheckoutAllowed();
    const minor = formationPriceToMinorDzd(params.formationPrice);
    if (minor === null) {
      throw new BadRequestException('Formation gratuite — paiement inattendu');
    }
    const amountStr = minorDzdToDecimalString(minor);
    const student = await this.usersRepository.findById(params.studentId);
    if (!student) {
      throw new NotFoundException('Étudiant introuvable');
    }

    const payRow = await this.paymentsRepository.insertPayment({
      enrollmentId: params.enrollmentId,
      studentId: params.studentId,
      formationId: params.formationId,
      provider: this.provider.name,
      amount: amountStr,
      currency: 'DZD',
      status: 'PENDING',
    });

    const urls = this.buildCheckoutUrls();
    const fullName = `${student.firstName} ${student.lastName}`.trim();

    try {
      const result = await this.provider.createCheckout({
        localPaymentId: payRow.id,
        enrollmentId: params.enrollmentId,
        formationId: params.formationId,
        studentId: params.studentId,
        amount: amountStr,
        amountMinor: minor,
        currency: 'dzd',
        description: `Formation: ${params.formationTitle}`,
        customer: { name: fullName || 'Apprenant', email: student.email },
        successUrl: urls.successUrl,
        failureUrl: urls.failureUrl,
        webhookEndpoint: urls.webhookEndpoint,
        metadata: {
          localPaymentId: payRow.id,
          enrollmentId: params.enrollmentId,
          formationId: params.formationId,
          studentId: params.studentId,
        },
      });

      const expiresAt =
        result.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000);

      await this.paymentsRepository.updatePayment(payRow.id, {
        providerCheckoutId: result.providerCheckoutId,
        checkoutUrl: result.checkoutUrl,
        expiresAt,
        metadata: { providerCreate: result.raw },
      });

      const fresh = await this.paymentsRepository.findById(payRow.id);
      if (!fresh) {
        throw new BadRequestException('Paiement introuvable après création');
      }
      return this.mapToCheckoutDto(fresh);
    } catch (err) {
      await this.paymentsRepository.updatePayment(payRow.id, {
        status: 'FAILED',
        failureReason:
          err instanceof Error ? err.message : 'checkout_creation_failed',
      });
      throw err;
    }
  }

  /**
   * Reuses non-expired PENDING/PROCESSING checkout or creates a new payment attempt.
   */
  async createOrReuseCheckoutForPendingEnrollment(
    enrollmentId: string,
    studentId: string,
  ): Promise<ReturnType<PaymentsServiceBase['mapToCheckoutDto']>> {
    const enrollment = await this.enrollmentsRepository.findById(enrollmentId);
    if (!enrollment || enrollment.studentId !== studentId) {
      throw new NotFoundException('Inscription introuvable');
    }
    if (enrollment.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException(
        "Cette inscription n'attend pas de paiement.",
      );
    }

    const open =
      await this.paymentsRepository.findLatestOpenCheckoutForEnrollment(
        enrollmentId,
      );
    if (open) {
      return this.mapToCheckoutDto(open);
    }

    const formation = await this.formationsRepository.findById(
      enrollment.formationId,
    );
    if (!formation) {
      throw new NotFoundException('Formation introuvable');
    }

    return this.createCheckoutForPendingEnrollment({
      enrollmentId,
      studentId,
      formationId: enrollment.formationId,
      formationPrice: formation.price,
      formationTitle: formation.title,
    });
  }
}
