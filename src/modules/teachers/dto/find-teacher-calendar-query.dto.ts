import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, Validate } from 'class-validator';
import { TeacherCalendarDateRangeConstraint } from './calendar-date-range.validator';

/**
 * Teacher calendar preview filters only.
 * No pagination — listing is bounded by assignments + optional from/to window.
 */
export class FindTeacherCalendarQueryDto {
  @ApiPropertyOptional({
    description:
      'Inclusive range start (ISO 8601). Plain YYYY-MM-DD → UTC 00:00:00.000Z',
    example: '2026-05-01',
  })
  @Validate(TeacherCalendarDateRangeConstraint)
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({
    description:
      'Inclusive range end (ISO 8601). Plain YYYY-MM-DD → UTC 23:59:59.999Z',
    example: '2026-07-31',
  })
  @Validate(TeacherCalendarDateRangeConstraint)
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({
    description:
      'Case-insensitive match on formation title, language name/code, level name/code',
    maxLength: 200,
  })
  @Validate(TeacherCalendarDateRangeConstraint)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
