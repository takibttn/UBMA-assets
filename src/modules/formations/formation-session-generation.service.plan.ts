import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Formation } from '@/database/schema';
import { GenerateFormationSessionsDto } from './dto/generate-formation-sessions.dto';
import {
  combineDateWithTime,
  type GeneratedSessionCandidate,
  generateWeeklySessionCandidates,
  parseTimeToHoursMinutes,
} from './formation-session-generation.util';
import { MAX_SESSION_MS } from './formation-session-validation.util';
import { FormationSessionGenerationServiceConflict } from './formation-session-generation.service.conflict';

export abstract class FormationSessionGenerationServicePlan extends FormationSessionGenerationServiceConflict {
  buildSessionCandidates(
    formation: Formation,
    dto: GenerateFormationSessionsDto,
  ): GeneratedSessionCandidate[] {
    this.assertFormationPeriod(formation);
    this.validateSlotDurations(dto);
    return generateWeeklySessionCandidates(
      formation.id,
      formation.title,
      formation.startDate!,
      formation.endDate!,
      dto.weeklySlots,
    );
  }

  async previewGeneratedSessions(
    formationId: string,
    dto: GenerateFormationSessionsDto,
  ) {
    const formation = await this.formationsRepository.findById(formationId);
    if (!formation) throw new NotFoundException('Formation not found');

    const candidates = this.buildSessionCandidates(formation, dto);
    const roomById = await this.loadActiveRoomsForDto(dto);
    const data = await this.validateGeneratedSessions(
      formationId,
      formation,
      candidates,
      roomById,
    );
    const summary = {
      totalGenerated: data.length,
      validCount: data.filter((i) => i.conflictStatus === 'OK').length,
      conflictCount: data.filter((i) => i.conflictStatus === 'CONFLICT').length,
    };
    return { data, summary };
  }

  private assertFormationPeriod(formation: Formation): void {
    if (!formation.startDate || !formation.endDate) {
      throw new BadRequestException(
        'Formation must have startDate and endDate before generating sessions.',
      );
    }
    if (formation.startDate.getTime() >= formation.endDate.getTime()) {
      throw new BadRequestException('Formation period is invalid');
    }
  }

  private validateSlotDurations(dto: GenerateFormationSessionsDto): void {
    const refMonday = new Date(Date.UTC(2020, 0, 6, 0, 0, 0, 0));
    for (const slot of dto.weeklySlots) {
      try {
        parseTimeToHoursMinutes(slot.startTime);
        parseTimeToHoursMinutes(slot.endTime);
      } catch {
        throw new BadRequestException('Invalid time format; use HH:mm');
      }
      const startAt = combineDateWithTime(refMonday, slot.startTime);
      const endAt = combineDateWithTime(refMonday, slot.endTime);
      if (startAt >= endAt) {
        throw new BadRequestException(
          'startTime must be before endTime for each weekly slot',
        );
      }
      if (endAt.getTime() - startAt.getTime() > MAX_SESSION_MS) {
        throw new BadRequestException(
          'Session duration must be at most 6 hours',
        );
      }
    }
  }
}
