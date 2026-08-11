# Formation Enrollment Roster API — Frontend Handoff

**File:** `docs/formation-enrollments-roster-api.md`  
**Date:** 2026-05-02  
**Backend state:** Production-ready, fully tested.

---

## 1. Executive Summary

### What was implemented

The **admin formation enrollment roster** endpoint was verified and updated to provide a complete, privacy-respecting, paginated learner list for any given formation.

**Key changes made:**

| Change | Summary |
|--------|---------|
| `student` object embedded in every row | Structured `{ id, firstName, lastName, email, matricule }` — no sensitive fields |
| `studentName` legacy field kept | Deprecated convenience string; prefer `student.*` fields |
| `search` added to repository query | Case-insensitive match against `firstName`, `lastName`, `email`, `matricule` |
| `sortBy` / `sortOrder` added to repository query | Supports `enrolledAt` (default) and `status` sort columns |
| Count query joined on `users` | Count respects search filter — pagination total is accurate |
| `attendanceSummary` added per row | Aggregated presence/absence stats for each enrollment |
| `formation` card embedded per row | Full formation card (title, price, capacity, dates, language, level) |

**Endpoint:** `GET /api/v1/enrollments/formation/:formationId`  
**Business purpose:** Admin formation detail page roster — list all learners (by status) enrolled in a formation.  
**Affected modules:** `enrollments` (controller, service), `enrollments.repository`, `formations.repository`  
**Roles allowed:** `ADMIN` only  
**Production-ready:** Yes  
**Known limitations:** See section 12.

---

## 2. Endpoint Contract

### Route

```
GET /api/v1/enrollments/formation/:formationId
```

Global prefix: `/api/v1`

| Item | Value |
|------|-------|
| **Method** | `GET` |
| **Auth** | Bearer JWT, role `ADMIN` |
| **Controller method** | `EnrollmentsController#getFormationEnrollments` |
| **Service method** | `EnrollmentsService#getFormationEnrollments` |
| **Repository method** | `EnrollmentsRepository#findByFormationPaginated` |
| **File** | `src/modules/enrollments/enrollments.controller.ts` (line 115) |

### Route parameters

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `formationId` | UUID string | yes | Must be a valid UUID; `ParseUUIDPipe` validates it. 400 if malformed, 404 if not found. |

### Query parameters

| Param | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `page` | number | no | `1` | Min: 1 |
| `limit` | number | no | `10` | Min: 1, Max: 100 |
| `status` | `'ENROLLED' \| 'CANCELLED' \| 'PENDING_PAYMENT'` | no | *(all statuses)* | Omit to return **all** three statuses |
| `search` | string | no | — | Case-insensitive match on `firstName`, `lastName`, `email`, `matricule` |
| `sortBy` | `'enrolledAt' \| 'status'` | no | `'enrolledAt'` | Unknown keys fall back to `enrolledAt` |
| `sortOrder` | `'asc' \| 'desc'` | no | `'desc'` | |

`formationId` is also present in `FindEnrollmentsQueryDto` but is **not used** by the formation roster endpoint (the formation is taken from the URL path param, not the query).

---

## 3. Response DTO

### Envelope

```typescript
type PaginatedResponse<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};
```

### Item shape (exact)

```typescript
type FormationEnrollmentRosterItem = {
  // Core enrollment fields
  id: string;                          // Enrollment UUID
  studentId: string;                   // User UUID
  formationId: string;                 // Formation UUID
  status: 'ENROLLED' | 'CANCELLED' | 'PENDING_PAYMENT';
  enrolledAt: string;                  // ISO 8601 UTC string

  // Deprecated convenience field — prefer student.firstName + student.lastName
  studentName: string | null;          // Trimmed "FirstName LastName"; null if both are blank

  // Structured learner identity — use this as primary
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    matricule: string | null;
  };

  // Formation card — embedded so the UI does not need a separate fetch
  formation: {
    id: string;
    title: string;
    description: string | null;
    price: string | null;              // Numeric string, e.g. "1500.00"; null means free
    capacity: number | null;
    enrolledCount: number;             // Subquery: count of ENROLLED rows for this formation
    spotsRemaining: number | null;     // null when capacity is null (unlimited)
    isSaleOpen: boolean;
    startDate: string | null;          // ISO 8601 UTC
    endDate: string | null;            // ISO 8601 UTC
    createdAt: string;                 // ISO 8601 UTC
    language: {
      id: string | null;
      name: string | null;
      code: string | null;
    };
    level: {
      id: string | null;
      code: string | null;
      name: string | null;
    };
  };

  // Aggregated attendance for this enrollment
  attendanceSummary: {
    presentCount: number;
    absentCount: number;
    lateCount: number;
    excusedCount: number;
    unmarkedCount: number;
    totalSessionsCount: number;
    attendanceRate: number;            // 0–100 integer (percentage)
  };
};
```

