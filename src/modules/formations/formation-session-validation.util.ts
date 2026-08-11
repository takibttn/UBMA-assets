import { BadRequestException } from '@nestjs/common';
import type { Formation } from '@/database/schema';

export const MAX_SESSION_MS = 6 * 60 * 60 * 1000;

export function assertSessionWindow(
  formation: Formation,
  startAt: Date,
  endAt: Date,
): void {
  if (startAt >= endAt) {
    throw new BadRequestException('startAt must be before endAt');
  }
  if (endAt.getTime() - startAt.getTime() > MAX_SESSION_MS) {
    throw new BadRequestException('Session duration must be at most 6 hours');
  }
  if (
    formation.startDate &&
    formation.endDate &&
    (startAt < formation.startDate || endAt > formation.endDate)
  ) {
    throw new BadRequestException(
      'Session must fall within the formation start and end dates',
    );
  }
}

export function assertRoomFitsFormationCapacity(
  formation: Formation,
  roomCapacity: number,
): void {
  if (
    formation.capacity !== null &&
    formation.capacity !== undefined &&
    roomCapacity < formation.capacity
  ) {
    throw new BadRequestException(
      'Room capacity is smaller than formation capacity',
    );
  }
}
