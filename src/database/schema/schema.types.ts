import {
  enrollments,
  formationLevels,
  formations,
  languages,
  payments,
  rooms,
  teachers,
  users,
} from './schema.tables.core';
import {
  certificates,
  formationFeedback,
  formationSessions,
  formationTeachers,
  sessionAttendance,
} from './schema.tables.extended';

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Teacher = typeof teachers.$inferSelect;
export type NewTeacher = typeof teachers.$inferInsert;
export type Language = typeof languages.$inferSelect;
export type NewLanguage = typeof languages.$inferInsert;
export type FormationLevel = typeof formationLevels.$inferSelect;
export type NewFormationLevel = typeof formationLevels.$inferInsert;
export type Formation = typeof formations.$inferSelect;
export type NewFormation = typeof formations.$inferInsert;
export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;
export type FormationTeacher = typeof formationTeachers.$inferSelect;
export type NewFormationTeacher = typeof formationTeachers.$inferInsert;
export type Certificate = typeof certificates.$inferSelect;
export type NewCertificate = typeof certificates.$inferInsert;
export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
export type FormationSession = typeof formationSessions.$inferSelect;
export type NewFormationSession = typeof formationSessions.$inferInsert;
export type SessionAttendance = typeof sessionAttendance.$inferSelect;
export type NewSessionAttendance = typeof sessionAttendance.$inferInsert;
export type FormationFeedback = typeof formationFeedback.$inferSelect;
export type NewFormationFeedback = typeof formationFeedback.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
