# Teachers API (Admin & Enseignant)

Reference for **admin teacher management** (list, detail, assignments, calendar) and **teacher self-service** (`/teachers/me/*`). Includes the **admin stats** endpoint for dashboard cards on the teachers (enseignants) page.

---

## 1. Overview

- **Teachers** live in the dedicated **`teachers`** table (not `users`): `firstName`, `lastName`, `email` (unique), `password` (hashed), timestamps.
- JWT role for a logged-in teacher is still **`"ENSEIGNANT"`** so existing `@Auth(UserRole.ENSEIGNANT)` guards work unchanged; `sub` is the **`teachers.id`**.
- **Learners** remain in `users` with `role = "APPRENANT"` (or `ADMIN` for staff). There is no `ENSEIGNANT` value on `users.role` anymore.
- Assignments link a teacher to a formation via **`formation_teachers.teacher_id` → `teachers.id`** (many-to-many with formations).
- Admin routes live under `TeachersController` (`/teachers/*`). Teacher self-service: `TeachersMeController` at `/teachers/me/*` registered **before** parameterized admin routes.

---

## 2. Auth summary

| Area | Role |
|------|------|
| All routes in `TeachersController` | `ADMIN` only (`@Controller` + `@Auth(UserRole.ADMIN)`) |
| All routes in `TeachersMeController` | `ENSEIGNANT` JWT (teacher account; `sub` = `teachers.id`) |

**Login:** `POST /auth/login` with `loginType: "TEACHER"`, `email`, `password` (teacher email from `teachers.email`). See [Teachers entity migration](teachers-entity-migration.md).

---

## 3. Admin stats (new)

### `GET /teachers/admin/stats`

**Auth:** `ADMIN` only.

**Purpose:** Populate stat cards on the admin teachers page (totals, coverage, assignment links).

**Response `200` — `AdminTeacherStatsDto`:**

```ts
type AdminTeacherStatsDto = {
  totalTeachers: number;
  teachersWithAssignments: number;
  teachersWithoutAssignments: number;
  totalAssignments: number;
  formationsWithTeacher: number;
};
```

| Field | Definition |
|-------|------------|
| `totalTeachers` | Count of rows in **`teachers`** |
| `teachersWithAssignments` | `COUNT(DISTINCT teacher_id)` on `formation_teachers` |
| `teachersWithoutAssignments` | `max(0, totalTeachers - teachersWithAssignments)` |
| `totalAssignments` | Total rows in `formation_teachers` (each link is one assignment) |
| `formationsWithTeacher` | `COUNT(DISTINCT formation_id)` on `formation_teachers` |

**Example:**

```json
{
  "totalTeachers": 12,
  "teachersWithAssignments": 9,
  "teachersWithoutAssignments": 3,
  "totalAssignments": 24,
  "formationsWithTeacher": 18
}
```

**Notes:**

- If there are no assignment rows, `teachersWithAssignments`, `totalAssignments`, and `formationsWithTeacher` are `0`; `teachersWithoutAssignments` equals `totalTeachers`.
- Counts are normalized to JavaScript `number` types.

---

## 4. Admin — create teacher

### `POST /teachers`

**Auth:** `ADMIN`

**Body:**

```ts
type CreateTeacherDto = {
  firstName: string;
  lastName: string;
  email: string;
  password: string; // min 6 characters; stored bcrypt-hashed
};
```

**Response `201`:** Created teacher **without** `password` field.

**Errors:** `409` if `email` already exists on `teachers`.

---

## 5. Admin routes — list & detail

### `GET /teachers`

**Auth:** `ADMIN`

**Query:** `FindTeachersQueryDto` extends `PaginationQueryDto`:

- `page`, `limit`, `search`, `sortBy`, `sortOrder`
- `sortBy` supported columns: `createdAt`, `firstName`, `lastName`

**Search:** When `search` is set, matches `ilike` on `firstName`, `lastName`, or **`email`**.

**Response:** `PaginatedResponse<TeacherListItem>`

```ts
type TeacherListItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
};
```

### `GET /teachers/:teacherId`

**Auth:** `ADMIN`

**Response `200`:** Teacher profile + per-teacher stats:

```ts
type TeacherDetailResponse = TeacherListItem & {
  stats: {
    assignedFormationsCount: number;
    enrolledStudentsCount: number;
  };
};
```

| Stat | Meaning |
|------|---------|
| `assignedFormationsCount` | Rows in `formation_teachers` for this teacher |
| `enrolledStudentsCount` | Count of `ENROLLED` enrollments in formations this teacher is assigned to (not distinct learners — matches repository semantics) |

**404** if no teacher with that id.

---

## 6. Admin — formations & assignments

### `GET /teachers/:teacherId/formations`

