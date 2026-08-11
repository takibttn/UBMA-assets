import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TopLearnerDto {
  @ApiProperty({ description: 'User id (APPRENANT)' })
  studentId!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiPropertyOptional()
  email!: string | null;

  @ApiPropertyOptional()
  matricule!: string | null;

  @ApiPropertyOptional()
  accountType!: string | null;

  @ApiProperty({
    description: 'Count of ENROLLED enrollments included in attendance average',
  })
  enrollmentsCount!: number;

  @ApiProperty({
    description:
      'Formations that have ended (endDate < now) for ENROLLED enrollments',
  })
  completedFormationsCount!: number;

  @ApiProperty()
  certificatesCount!: number;

  @ApiProperty({
    description:
      'Average attendance rate (0–100) across ENROLLED formations (PRESENT / non-cancelled sessions)',
  })
  averageAttendanceRate!: number;
}
