import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_DB, DrizzleDB } from '@/database/database.module';
import { formationSessions } from '@/database/schema';
import { FormationsRepository } from '@lib/repositories/formations/formations.repository';
import { RoomsRepository } from '@lib/repositories/rooms/rooms.repository';
import { ScheduleConflictService } from '@lib/scheduling/schedule-conflict.service';
import type { AuthUser } from '@modules/auth/types/auth-user.type';
import { GenerateFormationSessionsDto } from './dto/generate-formation-sessions.dto';
import type { GeneratedSessionPreviewItemDto } from './dto/generated-sessions-preview-response.dto';
import { FormationSessionsService } from './formation-sessions.service';
import { FormationSessionGenerationServicePlan } from './formation-session-generation.service.plan';

export type { RoomRow } from './formation-session-generation.service.base';

@Injectable()
export class FormationSessionGenerationService extends FormationSessionGenerationServicePlan {
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
    super(
      db,
      formationsRepository,
      roomsRepository,
      scheduleConflictService,
      formationSessionsService,
    );
  }

  async generateSessions(
    formationId: string,
    dto: GenerateFormationSessionsDto,
    user: AuthUser,
  ) {
    const formation = await this.formationsRepository.findById(formationId);
    if (!formation) throw new NotFoundException('Formation not found');

    const candidates = this.buildSessionCandidates(formation, dto);
    const roomById = await this.loadActiveRoomsForDto(dto);
    if (candidates.length === 0) {
      return {
        created: [] as Awaited<
          ReturnType<FormationSessionsService['listSessions']>
        >,
        summary: { createdCount: 0 },
      };
    }

    const previewItems = await this.validateGeneratedSessions(
      formationId,
      formation,
      candidates,
      roomById,
    );
    const conflicting = previewItems.filter(
      (i) => i.conflictStatus === 'CONFLICT',
    );
    if (conflicting.length > 0) {
      this.throwGenerateConflict(previewItems);
    }

    const values = candidates.map((c) => ({
      formationId,
      roomId: c.roomId,
      title: c.title,
      description: c.description,
      startAt: c.startAt,
      endAt: c.endAt,
      status: 'SCHEDULED' as const,
      createdById: user.id,
    }));

    const inserted = await this.db.transaction(async (tx) => {
      return tx.insert(formationSessions).values(values).returning({
        id: formationSessions.id,
      });
    });

    const ids = inserted.map((r) => r.id);
    const list = await this.formationSessionsService.listSessions(formationId);
    const byId = new Map(list.map((s) => [s.id, s] as const));
    const created = ids
      .map((id) => byId.get(id))
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    return {
      created,
      summary: { createdCount: created.length },
    };
  }

  private throwGenerateConflict(
    items: GeneratedSessionPreviewItemDto[],
  ): never {
    const conflicting = items.filter((i) => i.conflictStatus === 'CONFLICT');
    const roomConflicts = this.dedupeRooms(
      conflicting.flatMap((i) => i.roomConflicts),
    );
    const teacherConflicts = this.dedupeTeachers(
      conflicting.flatMap((i) => i.teacherConflicts),
    );
    const formationConflicts = this.dedupeFormations(
      conflicting.flatMap((i) => i.formationConflicts),
    );
    const candidateConflicts = conflicting.map((i) => ({
      tempId: i.tempId,
      roomConflicts: i.roomConflicts,
      teacherConflicts: i.teacherConflicts,
      formationConflicts: i.formationConflicts,
    }));

    throw new ConflictException({
      message: 'Schedule conflict detected',
      roomConflicts,
      teacherConflicts,
      formationConflicts,
      candidateConflicts,
    });
  }
}
