# Enseignant (teacher) API — business logic, types & stats (client / LLM sync)

Use this document to **validate a client implementation** against the UBMA API: routes, **authoritative business rules**, **response shapes**, **counting semantics**, and **known gaps** (ignored query params, naming quirks).

**Audience:** `UserRole.ENSEIGNANT` in JWT = `"ENSEIGNANT"`. **`sub`** is **`teachers.id`** (UUID), not `users.id`.

**Auth:** `Authorization: Bearer <accessToken>` after `POST /auth/login` with `loginType: "TEACHER"`, `email`, `password`.

---

## 1. Domain model (what “assigned” means)

| Concept | Table / rule |
|--------|----------------|
| Teacher account | Row in **`teachers`** (`firstName`, `lastName`, `email`, `password` hash). |
| Teaching assignment | Row in **`formation_teachers`**: `(formationId, teacherId)` unique; optional `role` `MAIN_TEACHER` \| `ASSISTANT`; `assignedAt`, `assignedById` (admin `users.id`). |
| Learner enrollment | Row in **`enrollments`**: `studentId` → **`users.id`**, `formationId`, `status` `ENROLLED` \| `CANCELLED`. |
| Access rule | For nested routes under **`/teachers/me/formations/:formationId/*`**, **`TeacherFormationAccessGuard`** requires an assignment row for `(JWT sub, formationId)`. Failure → **403** `You cannot access this formation`. |

---

## 2. All HTTP routes for `ENSEIGNANT`

| Method | Path | Controller module |
|--------|------|---------------------|
| `POST` | `/auth/login` | `auth` (not teachers) |
| `GET` | `/dashboard/teacher` | `dashboard` |
| `GET` | `/enrollments/teacher` | `enrollments` |
| `GET` | `/enrollments/teacher/:enrollmentId` | `enrollments` |
| `GET` | `/teachers/me/formations` | `teachers` |
| `GET` | `/teachers/me/formations/:formationId` | `teachers` (+ guard) |
| `GET` | `/teachers/me/calendar` | `teachers` |
| `GET` | `/teachers/me/formations/:formationId/enrollments` | `teachers` (+ guard) |
| `GET` | `/teachers/me/formations/:formationId/certificates` | `teachers` (+ guard) |

Teachers **do not** use `POST /enrollments` (APPRENANT only).

---

## 3. Login (shared auth)

**`POST /auth/login`**

**Body:**

```ts
type TeacherLoginBody = {
  loginType: 'TEACHER';
  email: string;
  password: string; // min 6 chars (class-validator)
};
```

**Business logic:** Email normalized **lowercase**; bcrypt compare against **`teachers.password`**. Wrong credentials → **401** `Invalid credentials`.

**Success `200`:**

```ts
type TeacherLoginSuccess = {
  accessToken: string;
  user: {
    id: string;              // teachers.id — use as API identity
    firstName: string;
    lastName: string;
    role: 'ENSEIGNANT';
    accountType: string | null; // always null for teachers today
    email: string;
  };
};
```

**JWT payload** (unsigned view): `{ sub: teachers.id, role: 'ENSEIGNANT' }`.

---

## 4. `GET /dashboard/teacher`

**Auth:** `ENSEIGNANT`.

**Business logic:** Loads in parallel:

1. **`getTeacherStats(teacherId)`** — scalar counts (see §7.1).
2. **`getTeacherAssignedFormations(teacherId)`** — all formations linked via `formation_teachers` (full formation rows).
3. **`getUpcomingTeacherFormations(teacherId)`** — assigned formations where **`startDate >= now`**, ordered by `startDate` ascending.

**Response shape:**

```ts
type TeacherDashboardResponse = TeacherStats & {
  upcomingAssignedFormations: FormationRow[];
  assignedFormations: FormationRow[];
};

// FormationRow ≈ DB row: id, title, description, languageId, levelId,
// creatorId, price, capacity, isSaleOpen, startDate, endDate, createdAt
// price: numeric from Postgres — often serialized as string in JSON
interface FormationRow {
  id: string;
  title: string;
  description: string | null;
  languageId: string | null;
  levelId: string | null;
  creatorId: string | null;
  price: string | null; // or number depending on driver/serialization
  capacity: number | null;
  isSaleOpen: boolean;
  startDate: string | null; // ISO date-time if set
  endDate: string | null;
  createdAt: string;
}
```

