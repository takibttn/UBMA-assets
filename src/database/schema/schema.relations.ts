import { relations } from 'drizzle-orm';
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
export const formationFeedbackRelations = relations(
  formationFeedback,
  ({ one }) => ({
    formation: one(formations, {
      fields: [formationFeedback.formationId],
      references: [formations.id],
    }),
    student: one(users, {
      fields: [formationFeedback.studentId],
      references: [users.id],
    }),
    enrollment: one(enrollments, {
      fields: [formationFeedback.enrollmentId],
      references: [enrollments.id],
    }),
  }),
);
export const usersRelations = relations(users, ({ many }) => ({
  enrollments: many(enrollments),
  formations: many(formations),
  formationFeedback: many(formationFeedback),
  payments: many(payments),
}));
export const teachersRelations = relations(teachers, ({ many }) => ({
  formationAssignments: many(formationTeachers),
}));
export const languagesRelations = relations(languages, ({ many }) => ({
  levels: many(formationLevels),
  formations: many(formations),
}));
export const formationLevelsRelations = relations(
  formationLevels,
  ({ one, many }) => ({
    language: one(languages, {
      fields: [formationLevels.languageId],
      references: [languages.id],
    }),
    formations: many(formations),
  }),
);
export const roomsRelations = relations(rooms, ({ many }) => ({
  sessions: many(formationSessions),
}));
export const formationsRelations = relations(formations, ({ one, many }) => ({
  creator: one(users, {
    fields: [formations.creatorId],
    references: [users.id],
    relationName: 'formationCreator',
  }),
  language: one(languages, {
    fields: [formations.languageId],
    references: [languages.id],
  }),
  level: one(formationLevels, {
    fields: [formations.levelId],
    references: [formationLevels.id],
  }),
  enrollments: many(enrollments),
  payments: many(payments),
  teacherAssignments: many(formationTeachers),
  sessions: many(formationSessions),
  feedback: many(formationFeedback),
}));
export const formationSessionsRelations = relations(
  formationSessions,
  ({ one, many }) => ({
    formation: one(formations, {
      fields: [formationSessions.formationId],
      references: [formations.id],
    }),
    room: one(rooms, {
      fields: [formationSessions.roomId],
      references: [rooms.id],
    }),
    createdBy: one(users, {
      fields: [formationSessions.createdById],
      references: [users.id],
      relationName: 'sessionCreatedBy',
    }),
    attendanceRows: many(sessionAttendance),
  }),
);
export const enrollmentsRelations = relations(enrollments, ({ one, many }) => ({
  student: one(users, {
    fields: [enrollments.studentId],
    references: [users.id],
  }),
  formation: one(formations, {
    fields: [enrollments.formationId],
    references: [formations.id],
  }),
  attendanceRows: many(sessionAttendance),
  feedback: many(formationFeedback),
  paymentAttempts: many(payments),
}));
export const paymentsRelations = relations(payments, ({ one }) => ({
  enrollment: one(enrollments, {
    fields: [payments.enrollmentId],
    references: [enrollments.id],
  }),
  student: one(users, { fields: [payments.studentId], references: [users.id] }),
  formation: one(formations, {
    fields: [payments.formationId],
    references: [formations.id],
  }),
}));
export const sessionAttendanceRelations = relations(
  sessionAttendance,
  ({ one }) => ({
    session: one(formationSessions, {
      fields: [sessionAttendance.sessionId],
      references: [formationSessions.id],
    }),
    enrollment: one(enrollments, {
      fields: [sessionAttendance.enrollmentId],
      references: [enrollments.id],
    }),
    markedByTeacher: one(teachers, {
      fields: [sessionAttendance.markedByTeacherId],
      references: [teachers.id],
    }),
  }),
);
export const formationTeachersRelations = relations(
  formationTeachers,
  ({ one }) => ({
    formation: one(formations, {
      fields: [formationTeachers.formationId],
      references: [formations.id],
    }),
    teacher: one(teachers, {
      fields: [formationTeachers.teacherId],
      references: [teachers.id],
      relationName: 'formationTeacher',
    }),
    assignedBy: one(users, {
      fields: [formationTeachers.assignedById],
      references: [users.id],
      relationName: 'formationAssignedBy',
    }),
  }),
);
export const certificatesRelations = relations(certificates, ({ one }) => ({
  enrollment: one(enrollments, {
    fields: [certificates.enrollmentId],
    references: [enrollments.id],
  }),
}));
