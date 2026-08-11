import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { computeSpotsRemaining } from '@lib/formations/formation-base.mapper';
import { FindTeacherFormationSessionsQueryDto } from './dto/find-teacher-formation-sessions-query.dto';
import { FindTeacherFormationsQueryDto } from './dto/find-teacher-formations-query.dto';
import { TeachersServiceBase } from './teachers.service.base';

export abstract class TeachersServiceFormation extends TeachersServiceBase {
  async getTeacherFormations(
    teacherId: string,
    query: FindTeacherFormationsQueryDto,
  ) {
    const page = await this.teachersRepository.findTeacherFormationsPaginated(
      teacherId,
      query,
    );
    const formationIds = page.data.map((f) => f.id);
    const nextByFormation =
      await this.teachersRepository.findNextSessionsByFormationIds(
        formationIds,
        new Date(),
      );

    return {
      ...page,
      data: page.data.map((f) => {
        const n = nextByFormation.get(f.id);
        const enrolledCount = Number(f.enrolledCount ?? 0);
        return {
          ...f,
          enrolledCount,
          spotsRemaining: computeSpotsRemaining(f.capacity, enrolledCount),
          nextSession: n
            ? {
                id: n.id,
                startAt: n.startAt.toISOString(),
                endAt: n.endAt.toISOString(),
                roomCode: n.roomCode,
              }
            : null,
        };
      }),
    };
  }

  async getTeacherFormationSessions(
    teacherId: string,
    formationId: string,
    query: FindTeacherFormationSessionsQueryDto,
  ) {
    const ok = await this.teachersRepository.isTeacherAssignedToFormation(
      teacherId,
      formationId,
    );
    if (!ok) {
      throw new ForbiddenException('Not assigned to this formation');
    }
    const events = await this.teachersRepository.findTeacherFormationSessions(
      teacherId,
      formationId,
      query,
    );
    return {
      data: events.map((event) => {
        const cap = event.capacity;
        const enrolled = Number(event.enrolledCount ?? 0);
        const spotsRemaining = computeSpotsRemaining(cap, enrolled);
        return {
          id: event.sessionId,
          sessionId: event.sessionId,
          formationId: event.formationId,
          title: event.title,
          startsAt: event.startAt.toISOString(),
          endsAt: event.endAt.toISOString(),
          room: event.room,
          language: event.language,
          level: event.level,
          status: event.status,
          enrolledCount: enrolled,
          capacity: cap ?? null,
          spotsRemaining,
          type: 'SESSION' as const,
        };
      }),
    };
  }

  async getTeacherFormationDetails(teacherId: string, formationId: string) {
    const formation = await this.teachersRepository.findTeacherFormationById(
      teacherId,
      formationId,
    );
    if (!formation) {
      throw new NotFoundException('Formation not found for this teacher');
    }

    const [enrolledCount, sessionStats, nextSession] = await Promise.all([
      this.enrollmentsRepository.countActiveByFormation(formationId),
      this.formationTrackingRepository.getSessionStats(formationId),
      this.formationTrackingRepository.getNextSession(formationId),
    ]);

    return {
      id: formation.id,
      title: formation.title,
      description: formation.description,
      language: formation.language,
      level: formation.level,
      price: formation.price,
      capacity: formation.capacity,
      isSaleOpen: formation.isSaleOpen,
      startDate: formation.startDate?.toISOString() ?? null,
      endDate: formation.endDate?.toISOString() ?? null,
      createdAt: formation.createdAt.toISOString(),
      enrolledCount,
      spotsRemaining: computeSpotsRemaining(formation.capacity, enrolledCount),
      teacherRole: formation.assignmentRole,
      assignedAt: formation.assignedAt.toISOString(),
      sessionsSummary: {
        totalSessionsCount: sessionStats.total,
        completedSessionsCount: sessionStats.completed,
        scheduledSessionsCount: sessionStats.scheduled,
        cancelledSessionsCount: sessionStats.cancelled,
        nextSession: nextSession
          ? {
              id: nextSession.id,
              startAt: nextSession.startAt.toISOString(),
              endAt: nextSession.endAt.toISOString(),
              roomCode: nextSession.roomCode ?? null,
            }
          : null,
      },
    };
  }
}
