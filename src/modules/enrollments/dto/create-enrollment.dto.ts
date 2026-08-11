import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateEnrollmentDto {
  @ApiProperty({ example: 'uuid-of-formation' })
  @IsUUID()
  @IsNotEmpty()
  formationId!: string;
}
