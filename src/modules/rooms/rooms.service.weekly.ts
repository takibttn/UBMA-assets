import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  calculateConflictsForWeeklySlotIntervals,
  summarizeRoomAvailabilityRows,
} from '@lib/scheduling/room-availability.helpers';
import {
  combineDateWithTime,
  generateWeeklySlotIntervals,
  parseTimeToHoursMinutes,
} from '@modules/formations/formation-session-generation.util';
import { MAX_SESSION_MS } from '@modules/formations/formation-session-validation.util';
import { RoomAvailabilityForWeeklySlotDto } from './dto/room-availability-for-weekly-slot.dto';
import type { RoomAvailabilityRowDto } from './dto/room-availability-shared.dto';
import { RoomsServiceAvailability } from './rooms.service.availability';

export abstract class RoomsServiceWeekly extends RoomsServiceAvailability {
  /**
   * Admin UX helper: room capacity + occupancy for a recurring weekly slot over a formation period.
   * Does not check teacher conflicts; preview/generate remain authoritative.
   */
  async getAvailabilityForWeeklySlot(
    dto: RoomAvailabilityForWeeklySlotDto,
  ): Promise<{
    data: RoomAvailabilityRowDto[];
    summary: ReturnType<typeof summarizeRoomAvailabilityRows>;
  }> {
    try {
      parseTimeToHoursMinutes(dto.startTime);
      parseTimeToHoursMinutes(dto.endTime);
    } catch {
      throw new BadRequestException('Invalid time format; use HH:mm');
    }

    const refMonday = new Date(Date.UTC(2020, 0, 6, 0, 0, 0, 0));
    const slotStart = combineDateWithTime(refMonday, dto.startTime);
    const slotEnd = combineDateWithTime(refMonday, dto.endTime);
    if (slotStart.getTime() >= slotEnd.getTime()) {
      throw new BadRequestException('startTime must be before endTime');
    }
    if (slotEnd.getTime() - slotStart.getTime() > MAX_SESSION_MS) {
      throw new BadRequestException('Session duration must be at most 6 hours');
    }

    const formation = await this.formationsRepository.findById(dto.formationId);
    if (!formation) {
      throw new NotFoundException('Formation not found');
    }
    if (!formation.startDate || !formation.endDate) {
      throw new BadRequestException(
        'Formation must have startDate and endDate before checking room availability.',
      );
    }
    if (formation.startDate.getTime() >= formation.endDate.getTime()) {
      throw new BadRequestException('Formation period is invalid');
    }

    const intervals = generateWeeklySlotIntervals(
      formation.startDate,
      formation.endDate,
      dto.dayOfWeek,
      dto.startTime,
      dto.endTime,
    );

    const windowStart =
      intervals.length > 0
        ? new Date(Math.min(...intervals.map((i) => i.startAt.getTime())))
        : formation.startDate;
    const windowEnd =
      intervals.length > 0
        ? new Date(Math.max(...intervals.map((i) => i.endAt.getTime())))
        : formation.endDate;

    const roomsList = await this.roomsRepository.findAllOrderedByCode();
    const data: RoomAvailabilityRowDto[] = [];

    for (const room of roomsList) {
      const roomDto = {
        id: room.id,
        code: room.code,
        name: room.name ?? null,
        capacity: room.capacity,
        isActive: room.isActive,
      };

      if (!room.isActive) {
        data.push({
          room: roomDto,
          status: 'INACTIVE',
          conflictCount: 0,
          conflicts: [],
        });
        continue;
      }

      if (
        formation.capacity !== null &&
        formation.capacity !== undefined &&
        room.capacity < formation.capacity
      ) {
        data.push({
          room: roomDto,
          status: 'INSUFFICIENT_CAPACITY',
          conflictCount: 0,
          conflicts: [],
        });
        continue;
      }

      const sessions =
        await this.roomsRepository.findNonCancelledSessionsInRoomTimeWindow(
          room.id,
          windowStart,
          windowEnd,
        );

      const conflicts = calculateConflictsForWeeklySlotIntervals(
        sessions,
        intervals,
      );

      data.push(
        conflicts.length > 0
          ? {
              room: roomDto,
              status: 'OCCUPIED',
              conflictCount: conflicts.length,
              conflicts,
            }
          : {
              room: roomDto,
              status: 'AVAILABLE',
              conflictCount: 0,
              conflicts: [],
            },
      );
    }

    return {
      data,
      summary: summarizeRoomAvailabilityRows(data),
    };
  }
}
