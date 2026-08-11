import { ApiProperty } from '@nestjs/swagger';

export class TopTeacherDto {
  @ApiProperty()
  teacherId!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  formationsCount!: number;

  @ApiProperty()
  studentsCount!: number;
}
