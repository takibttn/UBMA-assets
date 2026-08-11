# Learner formation detail — API proposal (follow-up)

This document complements the codebase review for `/apprenant/formations`. It describes the **current** `GET /api/v1/formations/:id` contract and a **proposed** extended response for a Coursera-style detail dialog/page **without inventing schema**: only fields that exist or can be derived from existing tables.

---

## Current endpoint (already implemented)

### Request

| Item | Value |
|------|--------|
| Method | `GET` |
| Path | `/api/v1/formations/:id` |
| Auth | Bearer JWT; **`@Auth()`** — any authenticated role (`ADMIN`, `ENSEIGNANT`, `APPRENANT`) |
| Params | `id` — UUID |

No query body. No `saleStatus` on this route (list-only).

### Current response shape (repository projection)

Returned by `FormationsRepository.findByIdWithLanguageAndLevel` via `FormationsService.getFormationById`.

```ts
type FormationDetailCurrent = {
  id: string;
  title: string;
  description: string | null;
  creatorId: string | null;
  languageId: string | null;
  levelId: string | null;
  price: string | null; // Drizzle numeric → string
  capacity: number | null;
  isSaleOpen: boolean;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
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
```

### Gaps vs learner detail UI

| Desired UI signal | In current response? |
|-------------------|----------------------|
| `enrolledCount` | **No** (present on **list** only, via subquery) |
| `remainingSeats` | **No** (derivable: `capacity - enrolledCount` when `capacity` set) |
| “Already enrolled” for **current user** | **No** (needs enrollment lookup by `studentId` + `formationId`) |
| Teachers | **No** (`formation_teachers` + `teachers` exist in DB) |
| Next session / schedule summary | **No** (`formation_sessions` + `rooms` exist) |
| Certificate / eligibility | **Partial** — certificates are keyed by **enrollment**, not formation alone; eligibility rules are product-defined |
| `updatedAt` on formation | **No column** on `formations` table (only `createdAt`) |

---

## Proposed extended DTO (future implementation)

Use a dedicated Swagger DTO e.g. `LearnerFormationDetailDto` (or query-variant) **or** overload the same route with optional query `?context=learner` to avoid breaking admins — product decision.

### Response (TypeScript)

Only fields that are **realistic** from current schema / simple joins / counts:

```ts
/** Serialize dates as ISO 8601 strings in JSON. */
type LearnerFormationDetailResponse = {
  // ── Core formation (existing) ─────────────────────────────────────
  id: string;
  title: string;
  description: string | null;
  languageId: string | null;
  levelId: string | null;
  price: string | null;
  capacity: number | null;
  isSaleOpen: boolean;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;

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

  // ── Catalogue metrics (same semantics as list `enrolledCount`) ─────
  /** Count of enrollments with status ENROLLED for this formation. */
  enrolledCount: number;
  /** Present only when `capacity` is non-null; max(0, capacity - enrolledCount). */
  remainingSeats: number | null;
  /** True when capacity set and remainingSeats === 0. */
  isFull: boolean;

  // ── Current learner context (requires authenticated APPRENANT viewer) ─
  /** Omitted or null if not APPRENANT or anonymous; future: optional scope. */
  myEnrollment?: {
    enrollmentId: string;
    status: 'ENROLLED' | 'CANCELLED';
    enrolledAt: string;
  } | null;

  // ── Teachers (join `formation_teachers` + `teachers` + `users` if name on users) ─
  teachers?: Array<{
    teacherId: string;
    role: 'MAIN_TEACHER' | 'ASSISTANT'; // matches `formation_teacher_role` enum
    /** Display name — source column depends on existing teacher/user schema. */
    displayName: string;
  }>;

  // ── Schedule highlights (from `formation_sessions` + optional `rooms`) ─
  /** Next non-CANCELLED session with startAt >= now, earliest first; omit if none. */
  nextSession?: {
    sessionId: string;
    title: string;
    startAt: string;
    endAt: string;
    status: string;
    room?: {
      id: string;
      code: string;
      name: string;
    };
  };

  /** Optional: total session count or bounded list — product-defined limits. */
  sessionsSummary?: {
    totalSessions: number;
    scheduledCount: number;
  };

  // ── Certificate hint (optional, enrollment-scoped) ─────────────────
  /** Only when `myEnrollment` is ENROLLED; certificate exists if row in `certificates`. */
  hasCertificate?: boolean;
};
```

### Fields explicitly **not** in schema (do not promise without migration)

- `updatedAt` on formations
- `requirements` / `prerequisites` text (no column on `formations` today)
- Dedicated “registration status label” string — derive in UI from `isSaleOpen`, `isFull`, `myEnrollment`

---

## List endpoint alignment (`GET /api/v1/formations`)

For catalogue filters, the list DTO supports **`saleStatus`**: `OPEN` | `CLOSED` | `ALL` | omitted. Frontend should use `saleStatus=OPEN` for learner browse when only open formations must appear.

Query params supported today (see `FindFormationsQueryDto` + `PaginationQueryDto`): `page`, `limit`, `search`, `sortBy`, `sortOrder`, `languageId`, `levelId`, `saleStatus`.

---

## Suggested implementation order (backend)

1. Extend `findByIdWithLanguageAndLevel` or add `findByIdForLearnerDetail(formationId, viewerUserId?)` with subqueries / joins.
2. Add `enrolledCount` subquery (same as list).
3. Compute `remainingSeats` / `isFull` in service layer.
4. If `viewerUserId` is APPRENANT, left join enrollment for `myEnrollment`.
5. Optional: `nextSession` single-row query; `teachers` list query.
6. Swagger DTO + E2E tests.

---

## QA checklist (when implemented)

- Anonymous vs APPRENANT: `myEnrollment` visibility.
- `enrolledCount` matches list row for same formation id.
- Full formation: `capacity` null → `remainingSeats` null, `isFull` false (or product rule).
- Closed sale: `isSaleOpen` false; enrollment POST still rejected with existing message.
