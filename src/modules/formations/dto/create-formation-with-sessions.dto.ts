import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

class FormationWithSessionsBodyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsUUID()
  languageId!: string;

  @ApiProperty()
  @IsUUID()
  levelId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiProperty()
  @IsDateString()
  startDate!: string;

  @ApiProperty()
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSaleOpen?: boolean;
}

class SessionSeedDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsUUID()
  roomId!: string;

  @ApiProperty()
  @IsDateString()
  startAt!: string;

  @ApiProperty()
  @IsDateString()
  endAt!: string;
}

export class CreateFormationWithSessionsDto {
  @ApiProperty({ type: FormationWithSessionsBodyDto })
  @ValidateNested()
  @Type(() => FormationWithSessionsBodyDto)
  formation!: FormationWithSessionsBodyDto;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  teacherIds!: string[];

  @ApiProperty({ type: [SessionSeedDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SessionSeedDto)
  sessions!: SessionSeedDto[];
}
