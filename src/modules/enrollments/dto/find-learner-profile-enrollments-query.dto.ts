import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export type LearnerProfileEnrollmentBucketFilter =
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'ALL';

export class FindLearnerProfileEnrollmentsQueryDto {
  @ApiPropertyOptional({
    enum: ['IN_PROGRESS', 'COMPLETED', 'ALL'],
    description:
      'Filter by profile bucket. Omit or ALL = all ENROLLED enrollments (excludes CANCELLED).',
  })
  @IsOptional()
  @IsIn(['IN_PROGRESS', 'COMPLETED', 'ALL'])
  bucket?: LearnerProfileEnrollmentBucketFilter;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Transform(({ value }) => (value === undefined ? 1 : Number(value)))
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @Transform(({ value }) => (value === undefined ? 10 : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @ApiPropertyOptional({
    enum: ['enrolledAt', 'formationStartDate', 'formationEndDate'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['enrolledAt', 'formationStartDate', 'formationEndDate'])
  sortBy: 'enrolledAt' | 'formationStartDate' | 'formationEndDate' =
    'enrolledAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}
