import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import { FormationTrackingRepository } from '@lib/repositories/formation-tracking/formation-tracking.repository';
import { FormationsRepository } from '@lib/repositories/formations/formations.repository';
import { LanguagesRepository } from '@lib/repositories/languages/languages.repository';
import { LevelsRepository } from '@lib/repositories/levels/levels.repository';
import { RoomsRepository } from '@lib/repositories/rooms/rooms.repository';
import { EnrollmentsRepository } from '@lib/repositories/enrollments/enrollments.repository';
import { ScheduleConflictService } from '@lib/scheduling/schedule-conflict.service';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { TeacherAssignmentsService } from '@modules/teachers/teacher-assignments.service';
import { TeachersRepository } from '@modules/teachers/teachers.repository';
import { FormationsScheduleService } from './formations.service.schedule';

@Injectable()
export class FormationsService extends FormationsScheduleService {
  constructor(
    @Inject(FormationsRepository)
    formationsRepository: FormationsRepository,
    @Inject(LanguagesRepository) languagesRepository: LanguagesRepository,
    @Inject(LevelsRepository) levelsRepository: LevelsRepository,
    @Inject(TeacherAssignmentsService)
    teacherAssignmentsService: TeacherAssignmentsService,
    @Inject(ScheduleConflictService)
    scheduleConflictService: ScheduleConflictService,
    @Inject(RoomsRepository) roomsRepository: RoomsRepository,
    @Inject(TeachersRepository) teachersRepository: TeachersRepository,
    @Inject(FormationTrackingRepository)
    formationTrackingRepository: FormationTrackingRepository,
    @Inject(EnrollmentsRepository)
    enrollmentsRepository: EnrollmentsRepository,
    @Inject(NotificationsService)
    notificationsService: NotificationsService,
    @Inject(DRIZZLE_DB) db: DrizzleDB,
  ) {
    super(
      formationsRepository,
      languagesRepository,
      levelsRepository,
      teacherAssignmentsService,
      scheduleConflictService,
      roomsRepository,
      teachersRepository,
      formationTrackingRepository,
      enrollmentsRepository,
      notificationsService,
      db,
    );
  }
}
