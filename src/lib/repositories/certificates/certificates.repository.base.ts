import { Inject } from '@nestjs/common';
import { count, eq } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import {
  certificates,
  enrollments,
  Certificate,
  NewCertificate,
} from '@/database/schema';
import { BaseRepository } from '@common/repositories/base.repository';

export abstract class CertificatesBaseRepository extends BaseRepository {
  protected readonly db: DrizzleDB;
  constructor(@Inject(DRIZZLE_DB) db: DrizzleDB) {
    super();
    this.db = db;
  }

  async create(data: NewCertificate): Promise<Certificate> {
    const result = await this.db.insert(certificates).values(data).returning();
    return result[0];
  }

  async findByEnrollment(
    enrollmentId: string,
  ): Promise<Certificate | undefined> {
    const result = await this.db
      .select()
      .from(certificates)
      .where(eq(certificates.enrollmentId, enrollmentId))
      .limit(1);
    return result[0];
  }

  async deleteByEnrollment(enrollmentId: string): Promise<void> {
    await this.db
      .delete(certificates)
      .where(eq(certificates.enrollmentId, enrollmentId));
  }

  async countByStudentId(studentId: string): Promise<number> {
    const result = await this.db
      .select({ total: count() })
      .from(certificates)
      .innerJoin(enrollments, eq(certificates.enrollmentId, enrollments.id))
      .where(eq(enrollments.studentId, studentId));
    return Number(result[0]?.total ?? 0);
  }
}
