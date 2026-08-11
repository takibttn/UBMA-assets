import { ApiProperty } from '@nestjs/swagger';

export class AdminFormationStatsDto {
  @ApiProperty({ description: 'Total number of formations' })
  totalFormations!: number;

  @ApiProperty({ description: 'Formations with isSaleOpen = true' })
  openSales!: number;

  @ApiProperty({ description: 'Formations with isSaleOpen = false' })
  closedSales!: number;

  @ApiProperty({ description: 'Formations whose startDate is in the future' })
  upcomingFormations!: number;
}
