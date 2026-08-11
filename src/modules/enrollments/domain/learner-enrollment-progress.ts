/**
 * Authoritative derived progress for learner (APPRENANT) enrollments with status ENROLLED.
 * Do not duplicate this logic elsewhere — import from here.
 */

export type LearnerEnrollmentProgressState =
  | 'UPCOMING'
  | 'ACTIVE'
  | 'COMPLETED';

export type LearnerProfileBucket = 'IN_PROGRESS' | 'COMPLETED';

export type FormationScheduleBounds = {
  startDate: Date | null;
  endDate: Date | null;
};

/**
 * Rules:
 * 1. COMPLETED if endDate is not null AND endDate < now
 * 2. UPCOMING if not completed AND startDate is not null AND startDate > now
 * 3. ACTIVE — all remaining ENROLLED cases (incl. both dates null, or only end in future, etc.)
 */
export function resolveLearnerEnrollmentProgressState(
  bounds: FormationScheduleBounds,
  now: Date,
): LearnerEnrollmentProgressState {
  const { startDate, endDate } = bounds;

  if (endDate !== null && endDate.getTime() < now.getTime()) {
    return 'COMPLETED';
  }
  if (startDate !== null && startDate.getTime() > now.getTime()) {
    return 'UPCOMING';
  }
  return 'ACTIVE';
}

export function resolveLearnerProfileBucket(
  progress: LearnerEnrollmentProgressState,
): LearnerProfileBucket {
  return progress === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS';
}

/** SQL-aligned filter: ENROLLED + (COMPLETED vs IN_PROGRESS) using the same date rules. */
export function enrollmentMatchesProfileBucket(
  bounds: FormationScheduleBounds,
  now: Date,
  bucket: LearnerProfileBucket,
): boolean {
  const progress = resolveLearnerEnrollmentProgressState(bounds, now);
  return resolveLearnerProfileBucket(progress) === bucket;
}

/**
 * "Next" highlight for profile overview: among IN_PROGRESS enrollments, prefer soonest-starting
 * UPCOMING, then ACTIVE by soonest end (null ends last), then by latest start as tie-breaker.
 */
export function compareForNextFormationHighlight(
  a: FormationScheduleBounds & { enrolledAt: Date },
  b: FormationScheduleBounds & { enrolledAt: Date },
  now: Date,
): number {
  const pa = resolveLearnerEnrollmentProgressState(a, now);
  const pb = resolveLearnerEnrollmentProgressState(b, now);
  const tier = (p: LearnerEnrollmentProgressState) =>
    p === 'UPCOMING' ? 0 : 1;
  const td = tier(pa) - tier(pb);
  if (td !== 0) return td;

  if (pa === 'UPCOMING') {
    const as = a.startDate?.getTime() ?? Number.POSITIVE_INFINITY;
    const bs = b.startDate?.getTime() ?? Number.POSITIVE_INFINITY;
    if (as !== bs) return as - bs;
    return b.enrolledAt.getTime() - a.enrolledAt.getTime();
  }

  const ae = a.endDate?.getTime() ?? Number.POSITIVE_INFINITY;
  const be = b.endDate?.getTime() ?? Number.POSITIVE_INFINITY;
  if (ae !== be) return ae - be;
  const as = a.startDate?.getTime() ?? 0;
  const bs = b.startDate?.getTime() ?? 0;
  if (as !== bs) return bs - as;
  return b.enrolledAt.getTime() - a.enrolledAt.getTime();
}
