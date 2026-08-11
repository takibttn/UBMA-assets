import { ApiProperty } from '@nestjs/swagger';

export class RoomAvailabilityRoomDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty({ nullable: true, type: String })
  name!: string | null;

  @ApiProperty({ nullable: true, type: Number })
  capacity!: number | null;

  @ApiProperty()
  isActive!: boolean;
}

export class RoomAvailabilityConflictDto {
  @ApiProperty()
  sessionId!: string;

  @ApiProperty({ nullable: true, type: String })
  sessionTitle!: string | null;

  @ApiProperty()
  formationId!: string;

  @ApiProperty({ nullable: true, type: String })
  formationTitle!: string | null;

  @ApiProperty()
  startAt!: string;

  @ApiProperty()
  endAt!: string;
}

export class RoomAvailabilityRowDto {
  @ApiProperty({ type: RoomAvailabilityRoomDto })
  room!: RoomAvailabilityRoomDto;

  @ApiProperty({
    enum: ['AVAILABLE', 'OCCUPIED', 'INSUFFICIENT_CAPACITY', 'INACTIVE'],
  })
  status!: 'AVAILABLE' | 'OCCUPIED' | 'INSUFFICIENT_CAPACITY' | 'INACTIVE';

  @ApiProperty({
    description:
      'Number of overlapping non-cancelled sessions (matches `conflicts.length`)',
  })
  conflictCount!: number;

  @ApiProperty({ type: [RoomAvailabilityConflictDto] })
  conflicts!: RoomAvailabilityConflictDto[];
}

export class RoomAvailabilitySummaryDto {
  @ApiProperty()
  totalRooms!: number;

  @ApiProperty()
  availableCount!: number;

  @ApiProperty()
  occupiedCount!: number;

  @ApiProperty()
  insufficientCapacityCount!: number;

  @ApiProperty()
  inactiveCount!: number;
}

export class RoomAvailabilityResponseDto {
  @ApiProperty({ type: [RoomAvailabilityRowDto] })
  data!: RoomAvailabilityRowDto[];

  @ApiProperty({ type: RoomAvailabilitySummaryDto })
  summary!: RoomAvailabilitySummaryDto;
}
