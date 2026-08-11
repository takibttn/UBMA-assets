import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateLevelDto {
  @ApiProperty({ example: 'uuid-language-id' })
  @IsUUID()
  languageId!: string;

  @ApiProperty({ example: 'B1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  code!: string;

  @ApiProperty({ example: 'Intermediate' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Intermediate language proficiency level' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  order!: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
