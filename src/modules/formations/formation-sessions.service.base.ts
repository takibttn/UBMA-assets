import { Inject, NotFoundException } from '@nestjs/common';
import { FormationSessionsRepository } from '@lib/repositories/formation-sessions/formation-sessions.repository';
import { FormationsRepository } from '@lib/repositories/formations/formations.repository';
import { RoomsRepository } from '@lib/repositories/rooms/rooms.repository';
import { ScheduleConflictService } from '@lib/scheduling/schedule-conflict.service';

const ZERO_SUMMARY = {
  presentCount: 0,
  absentCount: 0,
  lateCount: 0,
  excusedCount: 0,
  unmarkedCount: 0,
  totalSessionsCount: 0,
} as const;

export abstract class FormationSessionsServiceBase {
  protected readonly sessionsRepository: FormationSessionsRepository;
  protected readonly formationsRepository: FormationsRepository;
  protected readonly roomsRepository: RoomsRepository;
  protected readonly scheduleConflictService: ScheduleConflictService;

  constructor(
    @Inject(FormationSessionsRepository)
    sessionsRepository: FormationSessionsRepository,
    @Inject(FormationsRepository)
    formationsRepository: FormationsRepository,
    @Inject(RoomsRepository)
    roomsRepository: RoomsRepository,
    @Inject(ScheduleConflictService)
    scheduleConflictService: ScheduleConflictService,
  ) {
    this.sessionsRepository = sessionsRepository;
    this.formationsRepository = formationsRepository;
    this.roomsRepository = roomsRepository;
    this.scheduleConflictService = scheduleConflictService;
  }

  async listSessions(formationId: string) {
    const formation = await this.formationsRepository.findById(formationId);
    if (!formation) throw new NotFoundException('Formation not found');

    const formationDisplay =
      await this.formationsRepository.findByIdWithLanguageAndLevel(formationId);
    if (!formationDisplay) throw new NotFoundException('Formation not found');

    const rows = await this.sessionsRepository.listByFormation(formationId);
    const enrolledCount =
      await this.sessionsRepository.enrolledCountForFormation(formationId);
    const summaries =
      await this.sessionsRepository.batchAttendanceSummariesForSessions(
        rows.map((r) => r.id),
      );

    return rows.map((r) =>
      this.mapRow(
        r,
        enrolledCount,
        formationDisplay,
        summaries.get(r.id) ?? { ...ZERO_SUMMARY },
      ),
    );
  }

  async getSession(formationId: string, sessionId: string) {
    const row = await this.sessionsRepository.findOneWithFormationContext(
      formationId,
      sessionId,
    );
    if (!row) throw new NotFoundException('Session not found');

    const enrolledCount =
      await this.sessionsRepository.enrolledCountForFormation(formationId);
    const fDisplay =
      await this.formationsRepository.findByIdWithLanguageAndLevel(formationId);
    if (!fDisplay) throw new NotFoundException('Formation not found');
    const attendanceSummary =
      await this.sessionsRepository.attendanceCountsForSession(sessionId);

    return this.mapRow(
      {
        id: row.session.id,
        formationId: row.session.formationId,
        title: row.session.title,
        description: row.session.description,
        startAt: row.session.startAt,
        endAt: row.session.endAt,
        status: row.session.status,
        room: row.room,
      },
      enrolledCount,
      fDisplay,
      attendanceSummary,
    );
  }

  protected mapRow(
    r: {
      id: string;
      formationId: string;
      title: string;
      description: string | null;
      startAt: Date;
      endAt: Date;
      status: string;
      room: {
        id: string;
        code: string;
        name: string;
        capacity: number;
      };
    },
    enrolledCount: number,
    formationDisplay: NonNullable<
      Awaited<ReturnType<FormationsRepository['findByIdWithLanguageAndLevel']>>
    >,
    attendanceSummary: {
      presentCount: number;
      absentCount: number;
      lateCount: number;
      excusedCount: number;
      unmarkedCount: number;
      totalSessionsCount: number;
    },
  ) {
    return {
      id: r.id,
      formationId: r.formationId,
      title: r.title,
      description: r.description,
      startAt: r.startAt.toISOString(),
      endAt: r.endAt.toISOString(),
      status: r.status,
      room: r.room,
      formation: {
        id: formationDisplay.id,
        title: formationDisplay.title,
        language: formationDisplay.language,
        level: formationDisplay.level,
      },
      enrolledCount,
      attendanceSummary,
    };
  }
}
