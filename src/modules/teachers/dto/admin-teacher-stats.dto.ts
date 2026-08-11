import { ApiProperty } from '@nestjs/swagger';

export class AdminTeacherStatsDto {
  @ApiProperty({ description: 'All rows in the teachers table' })
  totalTeachers!: number;

  @ApiProperty({
    description:
      'Distinct teachers with at least one formation assignment (formation_teachers)',
  })
  teachersWithAssignments!: number;

  @ApiProperty({
    description: 'Teachers with zero formation assignments',
  })
  teachersWithoutAssignments!: number;

  @ApiProperty({
    description: 'Total rows in formation_teachers (teacher–formation links)',
  })
  totalAssignments!: number;

  @ApiProperty({
    description: 'Distinct formations that have at least one assigned teacher',
  })
  formationsWithTeacher!: number;
}
