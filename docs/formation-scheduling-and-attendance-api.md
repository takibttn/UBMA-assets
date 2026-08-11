# UBMA CEIL — scheduling, attendance & full API reference

Single document for **current** HTTP APIs, **DTOs**, **business logic**, and the **target** model (**rooms**, **séances / formation_sessions**, **attendance**) per the platform migration plan.  

**Base URL:** `/api/v1`. **Swagger:** `/docs`.

**Legend**

| Tag | Meaning |
|-----|---------|
| **[Current]** | Implemented in codebase today |
| **[Planned]** | Spec only — not implemented until corresponding phase |

**Session bulk generation [Current]:** `POST /formations/:formationId/sessions/preview` and `.../generate` (ADMIN) — see **`docs/formation-session-generation-api.md`**. Manual session CRUD remains available. Formation must have **`startDate` and `endDate`** for generation.

---

## Table of contents

1. [Domain model: current vs target](#1-domain-model-current-vs-target)  
2. [Database](#2-database)  
3. [Enums](#3-enums)  
4. [Authentication & roles](#4-authentication--roles)  
5. [HTTP APIs — complete inventory](#5-http-apis--complete-inventory)  
6. [DTOs & response contracts](#6-dtos--response-contracts)  
7. [Business logic](#7-business-logic)  
8. [Scheduling conflicts (planned)](#8-scheduling-conflicts-planned)  
9. [Teacher calendar migration](#9-teacher-calendar-migration)  
10. [Attendance (planned)](#10-attendance-planned)  
11. [Enrollment enrichment (planned)](#11-enrollment-enrichment-planned)  
12. [Backward compatibility & rollout](#12-backward-compatibility--rollout)  
13. [Recommended implementation order](#13-recommended-implementation-order)  
14. [Related documentation](#14-related-documentation)  

---

## 1. Domain model: current vs target

### 1.1 Current (simplified) **[Current]**

```text
Formation (single startDate/endDate interval)
  ├─ formation_teachers → Teachers
  ├─ enrollments → users (APPRENANT)
  └─ certificates (1:1 enrollment)
```

- Learner **enrolls in a formation**.  
- Teacher **calendar** lists **formation-level** intervals (via assignments).  
- **No** rooms, **no** sessions table, **no** attendance.

### 1.2 Target (after migration) **[Planned]**

```text
Formation (course/program — keep startDate/endDate for catalogue, progress, analytics)
  ├─ formation_teachers → Teachers (unchanged)
  ├─ enrollments → users (unchanged — no session_enrollments)
  ├─ formation_sessions (séances) → each links one room, one time interval
  ├─ session_attendance (per enrollment per session)
  └─ certificates (still per enrollment)
```

**Rules (authoritative)**

- **Do not** assign rooms to formations; **rooms attach to sessions**.  
- **Do not** move enrollment to sessions; **enrollment stays on formation**.  
- **Do not** assign teachers to sessions in v1; teachers reach sessions via **formation_teachers** → **formation_sessions.formationId**.  
- **Teacher calendar** becomes **session-based** (not formation date ranges).  
- **Modules / curriculum** — explicitly **out of scope** for this plan.

---

## 2. Database

### 2.1 Existing tables **[Current]** (`src/db/schema.ts`)

| Table | Purpose |
|-------|---------|
| `users` | ADMIN / APPRENANT; `account_type` INTERNAL_STUDENT \| EXTERNAL_LEARNER |
| `teachers` | Separate teacher accounts |
| `languages` | Reference |
| `formation_levels` | Per-language levels |
| `formations` | Course; `start_date`, `end_date` nullable timestamps |
| `enrollments` | `(student_id, formation_id)` unique; `status` ENROLLED \| CANCELLED |
| `formation_teachers` | Assignment; `role` MAIN_TEACHER \| ASSISTANT; `assigned_by_id` |
| `certificates` | `enrollment_id` unique |

### 2.2 Planned tables **[Planned]**

#### `rooms`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | |
| `code` | varchar(50) | **unique**, not null |
| `name` | varchar(100) | not null |
| `capacity` | integer | not null, **≥ 1** |
| `is_active` | boolean | default true |
| `created_at`, `updated_at` | timestamp | |

**Rules:** prefer **soft deactivate** (`is_active = false`). **Delete** rejected if **future non-CANCELLED** sessions reference the room.

#### `formation_sessions`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | |
| `formation_id` | uuid FK → formations | **ON DELETE CASCADE** |
| `room_id` | uuid FK → rooms | **ON DELETE RESTRICT** |
| `title` | varchar(255) | not null (default pattern: `"{formation.title} - Séance"` if omitted in API) |
| `description` | text | nullable |
| `start_at`, `end_at` | timestamp | not null; **start_at < end_at** |
| `status` | `session_status` | SCHEDULED \| CANCELLED \| COMPLETED |
| `created_by_id` | uuid FK users | nullable |
| `created_at`, `updated_at` | timestamp | |

**Rules:** **CANCELLED** sessions **excluded** from scheduling conflict checks. Optional: session must fall inside formation `startDate`/`endDate` when both exist; max duration (e.g. ≤ 6 hours) per product.

#### `session_attendance`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | |
| `session_id` | uuid FK → formation_sessions | **ON DELETE CASCADE** |
| `enrollment_id` | uuid FK → enrollments | **ON DELETE CASCADE** |
| `status` | `attendance_status` | PRESENT \| ABSENT \| LATE \| EXCUSED |
| `marked_at` | timestamp | nullable |
| `marked_by_teacher_id` | uuid FK teachers | nullable |
| `created_at`, `updated_at` | timestamp | |

**Unique:** `(session_id, enrollment_id)`.

**Critical:** `session.formation_id` **must equal** `enrollment.formation_id` on every write.

---

## 3. Enums

### 3.1 Existing **[Current]**

| Enum | Values |
|------|--------|
| `role` (users) | ADMIN, APPRENANT |
| `account_type` | INTERNAL_STUDENT, EXTERNAL_LEARNER |
| `enrollment_status` | ENROLLED, CANCELLED |
| `formation_teacher_role` | MAIN_TEACHER, ASSISTANT |

### 3.2 JWT `UserRole` **[Current]** (application)

ADMIN, APPRENANT, ENSEIGNANT (teachers use `teachers` table; JWT `sub` = teacher id when ENSEIGNANT).

### 3.3 Planned **[Planned]**

| Enum | Values |
|------|--------|
| `session_status` | SCHEDULED, CANCELLED, COMPLETED |
| `attendance_status` | PRESENT, ABSENT, LATE, EXCUSED |

**Note:** LATE is **not** counted as PRESENT unless business rules change later.

---

## 4. Authentication & roles

| Endpoint family | Typical auth |
|-----------------|--------------|
| `/auth/*` | Public |
| `/public/*` | Public |
| Most read/write catalog | `Bearer` JWT |
| ADMIN-only | `@Auth(ADMIN)` — note: teacher routes use ENSEIGNANT on separate controller |

See `src/modules/auth/*`, `@lib/decorators/auth.decorator`.

---

## 5. HTTP APIs — complete inventory

All paths are **relative to `/api/v1`**.

### 5.1 App **[Current]**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | No | Hello / health |

### 5.2 Auth **[Current]**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | External learner + JWT |
| POST | `/auth/login` | No | STUDENT / EMAIL / TEACHER |

### 5.3 Users **[Current]**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/users` | DevOnlyGuard | Create user (dev) |

### 5.4 Languages **[Current]**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/languages` | Any | List |
| GET | `/languages/:id` | Any | By id |
| POST | `/languages` | ADMIN | Create |
| PATCH | `/languages/:id` | ADMIN | Update |
| DELETE | `/languages/:id` | ADMIN | Delete |

### 5.5 Levels **[Current]**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/levels` | Any | List (optional `languageId`) |
| GET | `/languages/:languageId/levels` | Any | Levels for language |
| POST | `/levels` | ADMIN | Create |
| PATCH | `/levels/:id` | ADMIN | Update |
| DELETE | `/levels/:id` | ADMIN | Delete |

### 5.6 Formations **[Current]**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/formations` | ADMIN | Create formation |
| GET | `/formations` | Any | Paginated list + enrolledCount |
| GET | `/formations/admin/stats` | ADMIN | Stats cards |
| GET | `/formations/admin/analytics` | ADMIN | Chart data |
| GET | `/formations/:id` | Any | Detail |
| PATCH | `/formations/:id` | ADMIN | Update (validates teacher schedules if dates change) |
| PATCH | `/formations/:id/sale` | ADMIN | Toggle `isSaleOpen` |
| DELETE | `/formations/:id` | ADMIN | Delete |

### 5.7 Formations — sessions **[Planned]**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/formations/:formationId/sessions` | ADMIN | Create session |
| GET | `/formations/:formationId/sessions` | ADMIN (optional ENSEIGNANT read later) | List sessions |
| GET | `/formations/:formationId/sessions/:sessionId` | ADMIN | Detail |
| PATCH | `/formations/:formationId/sessions/:sessionId` | ADMIN | Update |
| DELETE | `/formations/:formationId/sessions/:sessionId` | ADMIN | Delete if policy allows |

### 5.8 Formations — bulk create **[Planned]**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/formations/with-sessions` | ADMIN | Transaction: formation + teacher assignments + sessions |

### 5.9 Rooms **[Planned]**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/rooms` | ADMIN | Create room |
| GET | `/rooms` | ADMIN | Paginated list + filters |
| GET | `/rooms/:id` | ADMIN | Detail |
| PATCH | `/rooms/:id` | ADMIN | Update / deactivate |
| DELETE | `/rooms/:id` | ADMIN | Reject if blocking future sessions; prefer PATCH |

### 5.10 Enrollments **[Current]**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/enrollments` | APPRENANT | Self-enroll |
| GET | `/enrollments/me/profile` | APPRENANT | Card-shaped + progressState **[+ attendanceSummary Planned]** |
| GET | `/enrollments/me` | APPRENANT | Legacy raw list (deprecated) |
| GET | `/enrollments` | ADMIN | List |
| GET | `/enrollments/formation/:formationId` | ADMIN | By formation |
| GET | `/enrollments/teacher` | ENSEIGNANT | List (taught formations) **[+ summary Planned]** |
| GET | `/enrollments/teacher/:enrollmentId` | ENSEIGNANT | Detail |
| GET | `/enrollments/formation/:formationId` | ADMIN | Per-formation enrollments |

### 5.11 Certificates **[Current]**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/certificates/:enrollmentId/generate` | ADMIN | Generate |
| GET | `/certificates/me` | APPRENANT | My certificates |
| GET | `/public/certificates/:verificationCode` | Public | Verify |

### 5.12 Teachers (admin) **[Current]**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/teachers` | ADMIN | Create teacher |
| GET | `/teachers` | ADMIN | List |
| GET | `/teachers/admin/stats` | ADMIN | Stats |
| GET | `/teachers/:teacherId` | ADMIN | Detail |
| GET | `/teachers/:teacherId/formations` | ADMIN | Formations |
| POST | `/teachers/:teacherId/formations/:formationId` | ADMIN | Assign |
| DELETE | `/teachers/:teacherId/formations/:formationId` | ADMIN | Unassign |
| GET | `/teachers/:teacherId/calendar` | ADMIN | Calendar **[session-based Planned]** |

### 5.13 Teachers (me) **[Current] / [Planned]**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/teachers/me/formations` | ENSEIGNANT | My formations **[+ nextSession Planned]** |
| GET | `/teachers/me/formations/:formationId` | ENSEIGNANT | Detail |
| GET | `/teachers/me/calendar` | ENSEIGNANT | Calendar **[formation → session events Planned]** |
| GET | `/teachers/me/formations/:formationId/enrollments` | ENSEIGNANT | Roster **[+ attendanceSummary Planned]** |
| GET | `/teachers/me/formations/:formationId/certificates` | ENSEIGNANT | Certificates |

### 5.14 Teachers — formation sessions (read) **[Planned]**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/teachers/me/formations/:formationId/sessions` | ENSEIGNANT | Sessions if assigned to formation |

### 5.15 Attendance **[Planned]**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/teachers/me/sessions/:sessionId/attendance` | ENSEIGNANT | Sheet (roster + status) |
| PATCH | `/teachers/me/sessions/:sessionId/attendance` | ENSEIGNANT | Bulk upsert marks |

### 5.16 Dashboard **[Current]**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/dashboard/admin` | ADMIN | Legacy (deprecated) |
| GET | `/dashboard/admin/stats` | ADMIN | Stats |
| GET | `/dashboard/admin/formation-tracking/by-capacity` | ADMIN | |
| GET | `/dashboard/admin/formation-tracking/by-deadline` | ADMIN | |
| GET | `/dashboard/admin/alerts` | ADMIN | |
| GET | `/dashboard/admin/top-formations` | ADMIN | |
| GET | `/dashboard/admin/top-teachers` | ADMIN | |
| GET | `/dashboard/teacher` | ENSEIGNANT | Teacher dashboard |
| GET | `/dashboard/student/overview` | APPRENANT | Learner overview |
| GET | `/dashboard/student` | APPRENANT | Legacy (deprecated) |

### 5.17 Calendar stub **[Current]**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| — | `/calendar` | — | Controller shell; no routes |

### 5.18 Notifications **[Current]**

No public HTTP routes; internal email on enrollment.

---

## 6. DTOs & response contracts

### 6.1 Auth **[Current]**

- `LoginDto` — `loginType` STUDENT \| EMAIL \| TEACHER; conditional `bacYear`, `matricule`, `email`; `password`  
- `RegisterDto` — `firstName`, `lastName`, `email`, `password`, `dob`

### 6.2 Formations **[Current]**

- `CreateFormationDto`, `UpdateFormationDto`, `FindFormationsQueryDto`, `ToggleSaleDto`  
- Admin: `AdminFormationStatsDto`, `AdminFormationAnalyticsDto`

### 6.3 Enrollments **[Current]**

- `CreateEnrollmentDto` — `{ formationId }`  
- `FindEnrollmentsQueryDto` — pagination, `status`, `formationId`, `search`, sort  
- `FindLearnerProfileEnrollmentsQueryDto` — `bucket` IN_PROGRESS \| COMPLETED \| ALL; sort by enrolledAt \| formationStartDate \| formationEndDate  
- `LearnerProfileOverviewResponseDto` — `summary`, `nextFormation` (card)  
- `LearnerEnrollmentCardItemDto` — enrollment + `progressState` + `profileBucket` + nested formation

### 6.4 Rooms **[Planned]**

```ts
type CreateRoomDto = {
  code: string;
  name: string;
  capacity: number; // >= 1
};

type UpdateRoomDto = Partial<CreateRoomDto> & {
  isActive?: boolean;
};

type FindRoomsQueryDto = {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
};
```

### 6.5 Formation sessions **[Planned]**

```ts
type CreateFormationSessionDto = {
  title?: string;
  description?: string;
  roomId: string;
  startAt: string; // ISO
  endAt: string;
};

type UpdateFormationSessionDto = {
  title?: string;
  description?: string;
  roomId?: string;
  startAt?: string;
  endAt?: string;
  status?: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
};

type FormationSessionResponseDto = {
  id: string;
  formationId: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  status: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
  room: {
    id: string;
    code: string;
    name: string;
    capacity: number;
  };
  formation: {
    id: string;
    title: string;
    language: { id: string | null; name: string | null; code: string | null };
    level: { id: string | null; code: string | null; name: string | null };
  };
  enrolledCount: number;
  attendanceSummary?: {
    presentCount: number;
    absentCount: number;
    lateCount: number;
    excusedCount: number;
  };
};
```

### 6.6 Create formation with sessions **[Planned]**

```ts
type CreateFormationWithSessionsDto = {
  formation: {
    title: string;
    description?: string;
    languageId: string;
    levelId: string;
    price?: number;
    capacity?: number;
    startDate: string;
    endDate: string;
    isSaleOpen?: boolean;
  };
  teacherIds: string[];
  sessions: Array<{
    title?: string;
    description?: string;
    roomId: string;
    startAt: string;
    endAt: string;
  }>;
};
```

### 6.7 Schedule conflict service types **[Planned]**

```ts
type CheckSessionConflictsInput = {
  formationId: string;
  roomId: string;
  startAt: Date;
  endAt: Date;
  excludeSessionId?: string;
};

type ScheduleConflictResult = {
  hasConflict: boolean;
  roomConflicts: Array<{
    roomId: string;
    roomCode: string;
    sessionId: string;
    sessionTitle: string;
    startAt: string;
    endAt: string;
  }>;
  teacherConflicts: Array<{
    teacherId: string;
    teacherName: string;
    sessionId: string;
    sessionTitle: string;
    startAt: string;
    endAt: string;
  }>;
  formationConflicts: Array<{
    formationId: string;
    sessionId: string;
    sessionTitle: string;
    startAt: string;
    endAt: string;
  }>;
};
```

On failure: `409 Conflict` with structured payload (or `ConflictException` body as agreed).

### 6.8 Teacher calendar — target event **[Planned]**

```ts
type TeacherCalendarEvent = {
  id: string; // session id
  sessionId: string;
  formationId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  room: { id: string; code: string; name: string };
  language: { id: string | null; name: string | null; code: string | null };
  level: { id: string | null; code: string | null; name: string | null };
  status: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
  enrolledCount: number;
  capacity: number | null;
  spotsRemaining: number | null;
  type: 'SESSION';
};
```

Query stays `FindTeacherCalendarQueryDto` (`from`, `to`, `search`) — **search** extended to session title + room code/name.

### 6.9 Teacher formations — `nextSession` **[Planned]**

```ts
nextSession: {
  id: string;
  startAt: string;
  endAt: string;
  roomCode: string;
} | null;
```

### 6.10 Attendance **[Planned]**

```ts
type SessionAttendanceRow = {
  enrollmentId: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    matricule: string | null;
    email: string | null;
  };
  attendance: {
    id: string | null;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | null;
    markedAt: string | null;
  };
};

type UpdateSessionAttendanceDto = {
  records: Array<{
    enrollmentId: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  }>;
};
```

### 6.11 Enrollment attendance summary **[Planned]**

```ts
type EnrollmentAttendanceSummary = {
  presentCount: number;
  totalSessionsCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  attendanceRate: number; // 0–100; presentCount / totalSessionsCount if total > 0 else 0
};
```

**Counting rules**

- `totalSessionsCount`: sessions for `enrollment.formationId` with `status != CANCELLED`  
- Per-status counts: rows in `session_attendance` for that `enrollment_id`  
- **Unmarked** sessions do not increment present/absent until product defines default

Attach to (priority): `GET /enrollments/me/profile`, `GET /teachers/me/formations/:formationId/enrollments`, `GET /enrollments/teacher`, then admin list — use batched aggregates (no N+1).

---

## 7. Business logic

### 7.1 Formations **[Current]**

- Catalog interval: `startDate` / `endDate` are **timestamps** (single range per formation).  
- **Self-enroll:** `isSaleOpen`, capacity vs count of ENROLLED, duplicate check.  
- **PATCH dates:** if both bounds exist after merge → `validateFormationScheduleForAssignedTeachers`:  
  - no **other** assigned formation for same teacher with **missing** start/end  
  - no **strict interval overlap** with other assigned formations (`other.start < newEnd && other.end > newStart`; back-to-back OK).  
- **Admin analytics:** formation status buckets (ENDED / UPCOMING / CLOSED / OPEN) — see `formations-api.md`.

### 7.2 Enrollments **[Current]**

- Unique `(studentId, formationId)`.  
- Status: ENROLLED | CANCELLED; learner profile uses ENROLLED-only for default tabs.  
- **Learner progress:** `UPCOMING` / `ACTIVE` / `COMPLETED` from formation dates — see `learner-enrollment-progress.ts`.

### 7.3 Teachers & assignments **[Current]**

- Assignment requires formation **both** `startDate` and `endDate` set.  
- Unassign: existing DELETE route.  
- Teacher JWT `sub` = `teachers.id`.

### 7.4 Certificates **[Current]**

- One certificate per enrollment; admin generate; public verify by code.

### 7.5 Rooms **[Planned]**

- `capacity >= 1`; `code` unique.  
- **Inactive** rooms cannot be used **for new** sessions.  
- **Delete** blocked if **future** non-CANCELLED sessions exist; prefer `PATCH isActive=false`.

### 7.6 Sessions **[Planned]**

- Belong to one formation and one room.  
- `startAt < endAt`; optional max duration (e.g. 6h).  
- Optional: must lie within formation `startDate`/`endDate` when both defined.  
- **Room capacity vs formation capacity:** if `formation.capacity` is not null → `room.capacity >= formation.capacity` else **400**.  
- Default title if omitted: `"{formation.title} - Séance"`.  
- **CANCELLED** sessions excluded from conflict detection.

### 7.7 Attendance **[Planned]**

- Upsert on `(session_id, enrollment_id)`.  
- Validate `enrollment.formation_id === session.formation_id`.  
- Teacher only if assigned to session’s formation (via `formation_teachers`).  
- Set `marked_by_teacher_id`, `marked_at` on mark.

---

## 8. Scheduling conflicts **[Planned]**

**Overlap** (open interval; back-to-back allowed):

```text
existing.startAt < newEndAt && existing.endAt > newStartAt
```

### 8.1 Room conflict

Same `roomId`, both sessions **not CANCELLED**, intervals overlap.

### 8.2 Teacher conflict

For each teacher assigned to the formation being scheduled: any **non-CANCELLED** session on **any** formation assigned to that teacher overlaps the new interval.

**Query shape:**

```text
formation_sessions
JOIN formation_teachers ON formation_teachers.formation_id = formation_sessions.formation_id
WHERE formation_teachers.teacher_id IN :assignedTeacherIds
```

### 8.3 Same formation conflict

Same `formationId`, **not CANCELLED**, intervals overlap (v1: no parallel sessions in one formation).

### 8.4 Central service

`ScheduleConflictService` (or `src/lib/services/schedule-conflict.service.ts`) used by:

- session create/update  
- `POST /formations/with-sessions`  
- future drag/drop edits  

---

## 9. Teacher calendar migration

### 9.1 Current **[Current]**

- Events from `formation_teachers` + `formations`; `id` = assignment id; `type: 'FORMATION'`; `status` OPEN/CLOSED from `isSaleOpen`.  
- See `docs/teacher-calendar-api.md`.

### 9.2 Target **[Planned]**

- Events from **sessions** on formations the teacher is assigned to.  
- `id` / `sessionId` = `formation_sessions.id`; `type: 'SESSION'`; `status` = session status.  
- Include **room**; overlap filter uses **session** `start_at`/`end_at` (same semantics as formation overlap with −∞/+∞ if nulls are disallowed on sessions).  
- **Breaking** for clients; mitigations: coordinate frontend release or temporary `GET /teachers/me/calendar/sessions` while deprecating old shape.

---

## 10. Attendance **[Planned]**

- Teacher GET/PATCH under `/teachers/me/sessions/:sessionId/attendance`.  
- PATCH accepts bulk `records`; server validates enrollment belongs to formation.

---

## 11. Enrollment enrichment **[Planned]**

- Add `attendanceSummary` (or nested object) to learner profile cards and teacher roster responses.  
- Implement with **one query per list** (group by enrollment) or lateral join — avoid N+1.

---

## 12. Backward compatibility & rollout

**Keep unchanged**

- `POST /formations`, `GET /formations`, enrollments **routes**, enrollment **creation**, certificates, `formation_teachers` model.

**Breaking / coordinate**

- `GET /teachers/me/calendar` response shape (Option A: switch + doc; Option B: new path then deprecate).

**Additive**

- All rooms/sessions/attendance endpoints; `POST /formations/with-sessions`; summary fields on enrollments.

---

## 13. Recommended implementation order

1. Rooms table + admin CRUD  
2. `formation_sessions` + admin CRUD under formations  
3. `ScheduleConflictService` + wire to session writes  
4. `POST /formations/with-sessions`  
5. Teacher calendar → sessions  
6. `nextSession` on `GET /teachers/me/formations` (+ optional `GET .../sessions`)  
7. `session_attendance` + teacher attendance GET/PATCH  
8. Enrollment APIs — `attendanceSummary` aggregates  
9. Frontend + seeds (`seed.rooms`, `seed.formation-sessions`, optional attendance seed)  
10. Docs: `rooms-api.md`, `formation-sessions-api.md`, `attendance-api.md`; update `teacher-calendar-api.md`, `enrollments-api.md`, `learner-profile-api.md`

---

## 14. Related documentation

| Document | Focus |
|----------|--------|
| [platform-master-reference.md](platform-master-reference.md) | Full current DB + API inventory |
| [business-use-cases-and-seed.md](business-use-cases-and-seed.md) | Domain + seed |
| [teacher-calendar-api.md](teacher-calendar-api.md) | Calendar (**current** formation-based; update after Phase 5) |
| [learner-profile-api.md](learner-profile-api.md) | Learner overview + profile enrollments |
| [enrollments-api.md](enrollments-api.md) | Enrollments module |
| [formations-api.md](formations-api.md) | Formations |
| [teachers-api.md](teachers-api.md) | Teachers admin + me |
| [certificates-api.md](certificates-api.md) | Certificates |

---

*UBMA CEIL — unified scheduling & attendance specification (current + planned). Maintainer: keep **[Current]** vs **[Planned]** in sync with shipped code.*
