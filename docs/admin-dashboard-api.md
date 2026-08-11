# Admin Dashboard API

Reference documentation for the admin dashboard endpoints introduced in the `admin-dashboard-refactor` implementation.

---

## 1. Overview

The admin dashboard exposes 6 focused endpoints replacing the previous single `GET /dashboard/admin` endpoint. Each endpoint returns a specific slice of data required by the dashboard UI, keeping response payloads small and queries fast.

The legacy endpoint `GET /dashboard/admin` is preserved as a deprecated fallback.

---

## 2. Auth Requirements

Every endpoint in this document requires:

- A valid `Bearer` JWT token in the `Authorization` header.
- The JWT must carry `role: "ADMIN"`.

Any other role receives `403 Forbidden`.

---

## 3. Endpoint List

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard/admin/stats` | Stats cards (counts) |
| GET | `/dashboard/admin/formation-tracking/by-capacity` | Formations approaching capacity |
| GET | `/dashboard/admin/formation-tracking/by-deadline` | Formations close to end date |
| GET | `/dashboard/admin/alerts` | Priority admin alerts |
| GET | `/dashboard/admin/top-formations` | Top formations by enrollment (+ ratings & attendance metrics) |
| GET | `/dashboard/admin/top-teachers` | Top teachers by formations |
| GET | `/dashboard/admin/top-learners` | Top **learners** by attendance/completion (not grades) |
| GET | `/dashboard/admin` | *Deprecated* — single legacy blob |

---

## 4. Query Parameters

### Shared params (applicable per endpoint)

| Param | Type | Default | Min | Max | Used by |
|-------|------|---------|-----|-----|---------|
| `limit` | integer | 5 | 1 | 50 | capacity, deadline, top-formations, top-teachers, **top-learners** |
| `minOccupancyRate` | integer | 70 | 0 | 100 | by-capacity |
| `withinDays` | integer | 30 | 1 | 365 | by-deadline |

Invalid values (out of range, non-integer) return `400 Bad Request`.

---

## 5. Endpoints

### `GET /dashboard/admin/stats`

Returns the five stats card values.

**Response `200`:**

```ts
type AdminDashboardStatsDto = {
  openFormations: number;
  pendingFormations: number;
  activeStudents: number;
  certificatesToGenerate: number;
  activeTeachers: number;
};
```

**Example:**

```json
{
  "openFormations": 12,
  "pendingFormations": 3,
  "activeStudents": 147,
  "certificatesToGenerate": 8,
  "activeTeachers": 9
}
```

---

### `GET /dashboard/admin/formation-tracking/by-capacity`

Returns formations sorted by occupancy rate descending.

**Query params:** `limit`, `minOccupancyRate`

**Response `200`:**

```ts
type FormationCapacityTrackingItemDto = {
  formationId: string;
  title: string;
  languageCode: string | null;
  languageName: string | null;
  levelCode: string | null;
  levelName: string | null;
  capacity: number;
  enrolledCount: number;
  occupancyRate: number; // 0-100
  status: "OPEN" | "CLOSED" | "FULL" | "ALMOST_FULL";
};
```

**Example:**

```json
[
  {
    "formationId": "c1a2b3c4-0000-0000-0000-000000000001",
    "title": "Anglais Intermédiaire B2",
    "languageCode": "EN",
    "languageName": "Anglais",
    "levelCode": "B2",
    "levelName": "Intermédiaire",
    "capacity": 20,
    "enrolledCount": 18,
    "occupancyRate": 90,
    "status": "ALMOST_FULL"
  }
]
```

---

### `GET /dashboard/admin/formation-tracking/by-deadline`

Returns formations with an endDate, ordered nearest-first.

**Query params:** `limit`, `withinDays`

**Response `200`:**

```ts
type FormationDeadlineTrackingItemDto = {
  formationId: string;
  title: string;
  languageCode: string | null;
  languageName: string | null;
  levelCode: string | null;
  levelName: string | null;
  startDate: string | null;    // ISO 8601
  endDate: string | null;      // ISO 8601
  daysRemaining: number | null;
  enrolledCount: number;
  status: "ENDING_SOON" | "ENDED" | "ACTIVE" | "UPCOMING";
};
```

**Example:**

```json
[
  {
    "formationId": "c1a2b3c4-0000-0000-0000-000000000002",
    "title": "Français Professionnel A2",
    "languageCode": "FR",
    "languageName": "Français",
    "levelCode": "A2",
    "levelName": "Élémentaire",
    "startDate": "2026-03-01T08:00:00.000Z",
    "endDate": "2026-05-10T18:00:00.000Z",
    "daysRemaining": 9,
    "enrolledCount": 14,
    "status": "ENDING_SOON"
  }
]
```

---

### `GET /dashboard/admin/alerts`

Returns active priority alerts. Alerts with `count = 0` are omitted from the response.

**Response `200`:**

```ts
type AdminAlertDto = {
  id: string;
  type:
    | "PENDING_ENROLLMENTS"
    | "INCOMPLETE_PAYMENTS"
    | "CERTIFICATES_TO_GENERATE";
  severity: "URGENT" | "IMPORTANT" | "WATCH";
  title: string;
  description: string;
  count: number;
  actionLabel: string;
  actionHref: string;
};
```

**Example:**

```json
[
  {
    "id": "incomplete-payments",
    "type": "INCOMPLETE_PAYMENTS",
    "severity": "IMPORTANT",
    "title": "Incomplete Payments",
    "description": "4 payment(s) require attention.",
    "count": 4,
    "actionLabel": "View Payments",
    "actionHref": "/admin/payments?status=INCOMPLETE"
  },
  {
    "id": "certificates-to-generate",
    "type": "CERTIFICATES_TO_GENERATE",
    "severity": "IMPORTANT",
    "title": "Certificates to Generate",
    "description": "8 certificate(s) are ready to be generated.",
    "count": 8,
    "actionLabel": "Generate Certificates",
    "actionHref": "/admin/certificates?pending=true"
  }
]
```

---

### `GET /dashboard/admin/top-formations`

Returns the most enrolled formations with success rate **and** formation-level feedback and attendance metrics (see [FORMATION_TRACKING_AND_FEEDBACK_REFERENCE.md](./FORMATION_TRACKING_AND_FEEDBACK_REFERENCE.md)).

**Query params:** `limit`

**Response `200`:**

```ts
type TopFormationDto = {
  formationId: string;
  title: string;
  languageCode: string | null;
  languageName: string | null;
  levelCode: string | null;
  levelName: string | null;
  enrolledCount: number;
  certificateCount: number;
  successRate: number; // 0-100
  averageRating: number | null;
  ratingCount: number;
  averageAttendanceRate: number; // 0-100, mean of learner rates
  totalSessionsCount: number; // all session statuses
  certificateReadyCount: number; // hint: ended, ENROLLED, no cert row
};
```

**Example:**

```json
[
  {
    "formationId": "c1a2b3c4-0000-0000-0000-000000000003",
    "title": "Espagnol Débutant A1",
    "languageCode": "ES",
    "languageName": "Espagnol",
    "levelCode": "A1",
    "levelName": "Débutant",
    "enrolledCount": 45,
    "certificateCount": 38,
    "successRate": 84,
    "averageRating": 4.2,
    "ratingCount": 30,
    "averageAttendanceRate": 88,
    "totalSessionsCount": 24,
    "certificateReadyCount": 2
  }
]
```

---

### `GET /dashboard/admin/top-learners`

Ranks **APPRENANT** users by average attendance across **ENROLLED** enrollments, then completed formations count, then certificates count. **Not** “top students by grades” (no exam module).

**Query params:** `limit`

**Response `200`:** array of `TopLearnerDto` — see [FORMATION_TRACKING_AND_FEEDBACK_REFERENCE.md](./FORMATION_TRACKING_AND_FEEDBACK_REFERENCE.md).

---

### `GET /dashboard/admin/top-teachers`

Returns the most active teachers by formation count and students taught.

**Query params:** `limit`

**Response `200`:**

```ts
type TopTeacherDto = {
  teacherId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  formationsCount: number;
  studentsCount: number;
};
```

**Example:**

```json
[
  {
    "teacherId": "a1b2c3d4-0000-0000-0000-000000000001",
    "firstName": "Nadia",
    "lastName": "Benali",
    "fullName": "Nadia Benali",
    "formationsCount": 5,
    "studentsCount": 87
  }
]
```

---

## 6. Business Logic Definitions

| Metric | Definition |
|--------|-----------|
| `openFormations` | `isSaleOpen = true` AND (`endDate IS NULL` OR `endDate >= now`) |
| `pendingFormations` | `startDate > now` — not yet started |
| `activeStudents` | Distinct `APPRENANT` users with at least one `ENROLLED` enrollment |
| `activeTeachers` | Distinct `ENSEIGNANT` users assigned to at least one formation |
| `certificatesToGenerate` | `ENROLLED` enrollments where `formation.endDate < now` and no `certificates` row exists |
| `occupancyRate` | `Math.round(enrolledCount / capacity * 100)` |
| `successRate` | `Math.round(certificateCount / enrolledCount * 100)` — `0` when `enrolledCount = 0` |
| `daysRemaining` | `Math.ceil((endDate - now) / MS_PER_DAY)` — negative means the formation has ended |

### Capacity status rules (evaluated in order)

1. `FULL` — `enrolledCount >= capacity`
2. `ALMOST_FULL` — `occupancyRate >= 85` and not full
3. `OPEN` — `isSaleOpen = true`
4. `CLOSED` — `isSaleOpen = false`

### Deadline status rules (evaluated in order)

1. `ENDED` — `endDate < now`
2. `UPCOMING` — `startDate > now`
3. `ENDING_SOON` — `0 <= daysRemaining <= 30`
4. `ACTIVE` — otherwise

---

## 7. Temporary Mock Notes

### `INCOMPLETE_PAYMENTS`

The `INCOMPLETE_PAYMENTS` alert count is **mocked** and hard-coded to `4`.

- Location: `DashboardService.getMockIncompletePaymentsCount()` in `src/modules/dashboard/dashboard.service.ts`
- Reason: No payments module exists in the current codebase.
- Action required: Replace the mock with a real query once a `payments` table / module is implemented. The method is isolated to a single private helper to make the replacement straightforward.

### `PENDING_ENROLLMENTS`

The current enrollment flow **auto-enrolls** students immediately (no approval step). The `enrollmentStatusEnum` only contains `ENROLLED` and `CANCELLED`.

- The `getPendingEnrollmentsCount()` repository method returns `0`.
- Location: `DashboardRepository.getPendingEnrollmentsCount()` in `src/lib/repositories/dashboard/dashboard.repository.ts`
- Action required: When a `PENDING` status is added to the enrollment schema, update this method and migrate the DB enum.

---

## 8. Frontend Integration Notes

1. Call `/dashboard/admin/stats` first to populate stats cards — it is the fastest endpoint.
2. Alerts endpoint returns **only non-zero alerts** — render an empty state when the array is empty.
3. `daysRemaining` can be **negative** for ended formations — use it to display "N days ago" where appropriate.
4. `successRate`, `occupancyRate` are already **rounded integers** (0–100) — no further rounding needed client-side.
5. All nullable fields (`languageCode`, `languageName`, `levelCode`, `levelName`, `startDate`, `endDate`) should be handled with fallback labels (e.g. `"—"` or `"N/A"`).
6. `formationsByStatus.open / closed` in the legacy endpoint duplicates `openFormations / closedFormations` from stats — prefer the new `/stats` endpoint.

---

*Generated for UBMA CEIL — admin dashboard backend contract.*
