import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const TIME_HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class WeeklySessionSlotDto {
  @ApiProperty({
    description: 'ISO weekday: 1=Monday … 7=Sunday',
    enum: [1, 2, 3, 4, 5, 6, 7],
  })
  @IsIn([1, 2, 3, 4, 5, 6, 7])
  dayOfWeek!: 1 | 2 | 3 | 4 | 5 | 6 | 7;

  @ApiProperty({
    example: '09:00',
    description: 'HH:mm (24h, UTC wall clock for generated instants)',
  })
  @Matches(TIME_HHMM, { message: 'startTime must be HH:mm' })
  startTime!: string;

  @ApiProperty({ example: '11:00' })
  @Matches(TIME_HHMM, { message: 'endTime must be HH:mm' })
  endTime!: string;

  @ApiProperty()
  @IsUUID()
  roomId!: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class GenerateFormationSessionsDto {
  @ApiProperty({ type: [WeeklySessionSlotDto], minItems: 1, maxItems: 14 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(14)
  @ValidateNested({ each: true })
  @Type(() => WeeklySessionSlotDto)
  weeklySlots!: WeeklySessionSlotDto[];
}
