import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FormationSessionsRepository } from '@lib/repositories/formation-sessions/formation-sessions.repository';
import { SessionAttendanceRepository } from '@lib/repositories/session-attendance/session-attendance.repository';
import { EnrollmentsRepository } from '@lib/repositories/enrollments/enrollments.repository';
import { TeachersRepository } from './teachers.repository';
import { UpdateSessionAttendanceDto } from './dto/update-session-attendance.dto';

@Injectable()
export class SessionAttendanceService {
  constructor(
    private readonly sessionAttendanceRepository: SessionAttendanceRepository,
    private readonly formationSessionsRepository: FormationSessionsRepository,
    private readonly teachersRepository: TeachersRepository,
    private readonly enrollmentsRepository: EnrollmentsRepository,
  ) {}

  async getSessionAttendance(teacherId: string, sessionId: string) {
    const session = await this.formationSessionsRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    const allowed = await this.teachersRepository.isTeacherAssignedToFormation(
      teacherId,
      session.formationId,
    );
    if (!allowed) {
      throw new ForbiddenException('Not assigned to this formation');
    }

    const rows = await this.sessionAttendanceRepository.listRowsForSession(
      sessionId,
      session.formationId,
    );

    return rows.map((r) => ({
      enrollmentId: r.enrollmentId,
      student: r.student,
      attendance: {
        id: r.attendanceId ?? null,
        status: r.status ?? null,
        markedAt: r.markedAt?.toISOString() ?? null,
      },
    }));
  }

  async updateSessionAttendance(
    teacherId: string,
    sessionId: string,
    dto: UpdateSessionAttendanceDto,
  ) {
    const session = await this.formationSessionsRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    const allowed = await this.teachersRepository.isTeacherAssignedToFormation(
      teacherId,
      session.formationId,
    );
    if (!allowed) {
      throw new ForbiddenException('Not assigned to this formation');
    }

    const enrollmentIds = dto.records.map((r) => r.enrollmentId);
    const validCount =
      await this.enrollmentsRepository.countEnrollmentsInFormation(
        enrollmentIds,
        session.formationId,
      );
    if (validCount !== enrollmentIds.length) {
      throw new BadRequestException(
        'Every enrollment must belong to the same formation as the session',
      );
    }

    await this.sessionAttendanceRepository.upsertMany(
      sessionId,
      teacherId,
      dto.records,
    );

    return this.getSessionAttendance(teacherId, sessionId);
  }
}
