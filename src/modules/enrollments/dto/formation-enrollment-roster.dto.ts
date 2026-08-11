import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Public learner fields only (no password, tokens, DOB, etc.) */
export class FormationEnrollmentStudentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty({ nullable: true, type: String })
  email!: string | null;

  @ApiProperty({ nullable: true, type: String })
  matricule!: string | null;
}

export class PaginationMetaSwaggerDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;

  @ApiProperty()
  hasNextPage!: boolean;

  @ApiProperty()
  hasPreviousPage!: boolean;
}

export class FormationEnrollmentRosterItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  studentId!: string;

  @ApiProperty()
  formationId!: string;

  @ApiProperty({ enum: ['ENROLLED', 'CANCELLED', 'PENDING_PAYMENT'] })
  status!: 'ENROLLED' | 'CANCELLED' | 'PENDING_PAYMENT';

  @ApiProperty()
  enrolledAt!: string;

  @ApiPropertyOptional({
    nullable: true,
    deprecated: true,
    description:
      'Display name; prefer `student.firstName` / `student.lastName`',
  })
  studentName?: string | null;

  @ApiProperty({ type: FormationEnrollmentStudentDto })
  student!: FormationEnrollmentStudentDto;

  @ApiProperty({
    type: 'object',
    description: 'Formation card (title, price, capacity, language, level, …)',
    additionalProperties: true,
  })
  formation!: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    description: 'Aggregated attendance for this enrollment',
    additionalProperties: true,
  })
  attendanceSummary!: Record<string, unknown>;
}

export class FormationEnrollmentRosterPageDto {
  @ApiProperty({ type: [FormationEnrollmentRosterItemDto] })
  data!: FormationEnrollmentRosterItemDto[];

  @ApiProperty({ type: PaginationMetaSwaggerDto })
  meta!: PaginationMetaSwaggerDto;
}
