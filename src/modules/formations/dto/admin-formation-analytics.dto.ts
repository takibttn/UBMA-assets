import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type FormationAnalyticsStatus = 'OPEN' | 'CLOSED' | 'UPCOMING' | 'ENDED';

export class FormationAnalyticsByStatusItemDto {
  @ApiProperty({ enum: ['OPEN', 'CLOSED', 'UPCOMING', 'ENDED'] })
  status!: FormationAnalyticsStatus;

  @ApiProperty()
  count!: number;
}

export class FormationAnalyticsByLanguageItemDto {
  @ApiPropertyOptional()
  languageId!: string | null;

  @ApiPropertyOptional()
  languageCode!: string | null;

  @ApiPropertyOptional()
  languageName!: string | null;

  @ApiProperty()
  count!: number;
}

export class FormationAnalyticsByLevelItemDto {
  @ApiPropertyOptional()
  levelId!: string | null;

  @ApiPropertyOptional()
  levelCode!: string | null;

  @ApiPropertyOptional()
  levelName!: string | null;

  @ApiProperty()
  count!: number;
}

export class AdminFormationAnalyticsDto {
  @ApiProperty({ type: [FormationAnalyticsByStatusItemDto] })
  byStatus!: FormationAnalyticsByStatusItemDto[];

  @ApiProperty({ type: [FormationAnalyticsByLanguageItemDto] })
  byLanguage!: FormationAnalyticsByLanguageItemDto[];

  @ApiProperty({ type: [FormationAnalyticsByLevelItemDto] })
  byLevel!: FormationAnalyticsByLevelItemDto[];
}
