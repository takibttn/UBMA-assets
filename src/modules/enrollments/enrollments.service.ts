import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CertificatesRepository } from '@lib/repositories/certificates/certificates.repository';
import { EnrollmentsRepository } from '@lib/repositories/enrollments/enrollments.repository';
import { FormationsRepository } from '@lib/repositories/formations/formations.repository';
import { UsersRepository } from '@lib/repositories/users/users.repository';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { PaymentsService } from '@modules/payments/payments.service';
import { EnrollmentsAdminService } from './enrollments.service.admin';

@Injectable()
export class EnrollmentsService extends EnrollmentsAdminService {
  constructor(
    @Inject(EnrollmentsRepository)
    enrollmentsRepository: EnrollmentsRepository,
    @Inject(FormationsRepository) formationsRepository: FormationsRepository,
    @Inject(UsersRepository) usersRepository: UsersRepository,
    @Inject(NotificationsService) notificationsService: NotificationsService,
    @Inject(ConfigService) configService: ConfigService,
    @Inject(CertificatesRepository)
    certificatesRepository: CertificatesRepository,
    @Inject(forwardRef(() => PaymentsService))
    paymentsService: PaymentsService,
  ) {
    super(
      enrollmentsRepository,
      formationsRepository,
      usersRepository,
      notificationsService,
      configService,
      certificatesRepository,
      paymentsService,
    );
  }
}
