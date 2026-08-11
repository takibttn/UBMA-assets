import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import { EnrollmentsRepository } from '@lib/repositories/enrollments/enrollments.repository';
import { FormationsRepository } from '@lib/repositories/formations/formations.repository';
import { UsersRepository } from '@lib/repositories/users/users.repository';
import {
  PAYMENT_PROVIDER,
  PaymentProvider,
} from './providers/payment-provider.interface';
import { PaymentsRepository } from './payments.repository';
import { PaymentsListService } from './payments.service.list';

@Injectable()
export class PaymentsService extends PaymentsListService {
  constructor(
    @Inject(ConfigService) config: ConfigService,
    @Inject(PaymentsRepository) paymentsRepository: PaymentsRepository,
    @Inject(EnrollmentsRepository) enrollmentsRepository: EnrollmentsRepository,
    @Inject(UsersRepository) usersRepository: UsersRepository,
    @Inject(FormationsRepository) formationsRepository: FormationsRepository,
    @Inject(PAYMENT_PROVIDER) provider: PaymentProvider,
    @Inject(DRIZZLE_DB) db: DrizzleDB,
  ) {
    super(
      config,
      paymentsRepository,
      enrollmentsRepository,
      usersRepository,
      formationsRepository,
      provider,
      db,
    );
  }
}
