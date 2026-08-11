import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsUUID, Matches } from 'class-validator';

const TIME_HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class RoomAvailabilityForWeeklySlotDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  formationId!: string;

  @ApiProperty({
    description: 'ISO weekday: 1=Monday … 7=Sunday',
    enum: [1, 2, 3, 4, 5, 6, 7],
  })
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2, 3, 4, 5, 6, 7])
  dayOfWeek!: 1 | 2 | 3 | 4 | 5 | 6 | 7;

  @ApiProperty({
    example: '09:00',
    description: 'HH:mm (24h, UTC wall clock — same as preview/generate)',
  })
  @Matches(TIME_HHMM, { message: 'startTime must be HH:mm' })
  startTime!: string;

  @ApiProperty({ example: '11:00' })
  @Matches(TIME_HHMM, { message: 'endTime must be HH:mm' })
  endTime!: string;
}
