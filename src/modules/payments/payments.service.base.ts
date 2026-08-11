import { Inject, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import { Payment } from '@/database/schema';
import { EnrollmentsRepository } from '@lib/repositories/enrollments/enrollments.repository';
import { FormationsRepository } from '@lib/repositories/formations/formations.repository';
import { UsersRepository } from '@lib/repositories/users/users.repository';
import {
  PAYMENT_PROVIDER,
  PaymentProvider,
} from './providers/payment-provider.interface';
import { PaymentsRepository } from './payments.repository';

export abstract class PaymentsServiceBase {
  protected readonly config: ConfigService;
  protected readonly paymentsRepository: PaymentsRepository;
  protected readonly enrollmentsRepository: EnrollmentsRepository;
  protected readonly usersRepository: UsersRepository;
  protected readonly formationsRepository: FormationsRepository;
  protected readonly provider: PaymentProvider;
  protected readonly db: DrizzleDB;
  protected readonly log: Logger;

  constructor(
    @Inject(ConfigService) config: ConfigService,
    @Inject(PaymentsRepository) paymentsRepository: PaymentsRepository,
    @Inject(EnrollmentsRepository) enrollmentsRepository: EnrollmentsRepository,
    @Inject(UsersRepository) usersRepository: UsersRepository,
    @Inject(FormationsRepository) formationsRepository: FormationsRepository,
    @Inject(PAYMENT_PROVIDER) provider: PaymentProvider,
    @Inject(DRIZZLE_DB) db: DrizzleDB,
  ) {
    this.config = config;
    this.paymentsRepository = paymentsRepository;
    this.enrollmentsRepository = enrollmentsRepository;
    this.usersRepository = usersRepository;
    this.formationsRepository = formationsRepository;
    this.provider = provider;
    this.db = db;
    this.log = new Logger(this.constructor.name);
  }

  mapToCheckoutDto(row: Payment) {
    return {
      id: row.id,
      status: row.status,
      amount: String(row.amount),
      currency: 'DZD' as const,
      checkoutUrl: row.checkoutUrl ?? null,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    };
  }

  protected assertPaidCheckoutAllowed(): void {
    const enabled =
      this.config.get<string>('PAYMENTS_ENABLED', 'false') === 'true';
    if (!enabled) {
      throw new ServiceUnavailableException(
        'Le paiement en ligne est désactivé pour le moment.',
      );
    }
  }

  /** Call before creating a paid enrollment so we fail before inserting state. */
  validatePaidPaymentsAvailable(): void {
    this.assertPaidCheckoutAllowed();
  }

  protected buildCheckoutUrls() {
    const appPublic = (
      this.config.get<string>('APP_PUBLIC_URL') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
    const successPath =
      this.config.get<string>('PAYMENT_SUCCESS_PATH') ?? '/payment/success';
    const failurePath =
      this.config.get<string>('PAYMENT_FAILURE_PATH') ?? '/payment/failure';
    const apiPublic = (
      this.config.get<string>('API_PUBLIC_URL') ??
      'http://localhost:3200/api/v1'
    ).replace(/\/$/, '');
    return {
      successUrl: `${appPublic}${successPath.startsWith('/') ? successPath : `/${successPath}`}`,
      failureUrl: `${appPublic}${failurePath.startsWith('/') ? failurePath : `/${failurePath}`}`,
      webhookEndpoint: `${apiPublic}/payments/webhook/chargily`,
    };
  }
}
