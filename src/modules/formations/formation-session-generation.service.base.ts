import { BadRequestException, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import { rooms } from '@/database/schema';
import { FormationsRepository } from '@lib/repositories/formations/formations.repository';
import { RoomsRepository } from '@lib/repositories/rooms/rooms.repository';
import { ScheduleConflictService } from '@lib/scheduling/schedule-conflict.service';
import type { ScheduleConflictResult } from '@lib/scheduling/schedule-conflict.types';
import { GenerateFormationSessionsDto } from './dto/generate-formation-sessions.dto';
import { FormationSessionsService } from './formation-sessions.service';

export type RoomRow = typeof rooms.$inferSelect;

export abstract class FormationSessionGenerationServiceBase {
  protected readonly db: DrizzleDB;
  protected readonly formationsRepository: FormationsRepository;
  protected readonly roomsRepository: RoomsRepository;
  protected readonly scheduleConflictService: ScheduleConflictService;
  protected readonly formationSessionsService: FormationSessionsService;

  constructor(
    @Inject(DRIZZLE_DB) db: DrizzleDB,
    @Inject(FormationsRepository)
    formationsRepository: FormationsRepository,
    @Inject(RoomsRepository) roomsRepository: RoomsRepository,
    @Inject(ScheduleConflictService)
    scheduleConflictService: ScheduleConflictService,
    @Inject(FormationSessionsService)
    formationSessionsService: FormationSessionsService,
  ) {
    this.db = db;
    this.formationsRepository = formationsRepository;
    this.roomsRepository = roomsRepository;
    this.scheduleConflictService = scheduleConflictService;
    this.formationSessionsService = formationSessionsService;
  }

  protected dedupeRooms(
    items: ScheduleConflictResult['roomConflicts'],
  ): ScheduleConflictResult['roomConflicts'] {
    const seen = new Set<string>();
    return items.filter((i) => {
      const k = `${i.sessionId}:${i.startAt}:${i.roomId}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  protected dedupeTeachers(
    items: ScheduleConflictResult['teacherConflicts'],
  ): ScheduleConflictResult['teacherConflicts'] {
    const seen = new Set<string>();
    return items.filter((i) => {
      const k = `${i.sessionId}:${i.startAt}:${i.teacherId}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  protected dedupeFormations(
    items: ScheduleConflictResult['formationConflicts'],
  ): ScheduleConflictResult['formationConflicts'] {
    const seen = new Set<string>();
    return items.filter((i) => {
      const k = `${i.sessionId}:${i.startAt}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  protected async loadActiveRoomsForDto(
    dto: GenerateFormationSessionsDto,
  ): Promise<Map<string, RoomRow>> {
    const roomIds = [...new Set(dto.weeklySlots.map((s) => s.roomId))];
    const roomRows = await this.roomsRepository.findManyByIds(roomIds);
    const foundIds = new Set(roomRows.map((r) => r.id));
    const missing = roomIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) throw new NotFoundException('Room not found');
    for (const r of roomRows) {
      if (!r.isActive) {
        throw new BadRequestException('Room is not active');
      }
    }
    return new Map(roomRows.map((r) => [r.id, r] as const));
  }
}
