import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { isFormationFree } from '@modules/payments/utils/payment-amount.util';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { EnrollmentsServiceBase } from './enrollments.service.base';

export abstract class EnrollmentsEnrollService extends EnrollmentsServiceBase {
  async retryEnrollmentPayment(user: AuthUser, enrollmentId: string) {
    const payment =
      await this.paymentsService.createOrReuseCheckoutForPendingEnrollment(
        enrollmentId,
        user.id,
      );
    const enrollment = await this.enrollmentsRepository.findById(enrollmentId);
    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }
    return {
      enrollment: await this.buildEnrollmentWithFormation(enrollment),
      payment,
    };
  }

  async enrollStudent(user: AuthUser, dto: CreateEnrollmentDto) {
    const formation = await this.formationsRepository.findById(dto.formationId);
    if (!formation) {
      throw new NotFoundException('Formation not found');
    }

    if (!formation.isSaleOpen) {
      throw new BadRequestException(
        'Les inscriptions sont fermées pour cette formation.',
      );
    }

    const existingEnrolled =
      await this.enrollmentsRepository.findEnrolledByStudentAndFormation(
        user.id,
        dto.formationId,
      );
    if (existingEnrolled) {
      throw new ConflictException('Vous êtes déjà inscrit à cette formation.');
    }

    const anyEnrollment =
      await this.enrollmentsRepository.findByStudentAndFormation(
        user.id,
        dto.formationId,
      );

    const free = isFormationFree(formation.price);

    const assertCapacityIfNeeded = async () => {
      if (formation.capacity === null) return;
      const reserved =
        await this.enrollmentsRepository.countReservedByFormation(
          dto.formationId,
        );
      if (reserved >= formation.capacity) {
        throw new BadRequestException('Cette formation est complète.');
      }
    };

    // Existing row: awaiting payment — return or refresh checkout (same seat).
    if (anyEnrollment?.status === 'PENDING_PAYMENT') {
      const payment =
        await this.paymentsService.createOrReuseCheckoutForPendingEnrollment(
          anyEnrollment.id,
          user.id,
        );
      return {
        enrollment: await this.buildEnrollmentWithFormation(anyEnrollment),
        paymentRequired: true,
        payment,
      };
    }

    // Revive cancelled enrollment (same studentId + formationId row).
    if (anyEnrollment?.status === 'CANCELLED') {
      await assertCapacityIfNeeded();
      if (free) {
        await this.enrollmentsRepository.updateEnrollment(anyEnrollment.id, {
          status: 'ENROLLED',
          enrolledAt: new Date(),
        });
        const revived = await this.enrollmentsRepository.findById(
          anyEnrollment.id,
        );
        if (!revived) {
          throw new NotFoundException('Enrollment not found');
        }
        this.triggerEnrollmentNotification(
          user.id,
          formation.title,
          revived.id,
        ).catch(() => {});
        return {
          enrollment: await this.buildEnrollmentWithFormation(revived),
          paymentRequired: false,
        };
      }

      this.paymentsService.validatePaidPaymentsAvailable();
      await this.enrollmentsRepository.updateEnrollment(anyEnrollment.id, {
        status: 'PENDING_PAYMENT',
        enrolledAt: new Date(),
      });
      const pending = await this.enrollmentsRepository.findById(
        anyEnrollment.id,
      );
      if (!pending) {
        throw new NotFoundException('Enrollment not found');
      }
      const payment =
        await this.paymentsService.createCheckoutForPendingEnrollment({
          enrollmentId: pending.id,
          studentId: user.id,
          formationId: dto.formationId,
          formationPrice: formation.price,
          formationTitle: formation.title,
        });
      return {
        enrollment: await this.buildEnrollmentWithFormation(pending),
        paymentRequired: true,
        payment,
      };
    }

    // New enrollment row
    await assertCapacityIfNeeded();
    if (free) {
      const enrollment = await this.enrollmentsRepository.create({
        studentId: user.id,
        formationId: dto.formationId,
        status: 'ENROLLED',
      });
      this.triggerEnrollmentNotification(
        user.id,
        formation.title,
        enrollment.id,
      ).catch(() => {});
      return {
        enrollment: await this.buildEnrollmentWithFormation(enrollment),
        paymentRequired: false,
      };
    }

    this.paymentsService.validatePaidPaymentsAvailable();
    const enrollment = await this.enrollmentsRepository.create({
      studentId: user.id,
      formationId: dto.formationId,
      status: 'PENDING_PAYMENT',
    });

    const payment =
      await this.paymentsService.createCheckoutForPendingEnrollment({
        enrollmentId: enrollment.id,
        studentId: user.id,
        formationId: dto.formationId,
        formationPrice: formation.price,
        formationTitle: formation.title,
      });
    return {
      enrollment: await this.buildEnrollmentWithFormation(enrollment),
      paymentRequired: true,
      payment,
    };
  }
}
