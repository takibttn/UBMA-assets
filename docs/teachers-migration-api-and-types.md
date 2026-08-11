# Teachers — migration, API reference, and types

Single reference for the **teachers entity split** (off `users`), **HTTP API**, and **types** used in the codebase.

---

## Part A — Migration (before vs after)

### Before

- Teachers were **`users`** rows with **`role = 'ENSEIGNANT'`**.
- **`formation_teachers.teacher_id`** referenced **`users.id`**.
- Login often used **`loginType: "EMAIL"`** (or student paths) against **`users`**; JWT **`sub`** was **`users.id`**.

### After

- Dedicated table **`teachers`**: `first_name`, `last_name`, `email` (unique), `password` (bcrypt), timestamps, `id` (uuid).
- **`users.role`** enum is only **`ADMIN` | `APPRENANT`** (`ENSEIGNANT` removed from `users`).
- **`formation_teachers.teacher_id`** references **`teachers.id`**.
- Teachers authenticate with **`POST /auth/login`**, **`loginType: "TEACHER"`**; JWT **`sub`** is **`teachers.id`**, **`role`** is still **`"ENSEIGNANT"`** (unchanged for guards).

### SQL migration

Apply in order (see `drizzle/meta/_journal.json`):

- `drizzle/0001_teachers_entity.sql` — creates `teachers`, copies ENSEIGNANT users into `teachers` (preserving `id`), fixes `formations.creator_id` when it pointed at teachers, repoints `formation_teachers` FK, deletes migrated users, shrinks `role` enum.

Synthetic email for legacy NULL emails: `teacher-{uuid-without-dashes}@migrated.ubma.invalid`.

### Behaviour preserved

- **Learner enrollment** still uses **`enrollments.student_id` → `users.id`**.
- **Teaching assignment** is still many-to-many via **`formation_teachers`**; only the FK target table changed to **`teachers`**.
- **Admin** assigns with **`POST /teachers/:teacherId/formations/:formationId`** (same URL shape; `teacherId` is a **teacher** id).

---

## Part B — API reference

Base path: **`/teachers`**. Unless noted, JSON bodies use `application/json`.

### Auth matrix

| Controller | JWT role | Purpose |
|------------|----------|---------|
| `TeachersController` | `ADMIN` | CRUD-style admin operations |
| `TeachersMeController` | `ENSEIGNANT` | Self-service under `/teachers/me/*` |

**Teacher login** (not under `/teachers`):

| Method | Path | Body |
|--------|------|------|
| `POST` | `/auth/login` | `LoginDto` with `loginType: "TEACHER"`, `email`, `password` |

### Admin — teachers

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/teachers` | Create teacher |
| `GET` | `/teachers` | Paginated list |
| `GET` | `/teachers/admin/stats` | Dashboard counts (must be registered **before** `:teacherId` in code) |
| `GET` | `/teachers/:teacherId` | Detail + stats |
| `GET` | `/teachers/:teacherId/formations` | Assigned formations (paginated) |
| `POST` | `/teachers/:teacherId/formations/:formationId` | Assign teacher to formation |
| `DELETE` | `/teachers/:teacherId/formations/:formationId` | Remove assignment |
| `GET` | `/teachers/:teacherId/calendar` | Calendar-shaped list of assigned formations |

**Create teacher — request body**

```json
{
  "firstName": "Nadia",
  "lastName": "Benali",
  "email": "nadia.benali@ubma.edu",
  "password": "secret12"
}
```

**Responses**

- Create: **`201`** — teacher object **without** `password`.
- Create duplicate email: **`409`**.
- List: **`200`** — `PaginatedResponse<TeacherListItem>` (see types below).
- Detail: **`200`** — `TeacherDetailResponse`; missing id: **`404`**.

### Enseignant — self routes

`TeachersMeController` must be registered **before** parameterized admin routes so `me` is not parsed as a UUID.

| Method | Path |
|--------|------|
| `GET` | `/teachers/me/formations` |
| `GET` | `/teachers/me/formations/:formationId` |
| `GET` | `/teachers/me/calendar` |
| `GET` | `/teachers/me/formations/:formationId/enrollments` |
| `GET` | `/teachers/me/formations/:formationId/certificates` |

Formation-scoped routes use **`TeacherFormationAccessGuard`** (teacher must be assigned to that formation).

### Query parameters (shared patterns)

**`FindTeachersQueryDto`** extends **`PaginationQueryDto`**:

- `page` (default `1`), `limit` (default `10`, max `100`)
- `search` (optional) — `ilike` on `firstName`, `lastName`, `email`
- `sortBy` (optional) — supported: `createdAt`, `firstName`, `lastName` (invalid values fall back to `createdAt`)
- `sortOrder` — `asc` | `desc` (default `desc`)

**`FindTeacherFormationsQueryDto`** extends **`FindFormationsQueryDto`** → same pagination/search/sort fields as formations list, plus **`languageId`**, **`levelId`** (optional UUIDs). Allowed `sortBy` values follow the formations repository (e.g. `createdAt`, `title`, `startDate`).

**`FindTeacherCalendarQueryDto`** — **no pagination.** Optional **`from`**, **`to`** (ISO date/datetime; inclusive window with null-safe overlap), optional **`search`** (formation title, language, level). See [`teacher-calendar-api.md`](teacher-calendar-api.md).

**`PaginationQueryDto` only** on teacher `me` enrollments/certificates: `page`, `limit`, `search`, `sortBy`, `sortOrder`.

### Common errors

| Status | Typical cause |
|--------|----------------|
| `400` | Invalid assignment (e.g. formation dates, overlap rules) |
| `401` | Missing or invalid JWT |
| `403` | Wrong role for route |
| `404` | Teacher or formation not found |
| `409` | Duplicate email on create, or duplicate teacher–formation assignment |

---

## Part C — Types (TypeScript)

### Drizzle schema (`src/db/schema.ts`)

**Table `teachers` (conceptual row shape — matches `Teacher`)**

| Column (DB) | Type / notes |
|-------------|----------------|
| `id` | `uuid` |
| `first_name` | `varchar(100)` |
| `last_name` | `varchar(100)` |
| `email` | `varchar(255)` not null, unique |
| `password` | `varchar(255)` not null (bcrypt hash) |
| `created_at` | `timestamp` |
| `updated_at` | `timestamp` |

**Exported inferred types**

```ts
import type { Teacher, NewTeacher } from '@db/schema';

