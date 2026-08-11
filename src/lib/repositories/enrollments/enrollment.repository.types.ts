import { and, gte, isNotNull, isNull, lt, or } from 'drizzle-orm';
import { enrollments, formations } from '@/database/schema';
import type { LearnerProfileEnrollmentBucketFilter } from '@modules/enrollments/dto/find-learner-profile-enrollments-query.dto';

export type EnrollmentAttendanceSummary = {
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  unmarkedCount: number;
  totalSessionsCount: number;
  attendanceRate: number;
};

export type LearnerProfileEnrollmentCardRow = {
  enrollmentId: string;
  enrollmentStatus: 'ENROLLED' | 'CANCELLED' | 'PENDING_PAYMENT';
  enrolledAt: Date;
  formationId: string;
  title: string;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
  price: string | null;
  capacity: number | null;
  isSaleOpen: boolean;
  enrolledCount: number;
  language: {
    id: string | null;
    name: string | null;
    code: string | null;
  } | null;
  level: { id: string | null; code: string | null; name: string | null } | null;
};

export const ENROLLMENT_SORT_COLUMNS = {
  enrolledAt: enrollments.enrolledAt,
  status: enrollments.status,
} as const;

export function whereLearnerProfileBucket(
  bucket: LearnerProfileEnrollmentBucketFilter,
  now: Date,
) {
  if (bucket === 'ALL') return undefined;
  if (bucket === 'COMPLETED') {
    return and(isNotNull(formations.endDate), lt(formations.endDate, now));
  }
  return or(isNull(formations.endDate), gte(formations.endDate, now));
}

export type AttendanceCountRow = {
  enrollmentId: string;
  status: string;
  n: number;
};

export function buildAttendanceSummaryMap(
  enrollmentIds: string[],
  enrollToFormation: Map<string, string>,
  totalByFormation: Map<string, number>,
  attRows: AttendanceCountRow[],
): Map<string, EnrollmentAttendanceSummary> {
  const counts = new Map<
    string,
    { p: number; a: number; l: number; e: number }
  >();
  for (const id of enrollmentIds) {
    counts.set(id, { p: 0, a: 0, l: 0, e: 0 });
  }
  for (const r of attRows) {
    const cur = counts.get(r.enrollmentId) ?? { p: 0, a: 0, l: 0, e: 0 };
    if (r.status === 'PRESENT') cur.p = r.n;
    else if (r.status === 'ABSENT') cur.a = r.n;
    else if (r.status === 'LATE') cur.l = r.n;
    else if (r.status === 'EXCUSED') cur.e = r.n;
    counts.set(r.enrollmentId, cur);
  }

  const map = new Map<string, EnrollmentAttendanceSummary>();
  for (const eid of enrollmentIds) {
    const fid = enrollToFormation.get(eid);
    const totalSessionsCount = fid ? (totalByFormation.get(fid) ?? 0) : 0;
    const c = counts.get(eid) ?? { p: 0, a: 0, l: 0, e: 0 };
    const presentCount = c.p;
    const absentCount = c.a;
    const lateCount = c.l;
    const excusedCount = c.e;
    const unmarkedCount = Math.max(
      0,
      totalSessionsCount -
        presentCount -
        absentCount -
        lateCount -
        excusedCount,
    );
    const attendanceRate =
      totalSessionsCount > 0
        ? Math.round((presentCount / totalSessionsCount) * 100)
        : 0;
    map.set(eid, {
      presentCount,
      absentCount,
      lateCount,
      excusedCount,
      unmarkedCount,
      totalSessionsCount,
      attendanceRate,
    });
  }
  return map;
}
