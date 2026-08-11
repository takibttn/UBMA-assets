export type SeedMode = 'default' | 'bulk' | 'same-day' | 'tracking-feedback';

export type SeedOptions = {
  mode: SeedMode;
};

export type SeedContext = {
  adminUserId?: string;
  teacherIds?: string[];
  learnerIds?: string[];
  languageIds?: Record<string, string>;
  levelIds?: Record<string, string>;
  roomIds?: string[];
  formationIds?: string[];
  sessionIds?: string[];
  enrollmentIds?: string[];
  paymentIds?: string[];
  certificateIds?: string[];
};
