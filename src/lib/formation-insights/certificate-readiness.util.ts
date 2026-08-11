export type CertificateReadiness = {
  eligible: boolean;
  reasons: string[];
  attendanceRate: number;
  requiredAttendanceRate?: number;
  formationEnded: boolean;
  alreadyCertified: boolean;
};

const DEFAULT_REQUIRED_RATE = 70;

/**
 * Informational only — certificate generation rules are not enforced server-side yet.
 * TODO: align with product when certificate issuance becomes automated.
 */
export function buildCertificateReadiness(input: {
  attendanceRate: number;
  formationEnded: boolean;
  alreadyCertified: boolean;
  requiredAttendanceRate?: number;
}): CertificateReadiness {
  const required = input.requiredAttendanceRate ?? DEFAULT_REQUIRED_RATE;
  const reasons: string[] = [];

  if (input.alreadyCertified) {
    reasons.push('A certificate already exists for this enrollment.');
  }
  if (!input.formationEnded) {
    reasons.push('Formation has not ended yet.');
  }
  if (input.attendanceRate < required) {
    reasons.push(
      `Attendance rate (${input.attendanceRate}%) is below the informational threshold (${required}%).`,
    );
  }

  const wouldMeet =
    input.formationEnded &&
    !input.alreadyCertified &&
    input.attendanceRate >= required;

  return {
    eligible: false,
    reasons: wouldMeet
      ? [
          'Automatic eligibility is not enforced; this learner would meet a hypothetical minimum attendance rule.',
          ...reasons,
        ]
      : [
          'Certificate eligibility is informational only until rules are enforced.',
          ...reasons,
        ],
    attendanceRate: input.attendanceRate,
    requiredAttendanceRate: required,
    formationEnded: input.formationEnded,
    alreadyCertified: input.alreadyCertified,
  };
}
