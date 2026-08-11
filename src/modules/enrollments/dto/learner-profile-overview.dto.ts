import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LearnerProfileSummaryDto {
  @ApiProperty({ description: 'ENROLLED enrollments only' })
  totalEnrollmentsCount!: number;

  @ApiProperty({
    description: 'UPCOMING + ACTIVE (same as bucket IN_PROGRESS)',
  })
  inProgressEnrollmentsCount!: number;

  @ApiProperty()
  completedEnrollmentsCount!: number;

  @ApiProperty({ description: 'Certificates issued for this learner' })
  certificatesCount!: number;
}

export class LearnerFormationCardNestedDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  startDate!: string | null;

  @ApiPropertyOptional({ nullable: true })
  endDate!: string | null;

  @ApiPropertyOptional({ nullable: true })
  price!: string | null;

  @ApiPropertyOptional({ nullable: true })
  capacity!: number | null;

  @ApiProperty()
  isSaleOpen!: boolean;

  @ApiProperty()
  enrolledCount!: number;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Language (nullable if unlinked)',
  })
  language!: { id: string | null; name: string | null; code: string | null };

  @ApiPropertyOptional({
    nullable: true,
    description: 'Level (nullable if unlinked)',
  })
  level!: { id: string | null; code: string | null; name: string | null };
}

export class LearnerEnrollmentCardItemDto {
  @ApiProperty()
  enrollmentId!: string;

  @ApiProperty({ enum: ['ENROLLED', 'CANCELLED'] })
  enrollmentStatus!: 'ENROLLED' | 'CANCELLED';

  @ApiProperty()
  enrolledAt!: string;

  @ApiProperty({ enum: ['UPCOMING', 'ACTIVE', 'COMPLETED'] })
  progressState!: 'UPCOMING' | 'ACTIVE' | 'COMPLETED';

  @ApiProperty({ enum: ['IN_PROGRESS', 'COMPLETED'] })
  profileBucket!: 'IN_PROGRESS' | 'COMPLETED';

  @ApiProperty({ type: LearnerFormationCardNestedDto })
  formation!: LearnerFormationCardNestedDto;
}

export class LearnerProfileOverviewResponseDto {
  @ApiProperty({ type: LearnerProfileSummaryDto })
  summary!: LearnerProfileSummaryDto;

  @ApiPropertyOptional({
    type: LearnerEnrollmentCardItemDto,
    nullable: true,
    description:
      'Next highlighted in-progress enrollment card (formation-focused teaser)',
  })
  nextFormation!: LearnerEnrollmentCardItemDto | null;
}
