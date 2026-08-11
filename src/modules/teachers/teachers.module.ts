import { Module } from '@nestjs/common';
import { EnrollmentsModule } from '@modules/enrollments/enrollments.module';
import { FormationInsightsModule } from '@lib/formation-insights/formation-insights.module';
import { TeachersController } from './teachers.controller';
import { TeachersMeController } from './teachers-me.controller';
import { TeachersService } from './teachers.service';
import { SessionAttendanceService } from './session-attendance.service';
import { TeachersRepository } from './teachers.repository';
import { TeacherAssignmentsService } from './teacher-assignments.service';
import { TeacherFormationTrackingService } from './teacher-formation-tracking.service';
import { FormationSessionsRepository } from '@lib/repositories/formation-sessions/formation-sessions.repository';
import { SessionAttendanceRepository } from '@lib/repositories/session-attendance/session-attendance.repository';
import { TeacherFormationAccessGuard } from './guards/teacher-formation-access.guard';
import { NotificationsModule } from '@modules/notifications/notifications.module';

@Module({
  imports: [EnrollmentsModule, FormationInsightsModule, NotificationsModule],
  controllers: [TeachersMeController, TeachersController],
  providers: [
    TeachersService,
    SessionAttendanceService,
    TeachersRepository,
    TeacherAssignmentsService,
    TeacherFormationAccessGuard,
    FormationSessionsRepository,
    SessionAttendanceRepository,
    TeacherFormationTrackingService,
  ],
  exports: [TeachersService, TeachersRepository, TeacherAssignmentsService],
})
export class TeachersModule {}
