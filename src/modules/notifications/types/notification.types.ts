export interface EnrollmentNotificationParams {
  studentFullName: string;
  /** Internal students; null for external learners (email-only accounts). */
  studentMatricule: string | null;
  formationTitle: string;
  teacherEmail?: string;
  /** Prefer explicit inbox from caller; may be empty if only env fallback is used. */
  adminEmail?: string;
  enrollmentId: string;
}

export interface FormationStatusNotificationParams {
  formationId: string;
  formationTitle: string;
  isSaleOpen: boolean;
  /** Emails of all learners enrolled in this formation. */
  learnerEmails: string[];
  /** Email of the main teacher. */
  teacherEmail?: string;
}
export interface TeacherAssignmentNotificationParams {
  teacherName: string;
  teacherEmail: string;
  formationTitle: string;
  startDate: Date;
  endDate: Date;
}
