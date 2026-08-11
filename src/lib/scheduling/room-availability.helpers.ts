import { sessionIntervalsOverlap } from '@modules/formations/formation-session-generation.util';

export type RoomAvailabilityStatus =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'INSUFFICIENT_CAPACITY'
  | 'INACTIVE';

/** Row shape returned from `RoomsRepository.findNonCancelledSessionsInRoomTimeWindow`. */
export type RoomAvailabilitySessionRow = {
  id: string;
  startAt: Date;
  endAt: Date;
  title: string | null;
  formationId: string;
  formationTitle: string | null;
};

export type RoomAvailabilityConflictApi = {
  sessionId: string;
  sessionTitle: string | null;
  formationId: string;
  formationTitle: string | null;
  startAt: string;
  endAt: string;
};

export function mapSessionRowToConflictApi(
  row: RoomAvailabilitySessionRow,
): RoomAvailabilityConflictApi {
  return {
    sessionId: row.id,
    sessionTitle: row.title,
    formationId: row.formationId,
    formationTitle: row.formationTitle,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
  };
}

/** Conflicts with `[intervalStart, intervalEnd)` semantics per `sessionIntervalsOverlap`. */
export function calculateConflictsForExactInterval(
  sessions: RoomAvailabilitySessionRow[],
  intervalStart: Date,
  intervalEnd: Date,
  excludeSessionId?: string,
): RoomAvailabilityConflictApi[] {
  return sessions
    .filter(
      (s) =>
        (!excludeSessionId || s.id !== excludeSessionId) &&
        sessionIntervalsOverlap(s.startAt, s.endAt, intervalStart, intervalEnd),
    )
    .map(mapSessionRowToConflictApi);
}

export function calculateConflictsForWeeklySlotIntervals(
  sessions: RoomAvailabilitySessionRow[],
  intervals: Array<{ startAt: Date; endAt: Date }>,
): RoomAvailabilityConflictApi[] {
  return sessions
    .filter((s) =>
      intervals.some((iv) =>
        sessionIntervalsOverlap(s.startAt, s.endAt, iv.startAt, iv.endAt),
      ),
    )
    .map(mapSessionRowToConflictApi);
}

export function summarizeRoomAvailabilityRows(
  rows: Array<{ status: RoomAvailabilityStatus }>,
) {
  const summary = {
    totalRooms: rows.length,
    availableCount: 0,
    occupiedCount: 0,
    insufficientCapacityCount: 0,
    inactiveCount: 0,
  };
  for (const r of rows) {
    if (r.status === 'AVAILABLE') summary.availableCount += 1;
    else if (r.status === 'OCCUPIED') summary.occupiedCount += 1;
    else if (r.status === 'INSUFFICIENT_CAPACITY') {
      summary.insufficientCapacityCount += 1;
    } else if (r.status === 'INACTIVE') summary.inactiveCount += 1;
  }
  return summary;
}
