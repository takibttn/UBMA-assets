import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import { mapFormationBaseDto } from '@lib/formations/formation-base.mapper';
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
import { FormationAnalyticsStatus } from './dto/admin-formation-analytics.dto';

@Injectable()
export abstract class FormationsServiceBase {
  protected readonly formationsRepository: FormationsRepository;
  protected readonly languagesRepository: LanguagesRepository;
  protected readonly levelsRepository: LevelsRepository;
  protected readonly teacherAssignmentsService: TeacherAssignmentsService;
  protected readonly scheduleConflictService: ScheduleConflictService;
  protected readonly roomsRepository: RoomsRepository;
  protected readonly teachersRepository: TeachersRepository;
  protected readonly formationTrackingRepository: FormationTrackingRepository;
  protected readonly enrollmentsRepository: EnrollmentsRepository;
  protected readonly notificationsService: NotificationsService;
  protected readonly db: DrizzleDB;

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
    this.formationsRepository = formationsRepository;
    this.languagesRepository = languagesRepository;
    this.levelsRepository = levelsRepository;
    this.teacherAssignmentsService = teacherAssignmentsService;
    this.scheduleConflictService = scheduleConflictService;
    this.roomsRepository = roomsRepository;
    this.teachersRepository = teachersRepository;
    this.formationTrackingRepository = formationTrackingRepository;
    this.enrollmentsRepository = enrollmentsRepository;
    this.notificationsService = notificationsService;
    this.db = db;
  }

  protected async validateLanguageAndLevel(
    languageId: string,
    levelId: string,
  ) {
    const language = await this.languagesRepository.findById(languageId);
    if (!language || !language.isActive) {
      throw new BadRequestException('Language not found or inactive');
    }

    const level = await this.levelsRepository.findById(levelId);
    if (!level || !level.isActive) {
      throw new BadRequestException('Level not found or inactive');
    }

    if (level.languageId !== languageId) {
      throw new BadRequestException('Level does not belong to language');
    }
  }

  protected mapFormationListOrDetailRow(
    row: Omit<
      Parameters<typeof mapFormationBaseDto>[0],
      'description' | 'id'
    > & {
      id: string;
      description: string | null;
      creatorId: string | null;
      languageId: string | null;
      levelId: string | null;
      assignedTeacherId?: string | null;
      assignedTeacherFirstName?: string | null;
      assignedTeacherLastName?: string | null;
      assignedTeacherEmail?: string | null;
    },
  ) {
    const core = mapFormationBaseDto(
      {
        id: row.id,
        title: row.title,
        description: row.description,
        price: row.price,
        capacity: row.capacity,
        isSaleOpen: row.isSaleOpen,
        startDate: row.startDate,
        endDate: row.endDate,
        createdAt: row.createdAt,
        enrolledCount: row.enrolledCount,
        reservedCount: row.reservedCount,
        language: row.language,
        level: row.level,
      },
      { includeCreatedAt: true },
    );
    const isTeacherAssigned = !!row.assignedTeacherId;
    const assignedTeacher = isTeacherAssigned
      ? {
          id: row.assignedTeacherId as string,
          firstName: row.assignedTeacherFirstName ?? null,
          lastName: row.assignedTeacherLastName ?? null,
          email: row.assignedTeacherEmail ?? null,
        }
      : null;
    return {
      ...core,
      creatorId: row.creatorId,
      languageId: row.languageId,
      levelId: row.levelId,
      isTeacherAssigned,
      assignedTeacher,
    };
  }

  protected classifyFormationStatus(
    formation: {
      isSaleOpen: boolean;
      startDate: Date | null;
      endDate: Date | null;
    },
    now: Date,
  ): FormationAnalyticsStatus {
    if (formation.endDate && formation.endDate < now) return 'ENDED';
    if (formation.startDate && formation.startDate > now) return 'UPCOMING';
    if (!formation.isSaleOpen) return 'CLOSED';
    return 'OPEN';
  }
}