### Example response

```json
{
  "data": [
    {
      "id": "d1e2a3b4-...",
      "studentId": "f5c6d7e8-...",
      "formationId": "a1b2c3d4-...",
      "status": "ENROLLED",
      "enrolledAt": "2026-04-10T08:23:11.000Z",
      "studentName": "Amira Benali",
      "student": {
        "id": "f5c6d7e8-...",
        "firstName": "Amira",
        "lastName": "Benali",
        "email": "amira.benali@univ-bba.dz",
        "matricule": null
      },
      "formation": {
        "id": "a1b2c3d4-...",
        "title": "Anglais Intermédiaire — Printemps 2026",
        "description": null,
        "price": "1500.00",
        "capacity": 30,
        "enrolledCount": 12,
        "spotsRemaining": 18,
        "isSaleOpen": true,
        "startDate": "2026-05-01T00:00:00.000Z",
        "endDate": "2026-05-31T23:59:59.999Z",
        "createdAt": "2026-03-15T10:00:00.000Z",
        "language": { "id": "...", "name": "Anglais", "code": "EN" },
        "level": { "id": "...", "code": "B1", "name": "Intermédiaire" }
      },
      "attendanceSummary": {
        "presentCount": 3,
        "absentCount": 1,
        "lateCount": 0,
        "excusedCount": 0,
        "unmarkedCount": 6,
        "totalSessionsCount": 10,
        "attendanceRate": 30
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

---

## 4. Business Rules

### Formation existence
The service calls `formationsRepository.findById(formationId)` before querying enrollments. If the formation does not exist → **404 `Formation not found`**.

### Status default (admin)
`status` is **optional**. When omitted, **all three statuses** (`ENROLLED`, `CANCELLED`, `PENDING_PAYMENT`) are included in the result. This is intentional — admin needs to see the full state of a formation's learner list, including those with unpaid or cancelled seats.

### PENDING_PAYMENT
- Rows with `status = 'PENDING_PAYMENT'` are **included** when `status` is omitted.
- They appear when a learner started a paid enrollment checkout but payment was not confirmed.
- Use this to identify learners who may need a manual follow-up.

### CANCELLED rows
- Rows with `status = 'CANCELLED'` are **included** when `status` is omitted.
- They represent learners who enrolled and then left (or an enrollment that was administratively cancelled).
- If you only want active learners, pass `?status=ENROLLED`.

### Search
- Implemented via **case-insensitive SQL `ILIKE`** on the joined `users` table.
- Columns searched: `firstName`, `lastName`, `email`, `matricule`.
- Partial matches are supported (e.g. `search=ami` matches `Amira`).
- `search` is applied **before pagination** — `meta.total` reflects the filtered count.

### Pagination
- Default: page 1, limit 10.
- Maximum limit: 100.
- The `OFFSET` is computed as `(page - 1) * limit`.
- Data is fetched in a single SQL query; count is a separate parallel query (both run via `Promise.all` in `BaseRepository#paginate`).

### Sorting
- Default: `enrolledAt DESC` (most recent first).
- Supported `sortBy` values: `enrolledAt`, `status`.
- Unknown `sortBy` values silently fall back to `enrolledAt`.
- `sortOrder`: `asc` or `desc` (default `desc`).

### Teacher vs Admin separation
- **This endpoint is ADMIN only.** Teachers do **not** have access.
- Teachers use separate routes:
  - `GET /enrollments/teacher` — ENROLLED-only list scoped to their assigned formations, with `identifierKind` / `identifier` helper fields.
  - `GET /enrollments/teacher/:enrollmentId` — Single enrollment detail.
- The admin roster returns **all statuses** and does **not** include `identifierKind` / `identifier`.

### Privacy minimization
The `student` object is deliberately narrow. The fields excluded vs the DB `users` table:

| Excluded field | Reason |
|----------------|--------|
| `password` | Never exposed in any API response |
| `dob` | Date of birth — not needed for admin roster |
| `bacYear` | BAC year — not needed for admin roster |
| `accountType` | Internal/external flag — not needed by frontend roster UI |
| `role` | Not relevant to formation context |
| `updatedAt` / `createdAt` | Not needed for roster display |

---

## 5. Student Data and Privacy

### Exact returned fields