**Compatibility note:** `upcomingAssignedFormations` is a **subset** conceptually of `assignedFormations` (filtered + sorted). Client can cross-check: every `upcomingAssignedFormations[].id` should exist in `assignedFormations` if dates are present.

---

## 5. `GET /enrollments/teacher`

**Auth:** `ENSEIGNANT`.

**Query:** `FindEnrollmentsQueryDto` — extends pagination:

- `page` (default 1), `limit` (default 10, max 100)
- `formationId` (optional UUID): **filters to that formation** (must be one you teach; otherwise empty page)
- `search` (optional): case-insensitive match on **formation title**, **enrollment status**, **student first/last name**, **email**, **matricule**
- `sortBy` (optional): only `enrolledAt`, `status` honored; else default `enrolledAt`
- `sortOrder`: `asc` | `desc` (default `desc`)
- **`status` (optional):** `ENROLLED` | `CANCELLED` — filters enrollments

**Business logic:** Returns enrollments for formations where **`formation_teachers.teacherId = JWT sub`**. Join path includes **`users`** (student); one row per enrollment.

**Response:** `PaginatedResponse<TeacherEnrollmentListItem>`

```ts
type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type PaginatedResponse<T> = { data: T[]; meta: PaginationMeta };

type TeacherEnrollmentListItem = {
  id: string;
  status: 'ENROLLED' | 'CANCELLED';
  enrolledAt: string;
  formation: {
    id: string;
    title: string;
    startDate: string | null;
    endDate: string | null;
  };
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    matricule: string | null;
    /** Primary display identifier: email if present, else matricule, else empty */
    identifierKind: 'EMAIL' | 'MATRICULE' | 'NONE';
    identifier: string;
  };
};
```

**Breaking change (vs older clients):** Top-level **`studentId` / `formationId` removed**; use **`student.id`** and **`formation.id`**. List items are **nested** for readability.

---

## 5b. `GET /enrollments/teacher/:enrollmentId`

**Auth:** `ENSEIGNANT`.

**Business logic:** Returns **one** enrollment when:

- the enrollment exists, and  
- you are assigned to its formation (`formation_teachers`).

Otherwise **404** `Enrollment not found or inaccessible` (includes wrong id and “not your formation”).

**Response `200`:**

```ts
type TeacherEnrollmentDetailResponse = {
  enrollment: {
    id: string;
    studentId: string;
    formationId: string;
    status: 'ENROLLED' | 'CANCELLED';
    enrolledAt: string;
  };
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    matricule: string | null;
    identifierKind: 'EMAIL' | 'MATRICULE' | 'NONE';
    identifier: string;
    accountType: 'INTERNAL_STUDENT' | 'EXTERNAL_LEARNER';
    bacYear: number | null;
    dob: string | null; // ISO date if set
  };
  formation: {
    id: string;
    title: string;
    description: string | null;
    price: string | null;
    capacity: number | null;
    isSaleOpen: boolean;
    startDate: string | null;
    endDate: string | null;
    createdAt: string;
    language: { id: string | null; name: string | null; code: string | null };
    level: { id: string | null; code: string | null; name: string | null };
  };
  certificate: null | {
    id: string;
    enrollmentId: string;
    certificateNumber: string;
    verificationCode: string;
    issuedAt: string;
    pdfUrl: string | null;
  };
};
```

---

## 6. `GET /teachers/me/formations`

**Auth:** `ENSEIGNANT`. **Identity:** `user.id` = `teachers.id`.

**Query:** `FindTeacherFormationsQueryDto` = pagination + `search` (title `ilike`) + `languageId`, `levelId` + `sortBy` / `sortOrder`.

**`sortBy` honored:** `createdAt`, `title`, `startDate` (unknown → `createdAt`).

**Business logic:** Inner join `formation_teachers` → `formations` where `teacherId = JWT sub`. Returns **one row per assignment** with formation + nested `language` / `level` + assignment metadata.

**Response:** `PaginatedResponse<TeacherFormationListRow>`

