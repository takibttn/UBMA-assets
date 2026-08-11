import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaymentCheckoutDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    enum: ['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED'],
  })
  status!:
    | 'PENDING'
    | 'PROCESSING'
    | 'PAID'
    | 'FAILED'
    | 'CANCELLED'
    | 'EXPIRED';

  @ApiProperty({ example: '1500.00' })
  amount!: string;

  @ApiProperty({ enum: ['DZD'] })
  currency!: 'DZD';

  @ApiPropertyOptional({ nullable: true })
  checkoutUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  expiresAt!: string | null;
}