```typescript
student: {
  id: string;         // UUID, usable as React key and for linking to learner profile
  firstName: string;  // Always present (DB NOT NULL but may be blank string)
  lastName: string;   // Always present (DB NOT NULL but may be blank string)
  email: string | null;     // null for INTERNAL_STUDENT accounts that enrolled by matricule
  matricule: string | null; // null for EXTERNAL_LEARNER accounts that enrolled by email
}
```

### Why `email` is included
The admin formation management UI needs to identify and contact learners. Email is the primary identity token for external learners (`EXTERNAL_LEARNER` account type). Without it, the admin cannot act on a `PENDING_PAYMENT` row.

### Confirmed NOT returned

The E2E test (`test/enrollments-formation-roster.e2e-spec.ts`, `assertRosterItemHasPublicStudentOnly`) asserts that the `student` object contains **exactly**:

```
['email', 'firstName', 'id', 'lastName', 'matricule']
```

And explicitly asserts absence of:
- `password`
- `accountType`
- `dob`
- `bacYear`

---

## 6. Performance

### Query strategy

No N+1 queries. All data for a page is loaded in **two parallel SQL queries** per request:

1. **Data query** — one `SELECT` with:
   - `INNER JOIN users` (learner identity)
   - `INNER JOIN formations` (formation card)
   - `LEFT JOIN languages` (formation language)
   - `LEFT JOIN formation_levels` (formation level)
   - Correlated subquery for `formationEnrolledCount` (counts `ENROLLED` rows per formation row — one subquery per page row, resolved by the DB)

2. **Count query** — one `SELECT count(*)` with `INNER JOIN users` to respect search filters against user columns.

3. **Attendance batch** — after the page is loaded, a second call to `getAttendanceSummariesByEnrollmentIds(ids)` loads attendance for the page's enrollment IDs. This is a two-query batched approach (no per-row queries).

### Indexes on `enrollments`

From `src/db/schema.ts`:
- `UNIQUE (student_id, formation_id)` — enforces one-enrollment-per-student-per-formation
- `formation_id` is covered by the unique index

The `users` table has:
- `UNIQUE (email)` — used by search ilike (not an exact hit but ilike is sequential on most PG versions without pg_trgm; acceptable for admin lists with typical formation sizes)

For formations with hundreds of enrollments, the `enrollments.formation_id` filter + `ORDER BY enrolledAt DESC` is efficient with the existing unique index.

---

## 7. Error Handling

| HTTP | Message / Code | Meaning | Suggested French UI message |
|------|----------------|---------|------------------------------|
| **400** | `Validation failed` (NestJS `ValidationPipe`) | Invalid query param (e.g. non-UUID `formationId` in URL, invalid `status` value) | "Paramètres de requête invalides." |
| **401** | `Unauthorized` | Missing or expired JWT | "Session expirée. Veuillez vous reconnecter." |
| **403** | `Forbidden resource` | Valid JWT but role is not `ADMIN` (teacher, learner) | "Vous n'avez pas accès à cette liste d'inscriptions." |
| **404** | `Formation not found` | Formation UUID valid but row not found in DB | "Formation introuvable." |
| **500** | — | Unexpected server error | "Une erreur est survenue. Veuillez réessayer." |

The 400 for a malformed UUID in the path param (`formationId`) is handled by NestJS `ParseUUIDPipe` and returns a `400 Bad Request` before the service is called.

---

## 8. Frontend Integration Notes

### Endpoint constant

```typescript
// constants/endpoints.ts
export const ENDPOINTS = {
  enrollments: {
    byFormation: (formationId: string) =>
      `/enrollments/formation/${formationId}`,
  },
};
```

### TypeScript types

```typescript
// types/enrollment.ts

export type EnrollmentStatus = 'ENROLLED' | 'CANCELLED' | 'PENDING_PAYMENT';

export interface RosterStudent {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  matricule: string | null;
}

export interface RosterFormation {
  id: string;
  title: string;
  description: string | null;
  price: string | null;
  capacity: number | null;
  enrolledCount: number;
  spotsRemaining: number | null;
  isSaleOpen: boolean;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  language: { id: string | null; name: string | null; code: string | null };
  level: { id: string | null; code: string | null; name: string | null };
}

export interface AttendanceSummary {
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  unmarkedCount: number;
  totalSessionsCount: number;
  attendanceRate: number;
}

export interface FormationEnrollmentRosterItem {
  id: string;
  studentId: string;
  formationId: string;
  status: EnrollmentStatus;
  enrolledAt: string;
  /** @deprecated Use student.firstName + student.lastName instead */
  studentName: string | null;
  student: RosterStudent;
  formation: RosterFormation;
  attendanceSummary: AttendanceSummary;
}

export interface FindFormationEnrollmentsQuery {
  page?: number;
  limit?: number;
  status?: EnrollmentStatus;
  search?: string;
  sortBy?: 'enrolledAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}
```

