import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { NewFormationSession } from '@/database/schema';
import { CreateFormationSessionDto } from './dto/create-formation-session.dto';
import { UpdateFormationSessionDto } from './dto/update-formation-session.dto';
import type { AuthUser } from '@modules/auth/types/auth-user.type';
import {
  assertRoomFitsFormationCapacity,
  assertSessionWindow,
} from './formation-session-validation.util';
import { FormationSessionsServiceBase } from './formation-sessions.service.base';

export abstract class FormationSessionsServiceCrud extends FormationSessionsServiceBase {
  async createSession(
    user: AuthUser,
    formationId: string,
    dto: CreateFormationSessionDto,
  ) {
    const formation = await this.formationsRepository.findById(formationId);
    if (!formation) throw new NotFoundException('Formation not found');

    const room = await this.roomsRepository.findById(dto.roomId);
    if (!room) throw new NotFoundException('Room not found');
    if (!room.isActive) {
      throw new BadRequestException('Room is not active');
    }

    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    assertSessionWindow(formation, startAt, endAt);
    assertRoomFitsFormationCapacity(formation, room.capacity);

    const title = dto.title?.trim() || `${formation.title} - Séance`;

    const result = await this.scheduleConflictService.checkSessionConflicts({
      formationId,
      roomId: dto.roomId,
      startAt,
      endAt,
    });
    this.scheduleConflictService.assertNoConflicts(result);

    const inserted = await this.sessionsRepository.create({
      formationId,
      roomId: dto.roomId,
      title,
      description: dto.description ?? null,
      startAt,
      endAt,
      status: 'SCHEDULED',
      createdById: user.id,
    });

    return this.getSession(formationId, inserted.id);
  }

  async updateSession(
    formationId: string,
    sessionId: string,
    dto: UpdateFormationSessionDto,
  ) {
    const existing = await this.sessionsRepository.findByIdInFormation(
      formationId,
      sessionId,
    );
    if (!existing) throw new NotFoundException('Session not found');

    const formation = await this.formationsRepository.findById(formationId);
    if (!formation) throw new NotFoundException('Formation not found');

    const roomId = dto.roomId ?? existing.roomId;
    const room = await this.roomsRepository.findById(roomId);
    if (!room) throw new NotFoundException('Room not found');
    if (!room.isActive && dto.roomId !== undefined) {
      throw new BadRequestException('Room is not active');
    }

    const startAt = dto.startAt ? new Date(dto.startAt) : existing.startAt;
    const endAt = dto.endAt ? new Date(dto.endAt) : existing.endAt;

    assertSessionWindow(formation, startAt, endAt);
    assertRoomFitsFormationCapacity(formation, room.capacity);

    const nextStatus = dto.status ?? existing.status;
    const roomOrTimeChanged =
      dto.roomId !== undefined ||
      dto.startAt !== undefined ||
      dto.endAt !== undefined;
    const reactivating =
      existing.status === 'CANCELLED' && nextStatus !== 'CANCELLED';

    if (nextStatus !== 'CANCELLED' && (roomOrTimeChanged || reactivating)) {
      const res = await this.scheduleConflictService.checkSessionConflicts({
        formationId,
        roomId,
        startAt,
        endAt,
        excludeSessionId: sessionId,
      });
      this.scheduleConflictService.assertNoConflicts(res);
    }

    const patch: Partial<NewFormationSession> = {};
    if (dto.title !== undefined) patch.title = dto.title.trim();
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.roomId !== undefined) patch.roomId = dto.roomId;
    if (dto.startAt !== undefined) patch.startAt = startAt;
    if (dto.endAt !== undefined) patch.endAt = endAt;
    if (dto.status !== undefined) patch.status = dto.status;

    await this.sessionsRepository.update(formationId, sessionId, patch);

    return this.getSession(formationId, sessionId);
  }

  async deleteSession(formationId: string, sessionId: string) {
    const existing = await this.sessionsRepository.findByIdInFormation(
      formationId,
      sessionId,
    );
    if (!existing) throw new NotFoundException('Session not found');
    await this.sessionsRepository.remove(formationId, sessionId);
  }
}
