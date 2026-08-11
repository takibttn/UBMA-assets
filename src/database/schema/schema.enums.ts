import { pgEnum } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['ADMIN', 'APPRENANT']);

export const accountTypeEnum = pgEnum('account_type', [
  'INTERNAL_STUDENT',
  'EXTERNAL_LEARNER',
]);

export const enrollmentStatusEnum = pgEnum('enrollment_status', [
  'PENDING_PAYMENT',
  'ENROLLED',
  'CANCELLED',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'PENDING',
  'PROCESSING',
  'PAID',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
]);

export const formationTeacherRoleEnum = pgEnum('formation_teacher_role', [
  'MAIN_TEACHER',
  'ASSISTANT',
]);

export const sessionStatusEnum = pgEnum('session_status', [
  'SCHEDULED',
  'CANCELLED',
  'COMPLETED',
]);

export const attendanceStatusEnum = pgEnum('attendance_status', [
  'PRESENT',
  'ABSENT',
  'LATE',
  'EXCUSED',
]);
