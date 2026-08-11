import { Module, forwardRef } from '@nestjs/common';
import { CertificatesRepository } from '@lib/repositories/certificates/certificates.repository';
import { EnrollmentsModule } from '@modules/enrollments/enrollments.module';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';

@Module({
  imports: [forwardRef(() => EnrollmentsModule)],
  controllers: [CertificatesController],
  providers: [CertificatesService, CertificatesRepository],
  exports: [CertificatesService, CertificatesRepository],
})
export class CertificatesModule {}
