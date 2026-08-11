import { ApiProperty } from '@nestjs/swagger';

export class GenerateSessionsSummaryDto {
  @ApiProperty()
  createdCount!: number;
}

export class GenerateSessionsResponseDto {
  @ApiProperty({
    description: 'Created sessions, same shape as list/get formation session',
  })
  created!: unknown[];

  @ApiProperty()
  summary!: GenerateSessionsSummaryDto;
}
