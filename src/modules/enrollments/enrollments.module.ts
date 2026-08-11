import { Module, forwardRef } from '@nestjs/common';
import { EnrollmentsRepository } from '@lib/repositories/enrollments/enrollments.repository';
import { FormationsRepository } from '@lib/repositories/formations/formations.repository';
import { UsersRepository } from '@lib/repositories/users/users.repository';
import { CertificatesModule } from '@modules/certificates/certificates.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { PaymentsModule } from '@modules/payments/payments.module';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';

@Module({
  imports: [
    NotificationsModule,
    forwardRef(() => CertificatesModule),
    forwardRef(() => PaymentsModule),
  ],
  controllers: [EnrollmentsController],
  providers: [
    EnrollmentsService,
    EnrollmentsRepository,
    FormationsRepository,
    UsersRepository,
  ],
  exports: [EnrollmentsService, EnrollmentsRepository],
})
export class EnrollmentsModule {}
