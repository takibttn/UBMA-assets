import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreateFormationDto {
  @ApiProperty({ example: 'English B1 - Communication Skills' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  title!: string;

  @ApiPropertyOptional({ example: 'Formation complète sur JS moderne' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'uuid-of-language' })
  @IsUUID()
  languageId!: string;

  @ApiProperty({ example: 'uuid-of-level' })
  @IsUUID()
  levelId!: string;

  @ApiPropertyOptional({ example: 5000 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({
    example: 30,
    description:
      'Maximum number of learners. If omitted, capacity is unlimited and the room capacity is the effective limit.',
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @ApiProperty({ example: '2026-06-01T08:00:00.000Z' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-08-30T17:00:00.000Z' })
  @IsDateString()
  endDate!: string;
}