### Service method

```typescript
// services/enrollment.service.ts
async function listByFormation(
  formationId: string,
  query?: FindFormationEnrollmentsQuery,
): Promise<PaginatedResponse<FormationEnrollmentRosterItem>> {
  const params = new URLSearchParams();
  if (query?.page)       params.set('page', String(query.page));
  if (query?.limit)      params.set('limit', String(query.limit));
  if (query?.status)     params.set('status', query.status);
  if (query?.search)     params.set('search', query.search);
  if (query?.sortBy)     params.set('sortBy', query.sortBy);
  if (query?.sortOrder)  params.set('sortOrder', query.sortOrder);

  const qs = params.toString();
  const url = `/enrollments/formation/${formationId}${qs ? `?${qs}` : ''}`;
  return apiGet<PaginatedResponse<FormationEnrollmentRosterItem>>(url);
}
```

### React Query hook

```typescript
// hooks/useFormationRoster.ts
import { useQuery } from '@tanstack/react-query';

export function useFormationRoster(
  formationId: string,
  query?: FindFormationEnrollmentsQuery,
) {
  return useQuery({
    queryKey: ['enrollments', 'formation', formationId, query],
    queryFn: () => listByFormation(formationId, query),
    enabled: !!formationId,
  });
}
```

### Cache invalidation

Invalidate `['enrollments', 'formation', formationId]` after:

| Event | Trigger |
|-------|---------|
| New enrollment created | `POST /enrollments` succeeds |
| Payment webhook confirms enrollment | Server-sent event or polling detects status change |
| Enrollment cancelled | Admin or learner cancels |
| Admin changes formation capacity | May affect `spotsRemaining` in the embedded formation card |

### Suggested UI usages

| Page / Component | Use case |
|-----------------|---------|
| Admin formation detail page | Full paginated roster table |
| Formation summary card | `meta.total` or `enrolledCount` badge |
| Post-create formation checklist | Empty state: "Aucun inscrit pour le moment" |
| Roster dialog / sheet | Filtered view by status |
| Pending payment indicator | Filter `status=PENDING_PAYMENT` to show a warning badge |
| Attendance overview | Use `attendanceSummary.attendanceRate` per row |

---

## 9. UI Mapping Recommendations

### Status labels (French)

| Status | Label | Color suggestion |
|--------|-------|----------------|
| `ENROLLED` | **Inscrit** | Green |
| `PENDING_PAYMENT` | **Paiement en attente** | Amber |
| `CANCELLED` | **Annulé** | Gray / Red |

### Learner display name

```typescript
function displayName(student: RosterStudent): string {
  const full = [student.firstName, student.lastName]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(' ');
  if (full) return full;
  if (student.email) return student.email;
  if (student.matricule) return student.matricule;
  return 'Apprenant sans nom';
}
```

### Learner secondary identifier

```typescript
function secondaryIdentifier(student: RosterStudent): string | null {
  // External learners: email is primary; matricule may be null
  // Internal students: matricule is primary; email may be null
  if (student.matricule) return `N° ${student.matricule}`;
  if (student.email) return student.email;
  return null;
}
```

### Price display

`formation.price` is a numeric string or `null`.

```typescript
function displayPrice(price: string | null): string {
  if (!price || price === '0' || price === '0.00') return 'Gratuit';
  return `${Number(price).toLocaleString('fr-DZ')} DZD`;
}
```

### Attendance rate

`attendanceSummary.attendanceRate` is an integer 0–100. Use a progress bar or badge. Show "–" when `totalSessionsCount === 0`.

---

## 10. Tests

### Test file

`test/enrollments-formation-roster.e2e-spec.ts`

### Test scenarios (10 tests, all passing)

| # | Scenario | Result |
|---|---------|--------|
| 1 | ADMIN lists enrollments — rows have `student.id`, `student.firstName`, `student.lastName`, `student.email`, `studentName` | ✅ |
| 2 | Empty formation returns `data: []` with correct meta | ✅ |
| 3 | Unknown formation UUID → 404 | ✅ |
| 4 | Teacher token → 403 | ✅ |
| 5 | No token → 401 | ✅ |
| 6 | `status=ENROLLED` filters correctly | ✅ |
| 7 | `status=PENDING_PAYMENT` filters correctly | ✅ |
| 8 | `search` matches `firstName`, `lastName`, `email`, `matricule` | ✅ |
| 9 | Pagination meta: `totalPages`, `hasNextPage`, `hasPreviousPage` correct | ✅ |
| 10 | No sensitive fields (`password`, `dob`, `accountType`, `bacYear`) in JSON | ✅ |

