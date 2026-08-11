import { ApiProperty } from '@nestjs/swagger';

export type AdminAlertType =
  | 'PENDING_ENROLLMENTS'
  | 'INCOMPLETE_PAYMENTS'
  | 'MISSING_DOCUMENTS'
  | 'CERTIFICATES_TO_GENERATE';

export type AdminAlertSeverity = 'URGENT' | 'IMPORTANT' | 'WATCH';

export class AdminAlertDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    enum: [
      'PENDING_ENROLLMENTS',
      'INCOMPLETE_PAYMENTS',
      'MISSING_DOCUMENTS',
      'CERTIFICATES_TO_GENERATE',
    ],
  })
  type!: AdminAlertType;

  @ApiProperty({ enum: ['URGENT', 'IMPORTANT', 'WATCH'] })
  severity!: AdminAlertSeverity;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  count!: number;

  @ApiProperty()
  actionLabel!: string;

  @ApiProperty()
  actionHref!: string;
}
