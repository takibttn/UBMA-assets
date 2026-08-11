export const ACADEMIC_SEED_PASSWORD = 'Password123';

export const ADMIN_EMAIL = 'admin@email.com';

export type SeedCounters = {
  languagesUpserted: number;
  levelsUpserted: number;
  adminUpserted: number;
  teachersUpserted: number;
  roomsInserted: number;
  formationsInserted: number;
  formationTeachersInserted: number;
  formationSessionsInserted: number;
  sessionAttendanceInserted: number;
  learnersUpserted: number;
  enrollmentsInserted: number;
  certificatesInserted: number;
  formationFeedbackInserted: number;
  paymentsInserted: number;
};

export function emptyCounters(): SeedCounters {
  return {
    languagesUpserted: 0,
    levelsUpserted: 0,
    adminUpserted: 0,
    teachersUpserted: 0,
    roomsInserted: 0,
    formationsInserted: 0,
    formationTeachersInserted: 0,
    formationSessionsInserted: 0,
    sessionAttendanceInserted: 0,
    learnersUpserted: 0,
    enrollmentsInserted: 0,
    certificatesInserted: 0,
    formationFeedbackInserted: 0,
    paymentsInserted: 0,
  };
}
