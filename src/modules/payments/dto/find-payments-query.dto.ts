import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@common/pagination/dto/pagination-query.dto';

export class FindMyPaymentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED'],
  })
  @IsOptional()
  @IsIn(['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED'])
  status?:
    | 'PENDING'
    | 'PROCESSING'
    | 'PAID'
    | 'FAILED'
    | 'CANCELLED'
    | 'EXPIRED';

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  formationId?: string;
}

export class FindAdminPaymentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED'],
  })
  @IsOptional()
  @IsIn(['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED'])
  status?:
    | 'PENDING'
    | 'PROCESSING'
    | 'PAID'
    | 'FAILED'
    | 'CANCELLED'
    | 'EXPIRED';

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  formationId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({ description: 'ISO date (from), optional filter' })
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date (to), optional filter' })
  @IsOptional()
  to?: string;
}