**Auth:** `ADMIN`

**Query:** `FindTeacherFormationsQueryDto` (pagination + optional `search`, `languageId`, `levelId`; sort by `createdAt`, `title`, `startDate`).

**Response:** Paginated rows with formation fields, nested `language` / `level`, plus `assignmentRole`, `assignedAt` from `formation_teachers`.

### `POST /teachers/:teacherId/formations/:formationId`

**Auth:** `ADMIN`

**Purpose:** Assign teacher to formation.

**Business rules (assignment service):**

- Target **`teachers.id`** must exist (`:teacherId`).
- Formation must exist.
- Formation must have both `startDate` and `endDate`.
- No duplicate `(teacherId, formationId)` pair.
- The teacher must have **no other assignment** to a formation that is missing `startDate` or `endDate` (otherwise overlap cannot be verified — fix the other formation first).
- **Schedule overlap:** another assigned formation with **both** dates set must **not** overlap this formation’s interval. Overlap uses strict inequalities (`existing.start < new.end` **and** `existing.end > new.start`), so **back-to-back** sessions that only touch at an instant are allowed.
- When an admin **changes** a formation’s dates via `PATCH /formations/:id`, the same overlap rules are re-run for all teachers assigned to that formation.

**201** on success. Errors: `400`, `404`, `409`.

### `DELETE /teachers/:teacherId/formations/:formationId`

**Auth:** `ADMIN`

**204** on success.

---

## 7. Admin — calendar

### `GET /teachers/:teacherId/calendar`

**Auth:** `ADMIN`

**Query:** `FindTeacherCalendarQueryDto` — optional **`from`**, **`to`** (ISO date/datetime; optional **`search`**). No pagination. Invalid range → **400**. Full behaviour: [`teacher-calendar-api.md`](teacher-calendar-api.md).

**Response:** Non-paginated `{ data }` — lightweight preview only (no enrollments). Use **`formationId`** for detail: `GET /teachers/me/formations/:formationId` and roster: `.../enrollments`.

```ts
type TeacherCalendarResponse = {
  data: Array<{
    id: string;
    formationId: string;
    title: string;
    startsAt: string | null;
    endsAt: string | null;
    language: { id: string | null; name: string | null; code: string | null };
    level: { id: string | null; code: string | null; name: string | null };
    status: "OPEN" | "CLOSED";
    enrolledCount: number;
    type: "FORMATION";
    assignmentRole: "MAIN_TEACHER" | "ASSISTANT";
    assignedAt: string;
    capacity: number | null;
    spotsRemaining: number | null;
  }>;
};
```

---

## 8. Enseignant — self routes (`/teachers/me`)

Same capabilities as admin for the **current teacher**, scoped by **JWT `sub`** (`teachers.id`):

| Method | Path | Summary |
|--------|------|---------|
| `GET` | `/teachers/me/formations` | My formations (paginated) |
| `GET` | `/teachers/me/formations/:formationId` | My formation detail (`TeacherFormationAccessGuard`) |
| `GET` | `/teachers/me/calendar` | My calendar |
| `GET` | `/teachers/me/formations/:formationId/enrollments` | Enrollments for a formation I teach |
| `GET` | `/teachers/me/formations/:formationId/certificates` | Certificates for a formation I teach |

Guards ensure the teacher is assigned to `:formationId` before returning enrollments/certificates/detail.

---

## 9. Route registration note

In `TeachersModule`, **`TeachersMeController` is listed before `TeachersController`** so paths like `/teachers/me/formations` resolve correctly.

In `TeachersController`, **`GET /teachers/admin/stats` is registered before `GET /teachers/:teacherId`** so `admin` is never interpreted as a UUID.

---

## 10. Frontend integration (admin teachers page)

1. On load: call `GET /teachers/admin/stats` for the stat cards, then `GET /teachers` for the table.
2. Create teacher: `POST /teachers` with firstName, lastName, email, password.
3. Row click: `GET /teachers/:teacherId` for profile + `stats`; optional tab to `GET /teachers/:teacherId/formations`.
4. Assign / unassign: use `POST` and `DELETE` on the nested formation paths; refresh stats + list after mutation.
5. Calendar view: `GET /teachers/:teacherId/calendar`.
6. List search matches **name and email** (no matricule on teachers).

---

## 11. Error reference (common)

| Code | Typical cause |
|------|----------------|
| `400` | Invalid assignment (formation missing dates, overlap rule) |
| `401` | Missing or invalid JWT |
| `403` | Non-admin on admin routes, non-teacher on `me` routes |
| `404` | Teacher or formation not found |
| `409` | Duplicate teacher–formation assignment |

---

*Generated for UBMA CEIL — teachers (admin stats + API contract).*
