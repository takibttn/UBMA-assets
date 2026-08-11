import { Injectable, Inject } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import { enrollments, sessionAttendance, users } from '@/database/schema';

@Injectable()
export class SessionAttendanceRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  async listRowsForSession(sessionId: string, formationId: string) {
    return this.db
      .select({
        enrollmentId: enrollments.id,
        student: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          matricule: users.matricule,
          email: users.email,
        },
        attendanceId: sessionAttendance.id,
        status: sessionAttendance.status,
        markedAt: sessionAttendance.markedAt,
      })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.studentId, users.id))
      .leftJoin(
        sessionAttendance,
        and(
          eq(sessionAttendance.enrollmentId, enrollments.id),
          eq(sessionAttendance.sessionId, sessionId),
        ),
      )
      .where(
        and(
          eq(enrollments.formationId, formationId),
          eq(enrollments.status, 'ENROLLED'),
        ),
      )
      .orderBy(asc(users.lastName), asc(users.firstName));
  }

  async upsertMany(
    sessionId: string,
    teacherId: string,
    marks: Array<{
      enrollmentId: string;
      status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    }>,
  ): Promise<void> {
    const now = new Date();
    for (const r of marks) {
      await this.db
        .insert(sessionAttendance)
        .values({
          sessionId,
          enrollmentId: r.enrollmentId,
          status: r.status,
          markedAt: now,
          markedByTeacherId: teacherId,
        })
        .onConflictDoUpdate({
          target: [sessionAttendance.sessionId, sessionAttendance.enrollmentId],
          set: {
            status: r.status,
            markedAt: now,
            markedByTeacherId: teacherId,
            updatedAt: now,
          },
        });
    }
  }
}
