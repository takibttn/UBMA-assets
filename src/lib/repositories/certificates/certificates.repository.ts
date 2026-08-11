import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import { CertificatesVerifyRepository } from './certificates.repository.verify';

@Injectable()
export class CertificatesRepository extends CertificatesVerifyRepository {
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDB) {
    super(db);
  }
}