```ts
type TeacherFormationListRow = {
  id: string; // formation id
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
  assignmentRole: 'MAIN_TEACHER' | 'ASSISTANT';
  assignedAt: string;
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

---

## 7. `GET /teachers/me/formations/:formationId`

**Auth:** `ENSEIGNANT` + **`TeacherFormationAccessGuard`**.

**Business logic:** Same select shape as list item but **single** formation; **404** `Formation not found for this teacher` if not assigned. **403** if guard fails.

**Response:** Same fields as **`TeacherFormationListRow`** (one object, not wrapped).

---

## 8. `GET /teachers/me/calendar`

**Auth:** `ENSEIGNANT`.

**Preview only:** no enrollment payloads. After a card click, load **`GET /teachers/me/formations/:formationId`** and **`GET /teachers/me/formations/:formationId/enrollments`**.

**Query (`FindTeacherCalendarQueryDto`):** optional **`from`**, **`to`** (ISO date/datetime; plain `YYYY-MM-DD` uses UTC day bounds), optional **`search`** (title / language / level). **No pagination** (`page`, `limit`, `sort*` removed from this DTO).

**Date filter:** If **neither** `from` nor `to` → all assignments (including formations with both dates null). If **either** is set → overlap rules with `COALESCE` / ±infinity; formations with **both** dates null are **excluded** when filtering.

**Search:** `ilike` on formation title, language name/code, level name/code.

**Order:** `startDate` **ASC NULLS LAST**, then `title` **ASC**.

**`enrolledCount`:** `ENROLLED` rows only (same as before).

**Response:**

```ts
type TeacherCalendarResponse = {
  data: Array<{
    id: string;          // formation_teachers.id (assignment id), not formation id
    formationId: string;
    title: string;
    startsAt: string | null;
    endsAt: string | null;
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
    status: 'OPEN' | 'CLOSED';
    enrolledCount: number;
    type: 'FORMATION';
    assignmentRole: 'MAIN_TEACHER' | 'ASSISTANT';
    assignedAt: string;
    capacity: number | null;
    spotsRemaining: number | null;
  }>;
};
```

**Client check:** use **`formationId`** for detail/enrollments routes; `data[].id` is the **assignment** id.

---

## 9. `GET /teachers/me/formations/:formationId/enrollments`

**Auth:** `ENSEIGNANT` + guard.

**Query:** `PaginationQueryDto` — **only `page` and `limit` are passed** into the repository. **`search`, `sortBy`, `sortOrder` are ignored**.

**Business logic:** Enrollments for **`enrollments.formationId = :formationId`** and teacher assigned to that formation. **No filter on `enrollments.status`** — includes **`ENROLLED` and `CANCELLED`**.

Order: **`enrolledAt` descending** (fixed).

**Response:** `PaginatedResponse<TeacherFormationEnrollmentRow>`

```ts
type TeacherFormationEnrollmentRow = {
  id: string;
  studentId: string;
  status: 'ENROLLED' | 'CANCELLED';
  enrolledAt: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    matricule: string | null;
  };
};
```

---

## 10. `GET /teachers/me/formations/:formationId/certificates`

**Auth:** `ENSEIGNANT` + guard.

**Query:** `PaginationQueryDto` — **only `page` and `limit` are used**; **`search` / `sort` ignored**.

**Business logic:** Certificates linked via **`enrollments`** on that formation, with teacher assigned (join path: `certificates` → `enrollments` → `formations` → `formation_teachers`). **Enrollment `status` is not filtered** (certificate can exist for an enrollment that is no longer `ENROLLED`).

Order: **`issuedAt` descending**.

**Response:** `PaginatedResponse<TeacherFormationCertificateRow>`

```ts
type TeacherFormationCertificateRow = {
  id: string;
  enrollmentId: string;
  certificateNumber: string;
  verificationCode: string;
  issuedAt: string;
  pdfUrl: string | null;
};
```

---

## 11. Stats reference

### 11.1 Teacher dashboard stats (`GET /dashboard/teacher` → `TeacherStats`)

Defined in `src/modules/dashboard/types/dashboard.types.ts`:

```ts
interface TeacherStats {
  assignedFormationsCount: number;       // rows in formation_teachers for this teacher
  openAssignedFormationsCount: number;   // assigned + formations.isSaleOpen === true
  closedAssignedFormationsCount: number; // assigned + formations.isSaleOpen === false
  totalStudentsEnrolled: number;           // see semantics below
}
```

**Semantics of `totalStudentsEnrolled`:** SQL **`count(*)`** of **enrollment rows** with **`status = ENROLLED`** on formations the teacher is assigned to. **Not** distinct `studentId` — the same learner in two assigned formations contributes **2**.

**Relation to admin teacher detail:** `GET /teachers/:teacherId` (ADMIN) returns `stats.enrolledStudentsCount` from the teachers repository with the **same counting logic** (enrollment rows, `ENROLLED` only). Names differ (`totalStudentsEnrolled` vs `enrolledStudentsCount`) but **definition matches**.

### 11.2 Calendar `enrolledCount` vs dashboard

- **Calendar** `enrolledCount`: **ENROLLED** only, per formation.
- **Dashboard** `totalStudentsEnrolled`: sum of ENROLLED **enrollment rows** across **all** assigned formations (double-counts cross-formation).

**Client consistency:** Summing `calendar.data[].enrolledCount` over distinct formations **should equal** the sum of per-formation ENROLLED counts; it will **not** necessarily equal `totalStudentsEnrolled` unless each student enrolls in at most one assigned formation.

### 11.3 Admin-only teacher aggregates (`GET /teachers/admin/stats`)

**Auth:** `ADMIN`. Useful if the client builds an **admin** teachers screen.

```ts
type AdminTeacherStatsDto = {
  totalTeachers: number;              // count(teachers)
  teachersWithAssignments: number;    // count(distinct teacher_id) on formation_teachers
  teachersWithoutAssignments: number; // max(0, totalTeachers - teachersWithAssignments)
  totalAssignments: number;           // count(rows) formation_teachers
  formationsWithTeacher: number;      // count(distinct formation_id) formation_teachers
};
```

---

## 12. Cross-endpoint compatibility checklist (for LLM validation)

| Check | Rule |
|-------|------|
| JWT `sub` | Always **`teachers.id`**. |
| Formation lists | `/dashboard/teacher` `assignedFormations` = raw formation rows; `/teachers/me/formations` adds `assignmentRole`, `assignedAt`, nested language/level. Same `formation.id` keys. |
| Upcoming filter | Only on dashboard `upcomingAssignedFormations` (`startDate >= now`). |
| Calendar vs list | Calendar: `from`/`to`/`search`, no pagination; assignment id as `id`; `formationId` for dialogs; optional `assignmentRole`, `assignedAt`, `capacity`, `spotsRemaining`. |
| Global enrollments (`/enrollments/teacher`) | Nested **`student`** + **`formation`** summaries; **`identifierKind` / `identifier`**; **`formationId`** query supported. Detail: **`GET /enrollments/teacher/:enrollmentId`**. |
| Per-formation enrollments (`/teachers/me/.../enrollments`) | Includes **cancelled**; no `search`/`sort` from query. |
| Guarded routes | Detail, enrollments, certificates need assignment; **403** if not assigned. |

---

## 13. Error codes (typical)

| Status | When |
|--------|------|
| `401` | Missing/invalid token, or login failure |
| `403` | Teacher role on wrong route, or `TeacherFormationAccessGuard` |
| `404` | Formation not found for teacher, or enrollment not found / not accessible (`/enrollments/teacher/:enrollmentId`) |

---

## 14. TypeScript enums / auth helpers

```ts
// JWT / guards
const UserRole = { ADMIN: 'ADMIN', ENSEIGNANT: 'ENSEIGNANT', APPRENANT: 'APPRENANT' } as const;

interface AuthUser {
  id: string;       // teachers.id when role is ENSEIGNANT
  role: typeof UserRole[keyof typeof UserRole];
}

// Login
enum LoginType {
  STUDENT = 'STUDENT',
  EMAIL = 'EMAIL',
  TEACHER = 'TEACHER',
}
```

---

*Generated from backend sources: `teachers-me.controller`, `teachers.service`, `teaders.repository`, `enrollments.controller` / `enrollments.repository`, `dashboard.controller` / `dashboard.service` / `dashboard.repository`. For admin-only teacher CRUD and assignments, see `docs/teachers-api.md`.*