### Commands

```bash
# Run only roster tests
npm run test:e2e -- test/enrollments-formation-roster.e2e-spec.ts

# Run full suite (regression)
npm run test:e2e
```

### Results

```
Test Suites: 1 passed, 1 total       (roster suite)
Tests:       10 passed, 10 total

Test Suites: 18 passed, 18 total     (full suite)
Tests:       145 passed, 145 total
```

---

## 11. Files Changed

### Controller

| File | Change |
|------|--------|
| `src/modules/enrollments/enrollments.controller.ts` | Added `@ApiBearerAuth()`, `@ApiOperation` description, `@ApiResponse` with DTO type for `formation/:formationId` route. Imported `FormationEnrollmentRosterPageDto`. |

### Service

| File | Change |
|------|--------|
| `src/modules/enrollments/enrollments.service.ts` | `getFormationEnrollments`: explicit field mapping — strips `accountType` from `student`, adds `studentName` computed field, structures `student` object with only public fields. |

### Repository

| File | Change |
|------|--------|
| `src/lib/repositories/enrollments/enrollments.repository.ts` | `findByFormationPaginated`: added `search` (`ILIKE` on `firstName`, `lastName`, `email`, `matricule`), `sortBy`/`sortOrder` support, `student` without `accountType` in select, `INNER JOIN users` on count query so count respects search. |

### DTOs

| File | Change |
|------|--------|
| `src/modules/enrollments/dto/formation-enrollment-roster.dto.ts` | **New file.** `FormationEnrollmentStudentDto`, `FormationEnrollmentRosterItemDto`, `FormationEnrollmentRosterPageDto`, `PaginationMetaSwaggerDto`. |
| `src/modules/enrollments/dto/find-enrollments-query.dto.ts` | Added description to `status` field. |

### Tests

| File | Change |
|------|--------|
| `test/enrollments-formation-roster.e2e-spec.ts` | **New file.** 10 E2E tests covering all scenarios above. |

---

## 12. Known Limitations / Future Work

| Item | Status |
|------|--------|
| `search` implemented | ✅ Yes — `firstName`, `lastName`, `email`, `matricule` |
| `sortBy` implemented | ✅ Yes — `enrolledAt` (default) and `status` |
| `sortBy` for student name | ❌ Not supported (would require composite sort on `firstName + lastName`) |
| Payment detail in row | ❌ Not included — payment checkout URL / amount is not returned. Use `GET /payments` for payment data |
| Teacher access | ❌ Teachers use separate `GET /enrollments/teacher` endpoint (ENROLLED-only, scoped to their formations) |
| Admin UI client integration | ⏳ Pending — this document describes the backend contract for the Next.js client team |
| Admin export (CSV / PDF) | ❌ Not implemented |
| Bulk status update | ❌ Not implemented |
| Formation capacity warnings in response | ℹ️ `formation.spotsRemaining` is available in the embedded card |

---

## 13. Final Checklist for Frontend

- [ ] Add or update endpoint constant `enrollments.byFormation(formationId)`
- [ ] Add `FormationEnrollmentRosterItem`, `RosterStudent`, `FindFormationEnrollmentsQuery` TypeScript types
- [ ] Add `listByFormation(formationId, query?)` service method
- [ ] Add `useFormationRoster(formationId, query?)` React Query hook with key `['enrollments', 'formation', formationId, query]`
- [ ] Use `student.firstName` and `student.lastName` as primary name source (not `studentName`)
- [ ] Implement display name fallback: full name → email → matricule → "Apprenant sans nom"
- [ ] Show `student.matricule` for internal students, `student.email` for external learners
- [ ] Render status badges: `ENROLLED` → Inscrit (green), `PENDING_PAYMENT` → Paiement en attente (amber), `CANCELLED` → Annulé (gray)
- [ ] Add loading skeleton, empty state ("Aucun inscrit"), and error state
- [ ] Implement pagination controls using `meta.totalPages`, `meta.hasNextPage`, `meta.hasPreviousPage`
- [ ] Add `status` filter tab/select for `ENROLLED` / `PENDING_PAYMENT` / `CANCELLED` / All
- [ ] Add search input — debounce before sending `search` query param
- [ ] Invalidate query cache after enrollment creation, payment confirmation, and cancellation
- [ ] Do not display `studentName`, `password`, `dob`, `accountType`, `bacYear` in any UI element
- [ ] Verify `npm run build` passes after client changes
- [ ] Verify `npm run test:e2e` still passes (145 tests, 18 suites)
