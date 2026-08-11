import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import {
  formationSessions,
  formationTeachers,
  formations,
  teachers,
} from '@/database/schema';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { NotificationsService } from '@modules/notifications/notifications.service';

@Injectable()
export class TeacherAssignmentsService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Call before PATCH formation dates. Now a no-op: overlaps are managed at the
   * granular session level (see assignTeacherToFormation).
   */
  validateFormationScheduleForAssignedTeachers(): Promise<void> {
    return Promise.resolve();
  }

  async assignTeacherToFormation(
    adminUser: AuthUser,
    teacherId: string,
    formationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const teacherRow = await tx
        .select({ id: teachers.id })
        .from(teachers)
        .where(eq(teachers.id, teacherId))
        .limit(1);
      if (!teacherRow[0]) {
        throw new NotFoundException('Teacher not found');
      }

      const formationRow = await tx
        .select({
          id: formations.id,
          startDate: formations.startDate,
          endDate: formations.endDate,
        })
        .from(formations)
        .where(eq(formations.id, formationId))
        .limit(1);
      const formation = formationRow[0];
      if (!formation) {
        throw new NotFoundException('Formation not found');
      }

      if (!formation.startDate || !formation.endDate) {
        throw new BadRequestException(
          'Formation must have startDate and endDate before assignment',
        );
      }

      const existingAssignment = await tx
        .select({ id: formationTeachers.id })
        .from(formationTeachers)
        .where(
          and(
            eq(formationTeachers.teacherId, teacherId),
            eq(formationTeachers.formationId, formationId),
          ),
        )
        .limit(1);
      if (existingAssignment[0]) {
        throw new ConflictException(
          'Teacher already assigned to this formation',
        );
      }

      // Check for session conflicts if the formation already has sessions scheduled
      const teacherSessions = await tx
        .select({
          id: formationSessions.id,
          startAt: formationSessions.startAt,
          endAt: formationSessions.endAt,
          title: formationSessions.title,
        })
        .from(formationSessions)
        .innerJoin(
          formationTeachers,
          eq(formationTeachers.formationId, formationSessions.formationId),
        )
        .where(
          and(
            eq(formationTeachers.teacherId, teacherId),
            ne(formationSessions.status, 'CANCELLED'),
          ),
        );

      const targetSessions = await tx
        .select({
          id: formationSessions.id,
          startAt: formationSessions.startAt,
          endAt: formationSessions.endAt,
          title: formationSessions.title,
        })
        .from(formationSessions)
        .where(
          and(
            eq(formationSessions.formationId, formationId),
            ne(formationSessions.status, 'CANCELLED'),
          ),
        );

      for (const ts of targetSessions) {
        for (const es of teacherSessions) {
          if (ts.startAt < es.endAt && ts.endAt > es.startAt) {
            throw new ConflictException(
              `Conflit d'emploi du temps : la séance "${ts.title}" chevauche la séance "${es.title}" d'une autre formation de cet enseignant.`,
            );
          }
        }
      }

      const inserted = await tx
        .insert(formationTeachers)
        .values({
          teacherId,
          formationId,
          role: 'MAIN_TEACHER',
          assignedById: adminUser.id,
        })
        .returning();

      // Trigger notification after successful transaction (asynchronously)
      const teacherInfo = await tx
        .select({
          firstName: teachers.firstName,
          lastName: teachers.lastName,
          email: teachers.email,
        })
        .from(teachers)
        .where(eq(teachers.id, teacherId))
        .limit(1);

      const formationInfo = await tx
        .select({
          title: formations.title,
          startDate: formations.startDate,
          endDate: formations.endDate,
        })
        .from(formations)
        .where(eq(formations.id, formationId))
        .limit(1);

      const t = teacherInfo[0];
      const f = formationInfo[0];

      if (t && f && f.startDate && f.endDate) {
        void this.notificationsService.sendTeacherAssignmentNotification({
          teacherName: `${t.firstName} ${t.lastName}`,
          teacherEmail: t.email,
          formationTitle: f.title,
          startDate: f.startDate,
          endDate: f.endDate,
        });
      }

      return inserted[0];
    });
  }

  async unassignTeacherFromFormation(teacherId: string, formationId: string) {
    const deleted = await this.db
      .delete(formationTeachers)
      .where(
        and(
          eq(formationTeachers.teacherId, teacherId),
          eq(formationTeachers.formationId, formationId),
        ),
      )
      .returning({ id: formationTeachers.id });

    if (!deleted[0]) {
      throw new NotFoundException('Teacher assignment not found');
    }
  }
}
