import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type FormationCapacityStatus =
  | 'OPEN'
  | 'CLOSED'
  | 'FULL'
  | 'ALMOST_FULL';

export class FormationCapacityTrackingItemDto {
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

  @ApiProperty()
  capacity!: number;

  @ApiProperty()
  enrolledCount!: number;

  @ApiProperty({ description: 'Occupancy percentage 0-100' })
  occupancyRate!: number;

  @ApiProperty({ enum: ['OPEN', 'CLOSED', 'FULL', 'ALMOST_FULL'] })
  status!: FormationCapacityStatus;
}