// Teacher   = typeof teachers.$inferSelect
// NewTeacher = typeof teachers.$inferInsert
```

**Related**

```ts
import type { FormationTeacher, NewFormationTeacher } from '@db/schema';
// formation_teachers.teacherId → teachers.id
// role: 'MAIN_TEACHER' | 'ASSISTANT' (pg enum formation_teacher_role)
```

**Users enum (no teacher)**

```ts
// roleEnum on users: 'ADMIN' | 'APPRENANT' only
```

### JWT and auth user

```ts
// Payload signed for teachers after TEACHER login
type TeacherJwtPayload = {
  sub: string; // teachers.id
  role: 'ENSEIGNANT';
};

// UserRole (src/modules/auth/types/user-role.type.ts)
const UserRole = {
  ADMIN: 'ADMIN',
  ENSEIGNANT: 'ENSEIGNANT',
  APPRENANT: 'APPRENANT',
} as const;
type UserRole = (typeof UserRole)[keyof typeof UserRole];

// AuthUser (guards / @CurrentUser)
interface AuthUser {
  id: string;
  role: UserRole;
}
```

### Login DTO (`src/modules/auth/dto/login.dto.ts`)

```ts
enum LoginType {
  STUDENT = 'STUDENT',
  EMAIL = 'EMAIL',
  TEACHER = 'TEACHER',
}

class LoginDto {
  loginType!: LoginType;
  bacYear?: number;       // STUDENT only
  matricule?: string;     // STUDENT only
  email?: string;         // EMAIL | TEACHER
  password!: string;      // min length 6
}
```

**Teacher login success shape** (`AuthService`):

```ts
type TeacherLoginResponse = {
  accessToken: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    role: 'ENSEIGNANT';
    accountType: string | null; // null for teachers
    email: string;
  };
};
```

### Teacher DTO classes (`src/modules/teachers/dto/`)

```ts
// create-teacher.dto.ts
class CreateTeacherDto {
  firstName!: string;   // max 100
  lastName!: string;    // max 100
  email!: string;       // email
  password!: string;    // min 6
}

// admin-teacher-stats.dto.ts (response)
class AdminTeacherStatsDto {
  totalTeachers!: number;
  teachersWithAssignments!: number;
  teachersWithoutAssignments!: number;
  totalAssignments!: number;
  formationsWithTeacher!: number;
}

// find-teachers-query.dto.ts
class FindTeachersQueryDto extends PaginationQueryDto {}

// find-teacher-formations-query.dto.ts
class FindTeacherFormationsQueryDto extends FindFormationsQueryDto {}

// find-teacher-calendar-query.dto.ts — preview-only filters (from, to, search); no page/limit/sort
class FindTeacherCalendarQueryDto {
  from?: string;
  to?: string;
  search?: string;
}
```

### Pagination (`src/common/pagination/`)

```ts
type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type PaginatedResponse<T> = {
  data: T[];
  meta: PaginationMeta;
};
```

### API response shapes (conceptual)

Exact JSON may serialize dates as ISO strings.

```ts
type TeacherListItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string; // ISO date-time from API
};

type TeacherDetailResponse = TeacherListItem & {
  stats: {
    assignedFormationsCount: number;
    enrolledStudentsCount: number;
  };
};

type TeacherCalendarResponse = {
  data: Array<{
    id: string;
    formationId: string;
    title: string;
    startsAt: string | null;
    endsAt: string | null;
    language: { id: string | null; name: string | null; code: string | null };
    level: { id: string | null; code: string | null; name: string | null };
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

---

## Related docs

- Narrative migration story: [`teachers-entity-migration.md`](teachers-entity-migration.md)
- Endpoint-focused teacher API: [`teachers-api.md`](teachers-api.md)
- Teacher calendar (preview): [`teacher-calendar-api.md`](teacher-calendar-api.md)

*UBMA CEIL — teachers migration, API, and types reference.*
