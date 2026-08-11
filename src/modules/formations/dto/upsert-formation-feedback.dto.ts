import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertFormationFeedbackDto {
  @ApiProperty({ minimum: 0, maximum: 5, example: 4 })
  @IsInt()
  @Min(0)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string | null;
}
