export type FormationLanguageDto = {
  id: string | null;
  name: string | null;
  code: string | null;
};

export type FormationLevelDto = {
  id: string | null;
  code: string | null;
  name: string | null;
};

export type EnrollmentBlockedReason =
  | 'ALREADY_ENROLLED'
  | 'PENDING_PAYMENT'
  | 'SALE_CLOSED'
  | 'FORMATION_FULL'
  | 'FORMATION_ENDED'
  | null;

export type MyEnrollmentStateDto = {
  enrollmentId: string;
  status: 'ENROLLED' | 'CANCELLED' | 'PENDING_PAYMENT';
  enrolledAt: string;
} | null;

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  return JSON.stringify(value);
}

export function normalizeFormationPrice(price: unknown): string | null {
  return toNullableString(price);
}

export function computeSpotsRemaining(
  capacity: number | null | undefined,
  enrolledCount: number,
): number | null {
  if (capacity === null || capacity === undefined) return null;
  return Math.max(0, capacity - enrolledCount);
}

export function normalizeFormationLanguage(
  language: { id?: unknown; name?: unknown; code?: unknown } | null | undefined,
): FormationLanguageDto {
  if (!language) {
    return { id: null, name: null, code: null };
  }
  return {
    id: toNullableString(language.id),
    name: toNullableString(language.name),
    code: toNullableString(language.code),
  };
}

export function normalizeFormationLevel(
  level: { id?: unknown; code?: unknown; name?: unknown } | null | undefined,
): FormationLevelDto {
  if (!level) {
    return { id: null, code: null, name: null };
  }
  return {
    id: toNullableString(level.id),
    code: toNullableString(level.code),
    name: toNullableString(level.name),
  };
}

type FormationBaseMappingInput = {
  id: string;
  title: string;
  description: string | null;
  price: unknown;
  capacity: number | null;
  isSaleOpen: boolean;
  startDate: Date | null;
  endDate: Date | null;
  createdAt?: Date | null;
  enrolledCount: unknown;
  /** When set, spotsRemaining uses reserved seats (ENROLLED + PENDING_PAYMENT). */
  reservedCount?: unknown;
  language: Parameters<typeof normalizeFormationLanguage>[0];
  level: Parameters<typeof normalizeFormationLevel>[0];
};

export function mapFormationBaseDto(
  row: FormationBaseMappingInput,
  opts?: { includeCreatedAt?: boolean },
) {
  const enrolledCount = Number(row.enrolledCount ?? 0);
  const capacity = row.capacity ?? null;
  const reservedForSpots =
    row.reservedCount !== undefined && row.reservedCount !== null
      ? Number(row.reservedCount)
      : enrolledCount;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    price: normalizeFormationPrice(row.price),
    capacity,
    enrolledCount,
    spotsRemaining: computeSpotsRemaining(capacity, reservedForSpots),
    isSaleOpen: row.isSaleOpen,
    startDate: row.startDate ? row.startDate.toISOString() : null,
    endDate: row.endDate ? row.endDate.toISOString() : null,
    ...(opts?.includeCreatedAt && row.createdAt
      ? { createdAt: row.createdAt.toISOString() }
      : {}),
    language: normalizeFormationLanguage(row.language),
    level: normalizeFormationLevel(row.level),
  };
}

function toMyEnrollmentStateDto(enrollment: {
  id: string;
  status: 'ENROLLED' | 'CANCELLED' | 'PENDING_PAYMENT';
  enrolledAt: Date;
}): MyEnrollmentStateDto {
  return {
    enrollmentId: enrollment.id,
    status: enrollment.status,
    enrolledAt: enrollment.enrolledAt.toISOString(),
  };
}

export function buildLearnerFormationAvailability(args: {
  myEnrollmentRow: {
    id: string;
    status: 'ENROLLED' | 'CANCELLED' | 'PENDING_PAYMENT';
    enrolledAt: Date;
  } | null;
  isSaleOpen: boolean;
  capacity: number | null;
  /** Reserved seat count (ENROLLED + PENDING_PAYMENT) for capacity checks in listings. */
  reservedCount: number;
}): {
  myEnrollment: MyEnrollmentStateDto;
  canEnroll: boolean;
  enrollmentBlockedReason: EnrollmentBlockedReason;
} {
  const myEnrollment = args.myEnrollmentRow
    ? toMyEnrollmentStateDto(args.myEnrollmentRow)
    : null;

  if (args.myEnrollmentRow?.status === 'ENROLLED') {
    return {
      myEnrollment,
      canEnroll: false,
      enrollmentBlockedReason: 'ALREADY_ENROLLED',
    };
  }

  if (args.myEnrollmentRow?.status === 'PENDING_PAYMENT') {
    return {
      myEnrollment,
      canEnroll: false,
      enrollmentBlockedReason: 'PENDING_PAYMENT',
    };
  }

  if (!args.isSaleOpen) {
    return {
      myEnrollment,
      canEnroll: false,
      enrollmentBlockedReason: 'SALE_CLOSED',
    };
  }

  if (
    args.capacity !== null &&
    args.capacity !== undefined &&
    args.reservedCount >= args.capacity
  ) {
    return {
      myEnrollment,
      canEnroll: false,
      enrollmentBlockedReason: 'FORMATION_FULL',
    };
  }

  return {
    myEnrollment,
    canEnroll: true,
    enrollmentBlockedReason: null,
  };
}
