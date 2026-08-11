import { BadRequestException, NotFoundException } from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import {
  formationSessions,
  formationTeachers,
  formations,
  teachers,
} from '@/database/schema';
import type { Formation } from '@/database/schema';
import { CreateFormationWithSessionsDto } from './dto/create-formation-with-sessions.dto';
import {
  assertRoomFitsFormationCapacity,
  assertSessionWindow,
} from './formation-session-validation.util';
import { FormationsWriteService } from './formations.service.write';

export abstract class FormationsScheduleService extends FormationsWriteService {
  async createFormationWithSessions(
    user: AuthUser,
    dto: CreateFormationWithSessionsDto,
  ) {
    await this.validateLanguageAndLevel(
      dto.formation.languageId,
      dto.formation.levelId,
    );

    const startDate = new Date(dto.formation.startDate);
    const endDate = new Date(dto.formation.endDate);
    if (startDate >= endDate) {
      throw new BadRequestException('startDate must be before endDate');
    }

    if (!dto.teacherIds.length) {
      throw new BadRequestException('teacherIds is required');
    }
    if (new Set(dto.teacherIds).size !== dto.teacherIds.length) {
      throw new BadRequestException('Duplicate teacher ids');
    }
    if (!dto.sessions.length) {
      throw new BadRequestException('sessions is required');
    }

    const teacherRows = await this.db
      .select({ id: teachers.id })
      .from(teachers)
      .where(inArray(teachers.id, dto.teacherIds));
    if (teacherRows.length !== dto.teacherIds.length) {
      throw new NotFoundException('One or more teachers not found');
    }

    const formationForValidation = {
      startDate,
      endDate,
      capacity: dto.formation.capacity ?? null,
    } as Formation;

    const parsedSessions = dto.sessions.map((s, index) => ({
      ...s,
      startAt: new Date(s.startAt),
      endAt: new Date(s.endAt),
      index,
    }));

    this.scheduleConflictService.assertNoInternalSessionOverlaps(
      parsedSessions.map((s) => ({
        startAt: s.startAt,
        endAt: s.endAt,
        index: s.index,
      })),
    );

    for (const s of parsedSessions) {
      const room = await this.roomsRepository.findById(s.roomId);
      if (!room) {
        throw new NotFoundException('Room not found');
      }
      if (!room.isActive) {
        throw new BadRequestException('Room is not active');
      }
      assertSessionWindow(formationForValidation, s.startAt, s.endAt);
      assertRoomFitsFormationCapacity(formationForValidation, room.capacity);
    }

    const formationId = await this.db.transaction(async (tx) => {
      const [formation] = await tx
        .insert(formations)
        .values({
          title: dto.formation.title,
          description: dto.formation.description ?? null,
          languageId: dto.formation.languageId,
          levelId: dto.formation.levelId,
          creatorId: user.id,
          price: dto.formation.price?.toString() ?? '0',
          capacity: dto.formation.capacity,
          startDate,
          endDate,
          isSaleOpen: dto.formation.isSaleOpen ?? true,
        })
        .returning();

      for (const tid of dto.teacherIds) {
        await tx.insert(formationTeachers).values({
          formationId: formation.id,
          teacherId: tid,
          role: 'MAIN_TEACHER',
          assignedById: user.id,
        });
      }

      for (const s of parsedSessions) {
        const check = await this.scheduleConflictService.checkSessionConflicts(
          {
            formationId: formation.id,
            roomId: s.roomId,
            startAt: s.startAt,
            endAt: s.endAt,
          },
          tx,
        );
        this.scheduleConflictService.assertNoConflicts(check);

        const title = s.title?.trim() || `${formation.title} - Séance`;
        await tx.insert(formationSessions).values({
          formationId: formation.id,
          roomId: s.roomId,
          title,
          description: s.description ?? null,
          startAt: s.startAt,
          endAt: s.endAt,
          status: 'SCHEDULED',
          createdById: user.id,
        });
      }

      return formation.id;
    });

    return this.getFormationById(formationId, user);
  }
}
