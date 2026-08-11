import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@/database/database.module';
import { EnrollmentsModule } from '@modules/enrollments/enrollments.module';
import { FormationsRepository } from '@lib/repositories/formations/formations.repository';
import { UsersRepository } from '@lib/repositories/users/users.repository';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repository';
import { ChargilyPaymentProvider } from './providers/chargily-payment.provider';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';

@Module({
  imports: [ConfigModule, DatabaseModule, forwardRef(() => EnrollmentsModule)],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentsRepository,
    FormationsRepository,
    UsersRepository,
    ChargilyPaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      useExisting: ChargilyPaymentProvider,
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
