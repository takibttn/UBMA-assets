import { ApiProperty } from '@nestjs/swagger';

export class AdminPaymentStatsDto {
  @ApiProperty()
  pendingCount!: number;

  @ApiProperty()
  paidCount!: number;

  @ApiProperty()
  failedCount!: number;

  @ApiProperty()
  cancelledCount!: number;

  @ApiProperty()
  expiredCount!: number;

  @ApiProperty({ description: 'Sum of PAID amounts as decimal string' })
  totalPaidAmount!: string;
}
