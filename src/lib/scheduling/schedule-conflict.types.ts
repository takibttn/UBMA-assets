export type CheckSessionConflictsInput = {
  formationId: string;
  roomId: string;
  startAt: Date;
  endAt: Date;
  excludeSessionId?: string;
};

/** Batch validation for automatic session generation (preview / generate). */
export type SessionGenerationProbe = {
  tempId: string;
  roomId: string;
  startAt: Date;
  endAt: Date;
};

export type ScheduleConflictResult = {
  hasConflict: boolean;
  roomConflicts: Array<{
    roomId: string;
    roomCode: string;
    sessionId: string;
    sessionTitle: string;
    startAt: string;
    endAt: string;
  }>;
  teacherConflicts: Array<{
    teacherId: string;
    teacherName: string;
    formationId: string;
    sessionId: string;
    sessionTitle: string;
    startAt: string;
    endAt: string;
  }>;
  formationConflicts: Array<{
    formationId: string;
    sessionId: string;
    sessionTitle: string;
    startAt: string;
    endAt: string;
  }>;
};
