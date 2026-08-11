import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsISO8601, IsOptional, IsUUID } from 'class-validator';

export class RoomAvailabilityRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  formationId!: string;

  @ApiProperty({ example: '2026-05-11T09:00:00.000Z' })
  @IsISO8601()
  startAt!: string;

  @ApiProperty({ example: '2026-05-11T11:00:00.000Z' })
  @IsISO8601()
  endAt!: string;

  @ApiPropertyOptional({
    description:
      'When editing a session, omit this session from room conflict detection',
  })
  @IsOptional()
  @IsUUID()
  excludeSessionId?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'If true, response lists only rooms with status AVAILABLE',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  availableOnly?: boolean;
}
