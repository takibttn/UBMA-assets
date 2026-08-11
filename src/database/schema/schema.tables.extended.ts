import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  timestamp,
  unique,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import {
  attendanceStatusEnum,
  formationTeacherRoleEnum,
  sessionStatusEnum,
} from './schema.enums';
import {
  enrollments,
  formations,
  rooms,
  teachers,
  users,
} from './schema.tables.core';

export const formationTeachers = pgTable(
  'formation_teachers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    formationId: uuid('formation_id')
      .notNull()
      .references(() => formations.id, { onDelete: 'cascade' }),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => teachers.id, { onDelete: 'cascade' }),
    role: formationTeacherRoleEnum('role').notNull().default('MAIN_TEACHER'),
    assignedAt: timestamp('assigned_at').defaultNow().notNull(),
    assignedById: uuid('assigned_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    unique('formation_teachers_formation_teacher_unique').on(
      table.formationId,
      table.teacherId,
    ),
    index('formation_teachers_teacher_id_idx').on(table.teacherId),
    index('formation_teachers_formation_id_idx').on(table.formationId),
  ],
);

export const formationSessions = pgTable(
  'formation_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    formationId: uuid('formation_id')
      .notNull()
      .references(() => formations.id, { onDelete: 'cascade' }),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'restrict' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    startAt: timestamp('start_at').notNull(),
    endAt: timestamp('end_at').notNull(),
    status: sessionStatusEnum('status').notNull().default('SCHEDULED'),
    createdById: uuid('created_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('formation_sessions_formation_id_idx').on(table.formationId),
    index('formation_sessions_room_id_idx').on(table.roomId),
    index('formation_sessions_status_idx').on(table.status),
    index('formation_sessions_start_at_idx').on(table.startAt),
    index('formation_sessions_room_time_idx').on(
      table.roomId,
      table.startAt,
      table.endAt,
    ),
  ],
);

export const sessionAttendance = pgTable(
  'session_attendance',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => formationSessions.id, { onDelete: 'cascade' }),
    enrollmentId: uuid('enrollment_id')
      .notNull()
      .references(() => enrollments.id, { onDelete: 'cascade' }),
    status: attendanceStatusEnum('status').notNull(),
    markedAt: timestamp('marked_at'),
    markedByTeacherId: uuid('marked_by_teacher_id').references(
      () => teachers.id,
      { onDelete: 'set null' },
    ),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    unique('session_attendance_session_enrollment_unique').on(
      table.sessionId,
      table.enrollmentId,
    ),
    index('session_attendance_session_id_idx').on(table.sessionId),
    index('session_attendance_enrollment_id_idx').on(table.enrollmentId),
  ],
);

export const formationFeedback = pgTable(
  'formation_feedback',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    formationId: uuid('formation_id')
      .notNull()
      .references(() => formations.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    enrollmentId: uuid('enrollment_id').references(() => enrollments.id, {
      onDelete: 'cascade',
    }),
    rating: integer('rating').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    unique('formation_feedback_formation_student_unique').on(
      table.formationId,
      table.studentId,
    ),
    index('formation_feedback_formation_id_idx').on(table.formationId),
    check('formation_feedback_rating_check', sql`rating >= 0 AND rating <= 5`),
  ],
);

export const certificates = pgTable('certificates', {
  id: uuid('id').defaultRandom().primaryKey(),
  enrollmentId: uuid('enrollment_id')
    .notNull()
    .unique()
    .references(() => enrollments.id, { onDelete: 'cascade' }),
  certificateNumber: varchar('certificate_number', { length: 50 })
    .notNull()
    .unique(),
  verificationCode: varchar('verification_code', { length: 64 })
    .notNull()
    .unique(),
  issuedAt: timestamp('issued_at').defaultNow().notNull(),
  pdfUrl: varchar('pdf_url', { length: 500 }),
});
