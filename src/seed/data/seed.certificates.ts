import { and, eq, like } from 'drizzle-orm';
import { certificates, enrollments, formations } from '@/database/schema';
import type { AcademicSeedContext } from './context';
import { buildCertificateNumber, buildVerificationCode } from './context';

/** Certificates only for ENROLLED rows on `CEIL Academic Formation%` titles (seed cohort). */
export async function seedCertificatesForActiveEnrollments(
  ctx: AcademicSeedContext,
): Promise<void> {
  const { db } = ctx;
  const rows = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .innerJoin(formations, eq(enrollments.formationId, formations.id))
    .where(
      and(
        eq(enrollments.status, 'ENROLLED'),
        like(formations.title, 'CEIL Academic Formation%'),
      ),
    );

  for (const row of rows) {
    const has = await db
      .select({ id: certificates.id })
      .from(certificates)
      .where(eq(certificates.enrollmentId, row.id))
      .limit(1);
    if (has[0]) continue;

    await db.insert(certificates).values({
      enrollmentId: row.id,
      certificateNumber: buildCertificateNumber(row.id),
      verificationCode: buildVerificationCode(row.id),
      pdfUrl: `https://ceil.local/certificates/${row.id}.pdf`,
    });
    ctx.counters.certificatesInserted += 1;
  }
}
