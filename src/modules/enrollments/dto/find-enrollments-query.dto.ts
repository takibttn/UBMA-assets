import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@common/pagination/dto/pagination-query.dto';

export class FindEnrollmentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ['ENROLLED', 'CANCELLED', 'PENDING_PAYMENT'],
    description:
      'Filter by status. Omit for ADMIN formation roster to include all statuses.',
  })
  @IsOptional()
  @IsIn(['ENROLLED', 'CANCELLED', 'PENDING_PAYMENT'])
  status?: 'ENROLLED' | 'CANCELLED' | 'PENDING_PAYMENT';

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  formationId?: string;
}
