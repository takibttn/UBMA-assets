import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TopFormationDto {
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

  @ApiPropertyOptional({
    description: 'Numeric string from DB (format on client)',
  })
  price!: string | null;

  @ApiPropertyOptional({
    description: 'Max ENROLLED learners; null treated as unlimited',
  })
  capacity!: number | null;

  @ApiPropertyOptional({
    description: 'enrolledCount / capacity * 100 when capacity > 0',
  })
  occupancyRate!: number | null;

  @ApiProperty()
  enrolledCount!: number;

  @ApiProperty()
  certificateCount!: number;

  @ApiProperty({
    description: 'Success rate 0-100 (certificateCount / enrolledCount * 100)',
  })
  successRate!: number;

  @ApiPropertyOptional({
    description: 'Average learner feedback rating (0–5), null if no ratings',
  })
  averageRating!: number | null;

  @ApiProperty({ description: 'Number of feedback submissions' })
  ratingCount!: number;

  @ApiProperty({
    description:
      'Mean of per-learner attendance rates for this formation (0–100)',
  })
  averageAttendanceRate!: number;

  @ApiProperty({ description: 'All sessions including cancelled' })
  totalSessionsCount!: number;

  @ApiProperty({
    description:
      'ENROLLED learners in ended formations without a certificate (dashboard hint)',
  })
  certificateReadyCount!: number;
}
