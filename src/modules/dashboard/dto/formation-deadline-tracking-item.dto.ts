import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type FormationDeadlineStatus =
  | 'ENDING_SOON'
  | 'ENDED'
  | 'ACTIVE'
  | 'UPCOMING';

export class FormationDeadlineTrackingItemDto {
  @ApiProperty()
  formationId!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  languageCode!: string | null;

  @ApiPropertyOptional()
  languageName!: string | null;

  @ApiPropertyOptional()
  levelCode!: string | null;

  @ApiPropertyOptional()
  levelName!: string | null;

  @ApiPropertyOptional()
  startDate!: string | null;

  @ApiPropertyOptional()
  endDate!: string | null;

  @ApiPropertyOptional({
    description: 'Days from now to endDate; negative means ended',
  })
  daysRemaining!: number | null;

  @ApiProperty()
  enrolledCount!: number;

  @ApiProperty({ enum: ['ENDING_SOON', 'ENDED', 'ACTIVE', 'UPCOMING'] })
  status!: FormationDeadlineStatus;
}
