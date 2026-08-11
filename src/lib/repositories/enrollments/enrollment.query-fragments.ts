import { asc, desc, sql, type SQLWrapper } from 'drizzle-orm';
import {
  enrollments,
  formationLevels,
  formations,
  languages,
  users,
} from '@/database/schema';

export function enrolledCountSubquery(alias = 'formation_enrolled_count') {
  return sql<number>`(
    SELECT cast(count(*) as int)
    FROM ${enrollments}
    WHERE ${enrollments.formationId} = ${formations.id}
      AND ${enrollments.status} = 'ENROLLED'
  )`.as(alias);
}

export function formationCardSelect() {
  return {
    id: formations.id,
    title: formations.title,
    description: formations.description,
    price: formations.price,
    capacity: formations.capacity,
    isSaleOpen: formations.isSaleOpen,
    startDate: formations.startDate,
    endDate: formations.endDate,
    createdAt: formations.createdAt,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- drizzle 0.45 requires `any` for nested selects
    language: {
      id: languages.id,
      name: languages.name,
      code: languages.code,
    } as any,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- drizzle 0.45 requires `any` for nested selects
    level: {
      id: formationLevels.id,
      code: formationLevels.code,
      name: formationLevels.name,
    } as any,
  };
}

export function studentIdentitySelect(includeAccountType = false) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- drizzle 0.45 nested selects require any
  return {
    id: users.id,
    firstName: users.firstName,
    lastName: users.lastName,
    email: users.email,
    matricule: users.matricule,
    ...(includeAccountType ? { accountType: users.accountType } : {}),
  } as any;
}

export function resolveEnrollmentOrderBy(
  sortBy: string | undefined,
  sortOrder: string | undefined,
  columns: Record<string, SQLWrapper>,
) {
  const sortColumn =
    (sortBy ? columns[sortBy] : undefined) ?? columns.enrolledAt;
  return sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);
}
