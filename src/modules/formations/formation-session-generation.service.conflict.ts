import { NotFoundException } from '@nestjs/common';
import type { Formation } from '@/database/schema';
import type { ScheduleConflictResult } from '@lib/scheduling/schedule-conflict.types';
import type { GeneratedSessionPreviewItemDto } from './dto/generated-sessions-preview-response.dto';
import {
  type GeneratedSessionCandidate,
  candidatesFormationOverlap,
  candidatesRoomOverlap,
} from './formation-session-generation.util';
import {
  assertRoomFitsFormationCapacity,
  assertSessionWindow,
} from './formation-session-validation.util';
import {
  FormationSessionGenerationServiceBase,
  type RoomRow,
} from './formation-session-generation.service.base';

export abstract class FormationSessionGenerationServiceConflict extends FormationSessionGenerationServiceBase {
  /**
   * Room existence/active, capacity, session window, pairwise overlaps, DB conflicts.
   */
  protected async validateGeneratedSessions(
    formationId: string,
    formation: Formation,
    candidates: GeneratedSessionCandidate[],
    roomById: Map<string, RoomRow>,
  ): Promise<GeneratedSessionPreviewItemDto[]> {
    for (const c of candidates) {
      const room = roomById.get(c.roomId);
      if (!room) throw new NotFoundException('Room not found');
      assertSessionWindow(formation, c.startAt, c.endAt);
      assertRoomFitsFormationCapacity(formation, room.capacity);
    }

    const internal = this.buildInternalCandidateConflicts(candidates, roomById);
    const probes = candidates.map((c) => ({
      tempId: c.tempId,
      roomId: c.roomId,
      startAt: c.startAt,
      endAt: c.endAt,
    }));
    const dbMap =
      await this.scheduleConflictService.checkGenerationProbesAgainstDb(
        formationId,
        probes,
      );

    return candidates.map((c) => {
      const room = roomById.get(c.roomId)!;
      const int = internal.get(c.tempId) ?? {
        roomConflicts: [] as ScheduleConflictResult['roomConflicts'],
        formationConflicts: [] as ScheduleConflictResult['formationConflicts'],
      };
      const db = dbMap.get(c.tempId) ?? {
        hasConflict: false,
        roomConflicts: [],
        teacherConflicts: [],
        formationConflicts: [],
      };
      const roomConflicts = [...int.roomConflicts, ...db.roomConflicts];
      const formationConflicts = [
        ...int.formationConflicts,
        ...db.formationConflicts,
      ];
      const teacherConflicts = [...db.teacherConflicts];
      const has =
        roomConflicts.length > 0 ||
        formationConflicts.length > 0 ||
        teacherConflicts.length > 0;
      const conflictStatus = has ? 'CONFLICT' : 'OK';
      return {
        tempId: c.tempId,
        title: c.title,
        description: c.description,
        startAt: c.startAt.toISOString(),
        endAt: c.endAt.toISOString(),
        dayOfWeek: c.dayOfWeek,
        slotIndex: c.slotIndex,
        room: {
          id: room.id,
          code: room.code,
          name: room.name,
          capacity: room.capacity,
        },
        conflictStatus,
        status: has ? 'CONFLICT' : 'SCHEDULED',
        roomConflicts,
        teacherConflicts,
        formationConflicts,
      };
    });
  }

  private buildInternalCandidateConflicts(
    candidates: GeneratedSessionCandidate[],
    roomById: Map<string, RoomRow>,
  ): Map<
    string,
    {
      roomConflicts: ScheduleConflictResult['roomConflicts'];
      formationConflicts: ScheduleConflictResult['formationConflicts'];
    }
  > {
    const map = new Map<
      string,
      {
        roomConflicts: ScheduleConflictResult['roomConflicts'];
        formationConflicts: ScheduleConflictResult['formationConflicts'];
      }
    >();
    for (const c of candidates) {
      map.set(c.tempId, { roomConflicts: [], formationConflicts: [] });
    }

    for (let i = 0; i < candidates.length; i += 1) {
      for (let j = i + 1; j < candidates.length; j += 1) {
        const a = candidates[i];
        const b = candidates[j];
        const roomOverlap = candidatesRoomOverlap(a, b);
        const formationOverlap = candidatesFormationOverlap(a, b);
        if (!roomOverlap && !formationOverlap) continue;

        if (roomOverlap) {
          const ar = roomById.get(a.roomId)!;
          const br = roomById.get(b.roomId)!;
          map.get(a.tempId)!.roomConflicts.push({
            roomId: a.roomId,
            roomCode: ar.code,
            sessionId: b.tempId,
            sessionTitle: b.title,
            startAt: b.startAt.toISOString(),
            endAt: b.endAt.toISOString(),
          });
          map.get(b.tempId)!.roomConflicts.push({
            roomId: b.roomId,
            roomCode: br.code,
            sessionId: a.tempId,
            sessionTitle: a.title,
            startAt: a.startAt.toISOString(),
            endAt: a.endAt.toISOString(),
          });
        }

        if (formationOverlap) {
          map.get(a.tempId)!.formationConflicts.push({
            formationId: a.formationId,
            sessionId: b.tempId,
            sessionTitle: b.title,
            startAt: b.startAt.toISOString(),
            endAt: b.endAt.toISOString(),
          });
          map.get(b.tempId)!.formationConflicts.push({
            formationId: b.formationId,
            sessionId: a.tempId,
            sessionTitle: a.title,
            startAt: a.startAt.toISOString(),
            endAt: a.endAt.toISOString(),
          });
        }
      }
    }

    return map;
  }
}
