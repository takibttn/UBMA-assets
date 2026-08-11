import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleSaleDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isSaleOpen!: boolean;
}
