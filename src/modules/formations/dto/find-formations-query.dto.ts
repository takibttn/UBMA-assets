import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@common/pagination/dto/pagination-query.dto';

export class FindFormationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ['OPEN', 'CLOSED', 'ALL'],
    description:
      'Filter by sale window: OPEN (`isSaleOpen` true), CLOSED (false). ALL or omitted = no filter.',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === ''
      ? undefined
      : String(value).trim(),
  )
  @IsIn(['OPEN', 'CLOSED', 'ALL'], {
    message: 'saleStatus must be OPEN, CLOSED, or ALL',
  })
  saleStatus?: 'OPEN' | 'CLOSED' | 'ALL';

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  languageId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  levelId?: string;
}
