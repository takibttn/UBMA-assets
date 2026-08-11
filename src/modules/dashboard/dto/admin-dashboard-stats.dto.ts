import { ApiProperty } from '@nestjs/swagger';

export class AdminDashboardStatsDto {
  @ApiProperty({
    description:
      'Formations with isSaleOpen=true and endDate null or in the future',
  })
  openFormations!: number;

  @ApiProperty({ description: 'Formations not yet started (startDate > now)' })
  pendingFormations!: number;

  @ApiProperty({
    description:
      'Distinct APPRENANT users with at least one ENROLLED enrollment',
  })
  activeStudents!: number;

  @ApiProperty({
    description:
      'ENROLLED enrollments where formation ended and no certificate issued',
  })
  certificatesToGenerate!: number;

  @ApiProperty({
    description:
      'Distinct teachers (formation_teachers.teacher_id) assigned to at least one formation',
  })
  activeTeachers!: number;
}
