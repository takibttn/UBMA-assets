import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsUUID,
  ValidateNested,
} from 'class-validator';

class SessionAttendanceRecordDto {
  @ApiProperty()
  @IsUUID()
  enrollmentId!: string;

  @ApiProperty({ enum: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] })
  @IsIn(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'])
  status!: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
}

export class UpdateSessionAttendanceDto {
  @ApiProperty({ type: [SessionAttendanceRecordDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SessionAttendanceRecordDto)
  @IsNotEmpty()
  records!: SessionAttendanceRecordDto[];
}
