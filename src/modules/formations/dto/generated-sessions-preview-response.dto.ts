import { ApiProperty } from '@nestjs/swagger';

export class PreviewConflictRoomItemDto {
  @ApiProperty()
  roomId!: string;

  @ApiProperty()
  roomCode!: string;

  @ApiProperty({
    description: 'Existing session id or peer candidate tempId in preview',
  })
  sessionId!: string;

  @ApiProperty()
  sessionTitle!: string;

  @ApiProperty()
  startAt!: string;

  @ApiProperty()
  endAt!: string;
}

export class PreviewConflictTeacherItemDto {
  @ApiProperty()
  teacherId!: string;

  @ApiProperty()
  teacherName!: string;

  @ApiProperty()
  formationId!: string;

  @ApiProperty()
  sessionId!: string;

  @ApiProperty()
  sessionTitle!: string;

  @ApiProperty()
  startAt!: string;

  @ApiProperty()
  endAt!: string;
}

export class PreviewConflictFormationItemDto {
  @ApiProperty()
  formationId!: string;

  @ApiProperty()
  sessionId!: string;

  @ApiProperty()
  sessionTitle!: string;

  @ApiProperty()
  startAt!: string;

  @ApiProperty()
  endAt!: string;
}

export class GeneratedSessionPreviewItemDto {
  @ApiProperty()
  tempId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty()
  startAt!: string;

  @ApiProperty()
  endAt!: string;

  @ApiProperty()
  dayOfWeek!: number;

  @ApiProperty({
    description:
      'Zero-based index of the `weeklySlots` entry that produced this row (maps preview conflicts back to the UI slot row).',
    minimum: 0,
  })
  slotIndex!: number;

  @ApiProperty()
  room!: {
    id: string;
    code: string;
    name: string;
    capacity: number;
  };

  @ApiProperty({ enum: ['OK', 'CONFLICT'] })
  conflictStatus!: 'OK' | 'CONFLICT';

  @ApiProperty({
    description:
      'Virtual status for calendar styling; mirrors conflictStatus for generated rows',
    enum: ['SCHEDULED', 'CONFLICT'],
  })
  status!: 'SCHEDULED' | 'CONFLICT';

  @ApiProperty({ type: [PreviewConflictRoomItemDto] })
  roomConflicts!: PreviewConflictRoomItemDto[];

  @ApiProperty({ type: [PreviewConflictTeacherItemDto] })
  teacherConflicts!: PreviewConflictTeacherItemDto[];

  @ApiProperty({ type: [PreviewConflictFormationItemDto] })
  formationConflicts!: PreviewConflictFormationItemDto[];
}

export class GenerateSessionsPreviewSummaryDto {
  @ApiProperty()
  totalGenerated!: number;

  @ApiProperty()
  validCount!: number;

  @ApiProperty()
  conflictCount!: number;
}

export class GenerateSessionsPreviewResponseDto {
  @ApiProperty({ type: [GeneratedSessionPreviewItemDto] })
  data!: GeneratedSessionPreviewItemDto[];

  @ApiProperty()
  summary!: GenerateSessionsPreviewSummaryDto;
}
