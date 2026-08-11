import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Formation, Room } from '@/database/schema';
import {
  mapSessionRowToConflictApi,
  summarizeRoomAvailabilityRows,
  type RoomAvailabilityConflictApi,
} from '@lib/scheduling/room-availability.helpers';
import { assertSessionWindow } from '@modules/formations/formation-session-validation.util';
import { RoomAvailabilityRequestDto } from './dto/room-availability-request.dto';
import type { RoomAvailabilityRowDto } from './dto/room-availability-shared.dto';
import { RoomsServiceBase } from './rooms.service.base';

export abstract class RoomsServiceAvailability extends RoomsServiceBase {
  /**
   * Exact-interval room availability for manual create / edit (ADMIN UX).
   * Does not replace session CRUD validation — conflicts must still be rejected with 409 on save.
   */
  async getAvailabilityForExactInterval(
    dto: RoomAvailabilityRequestDto,
  ): Promise<{
    data: RoomAvailabilityRowDto[];
    summary: ReturnType<typeof summarizeRoomAvailabilityRows>;
  }> {
    const formation = await this.formationsRepository.findById(dto.formationId);
    if (!formation) {
      throw new NotFoundException('Formation not found');
    }

    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new BadRequestException('Invalid startAt or endAt');
    }
    assertSessionWindow(formation, startAt, endAt);

    const roomsList = await this.roomsRepository.findAllOrderedByCode();
    const data: RoomAvailabilityRowDto[] = [];

    for (const room of roomsList) {
      const conflictsApi = await this.loadExactIntervalConflicts(
        room,
        startAt,
        endAt,
        dto.excludeSessionId,
      );
      data.push(this.buildRoomAvailabilityRow(formation, room, conflictsApi));
    }

    const availableOnly = dto.availableOnly === true;
    const filtered = availableOnly
      ? data.filter((r) => r.status === 'AVAILABLE')
      : data;

    return {
      data: filtered,
      summary: summarizeRoomAvailabilityRows(filtered),
    };
  }

  private async loadExactIntervalConflicts(
    room: Room,
    intervalStart: Date,
    intervalEnd: Date,
    excludeSessionId?: string,
  ): Promise<RoomAvailabilityConflictApi[]> {
    const sessions =
      await this.roomsRepository.findNonCancelledSessionsInRoomTimeWindow(
        room.id,
        intervalStart,
        intervalEnd,
        excludeSessionId,
      );
    return sessions.map(mapSessionRowToConflictApi);
  }

  private buildRoomAvailabilityRow(
    formation: Formation,
    room: Room,
    conflicts: RoomAvailabilityConflictApi[],
  ): RoomAvailabilityRowDto {
    const roomDto = {
      id: room.id,
      code: room.code,
      name: room.name ?? null,
      capacity: room.capacity,
      isActive: room.isActive,
    };

    if (!room.isActive) {
      return {
        room: roomDto,
        status: 'INACTIVE',
        conflictCount: 0,
        conflicts: [],
      };
    }

    if (
      formation.capacity !== null &&
      formation.capacity !== undefined &&
      room.capacity < formation.capacity
    ) {
      return {
        room: roomDto,
        status: 'INSUFFICIENT_CAPACITY',
        conflictCount: 0,
        conflicts: [],
      };
    }

    if (conflicts.length > 0) {
      return {
        room: roomDto,
        status: 'OCCUPIED',
        conflictCount: conflicts.length,
        conflicts,
      };
    }

    return {
      room: roomDto,
      status: 'AVAILABLE',
      conflictCount: 0,
      conflicts: [],
    };
  }
}
