# Learner profile API (APPRENANT)

Backend contract for the **profile-oriented learner experience**: overview stats, card-shaped enrollments with **progress state**, and integration with existing **`GET /certificates/me`**.

Global prefix: **`/api/v1`**. Auth: **`Bearer` JWT** with `role: APPRENANT`. CANCELLED enrollments are **excluded** from profile defaults.

---

## 1. Progress model (authoritative)

For enrollments with **`status = ENROLLED`**, derived fields:

| `progressState` | Rule |
|-----------------|------|
| `COMPLETED` | `formation.endDate != null` **and** `formation.endDate < now` (server clock) |
| `UPCOMING` | Not completed **and** `formation.startDate != null` **and** `formation.startDate > now` |
| `ACTIVE` | All other ENROLLED cases (e.g. both dates null, only end in the future, started but not ended by `endDate`) |

| `profileBucket` | Meaning |
|-------------------|---------|
| `IN_PROGRESS` | `UPCOMING` + `ACTIVE` (not yet completed by end date) |
| `COMPLETED` | `progressState === COMPLETED` |

Implementation (single source of truth): [`src/modules/enrollments/domain/learner-enrollment-progress.ts`](../src/modules/enrollments/domain/learner-enrollment-progress.ts).

SQL filters for list pagination use the same partition as counts: **COMPLETED** ⇒ `endDate IS NOT NULL AND endDate < now`; **IN_PROGRESS** ⇒ `endDate IS NULL OR endDate >= now`.

---

## 2. `GET /dashboard/student/overview`

**Auth:** `APPRENANT`

**Purpose:** Lightweight **profile header** — counts + optional **next** in-progress highlight card.

**Response** (`LearnerProfileOverviewResponseDto`):

```json
{
  "summary": {
    "totalEnrollmentsCount": 5,
    "inProgressEnrollmentsCount": 3,
    "completedEnrollmentsCount": 2,
    "certificatesCount": 1
  },
  "nextFormation": {
    "enrollmentId": "uuid",
    "enrollmentStatus": "ENROLLED",
    "enrolledAt": "2026-05-01T10:00:00.000Z",
    "progressState": "UPCOMING",
    "profileBucket": "IN_PROGRESS",
    "formation": {
      "id": "uuid",
      "title": "CEIL Academic Formation 01",
      "description": "…",
      "startDate": "2026-09-01T08:00:00.000Z",
      "endDate": "2026-10-01T17:00:00.000Z",
      "price": "1500.00",
      "capacity": 20,
      "isSaleOpen": true,
      "enrolledCount": 14,
      "language": { "id": "…", "name": "English", "code": "EN" },
      "level": { "id": "…", "code": "B2", "name": "Intermediate" }
    }
  }
}
```

- **`summary.*`**: only **`ENROLLED`** enrollments; cancelled rows are ignored.
- **`certificatesCount`**: rows in `certificates` linked to this learner’s enrollments.
- **`nextFormation`**: `null` if there is no **IN_PROGRESS** enrollment. Otherwise the “best” highlight among in-progress rows: prefer **UPCOMING** (soonest `startDate`), then **ACTIVE** (soonest `endDate`, etc.). Selection is deterministic (see `compareForNextFormationHighlight` in the domain file).

**Errors:** `401` / `403` as for other role guards.

---

## 3. `GET /enrollments/me/profile`

**Auth:** `APPRENANT`

**Purpose:** Paginated **enrollment cards** for tabs: **In progress**, **Completed**, or **All** (ENROLLED only).

### Query — `FindLearnerProfileEnrollmentsQueryDto`

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `bucket` | `IN_PROGRESS` \| `COMPLETED` \| `ALL` | `ALL` | Filter by profile bucket. |
| `page` | int | `1` | |
| `limit` | int | `10` | Max `100`. |
| `sortBy` | string | `enrolledAt` | `enrolledAt` \| `formationStartDate` \| `formationEndDate` |
| `sortOrder` | `asc` \| `desc` | `desc` | |

### Response

Standard pagination envelope:

```ts
{
  data: LearnerEnrollmentCardItem[];  // see shape below
  meta: { page, limit, total, totalPages, hasNextPage, hasPreviousPage };
}
```

**`LearnerEnrollmentCardItem`** (each element):

- `enrollmentId`, `enrollmentStatus` (`ENROLLED` \| `CANCELLED` — only `ENROLLED` returned here), `enrolledAt` (ISO)
- `progressState`, `profileBucket`
- `formation`: same nested shape as in `nextFormation` above (`enrolledCount`, `language`, `level` nullable object normalized to `{ id, name, code }` / `{ id, code, name }` with null fields when unlinked)

---

## 4. Certificates (unchanged)

Continue using **`GET /certificates/me`** for the certificates tab — list items still include `formation`, `verificationUrl`, etc.

---

## 5. Deprecated (backward compatibility)

| Endpoint | Notes |
|---------|--------|
| `GET /dashboard/student` | Legacy payload (`enrolledFormationsCount`, `upcomingEnrollmentsCount`, raw `enrolledFormations`, `nextFormation`). Prefer **`GET /dashboard/student/overview`** + **`GET /enrollments/me/profile`**. |
| `GET /enrollments/me` | Raw enrollment rows without formation card. Prefer **`GET /enrollments/me/profile`**. |

---

## 6. Related code

| Piece | Location |
|-------|-----------|
| Overview + profile list service | [`enrollments.service.ts`](../src/modules/enrollments/enrollments.service.ts) |
| Dashboard delegation | [`dashboard.service.ts`](../src/modules/dashboard/dashboard.service.ts) |
| Repository (counts, cards, pagination) | [`enrollments.repository.ts`](../src/lib/repositories/enrollments/enrollments.repository.ts) |
| Certificate count | [`certificates.repository.ts`](../src/lib/repositories/certificates/certificates.repository.ts) (`countByStudentId`) |

---

*UBMA CEIL — learner profile backend contract.*
