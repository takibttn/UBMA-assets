# UBMA CEIL API — platform master reference

Single document for **database**, **HTTP APIs**, **types**, **data logic**, **E2E-style flows**, **use cases**, and **migration planning** (e.g. rooms, séances, modules). Source of truth: repository as of generation date; verify against `src/` when implementing.

**Base URL:** `http(s)://host:port/api/v1` (see `main.ts` → `setGlobalPrefix('/api/v1')`).  
**Swagger:** `/docs`.

---

## Table of contents

1. [Architecture snapshot](#1-architecture-snapshot)  
2. [Database (Drizzle / PostgreSQL)](#2-database-drizzle--postgresql)  
3. [Enums and Drizzle-inferred types](#3-enums-and-drizzle-inferred-types)  
4. [Auth, JWT, and security model](#4-auth-jwt-and-security-model)  
5. [HTTP API catalog](#5-http-api-catalog)  
6. [Pagination and shared contracts](#6-pagination-and-shared-contracts)  
7. [Domain logic (by bounded area)](#7-domain-logic-by-bounded-area)  
8. [E2E flows](#8-e2e-flows)  
9. [Use case matrix](#9-use-case-matrix)  
10. [Code map (where things live)](#10-code-map-where-things-live)  
11. [Migration planning: rooms, séances, modules](#11-migration-planning-rooms-séances-modules)  
12. [Existing deep-dive docs](#12-existing-deep-dive-docs)  

---

## 1. Architecture snapshot

| Layer | Technology |
|-------|------------|
| Framework | NestJS |
| ORM | Drizzle + `pg` |
| Validation | `class-validator` / `ValidationPipe` (whitelist, forbidNonWhitelisted) |
| Auth | JWT (`@nestjs/jwt`), `Bearer` header |
| API docs | Swagger (`/docs`) |

**Modules (feature)** roughly map to: `auth`, `users` (dev), `formations`, `enrollments`, `certificates`, `dashboard`, `teachers` (+ `teachers-me`), `languages`, `levels`, `notifications` (service-only for emails), `calendar` (stub controller).

**Repositories:** most SQL in `src/lib/repositories/*`; teachers also use `src/modules/teachers/teachers.repository.ts`.

---

## 2. Database (Drizzle / PostgreSQL)

All tables below are defined in `src/db/schema.ts`.

### 2.1 ER diagram (conceptual)

```text
users (ADMIN | APPRENANT)           teachers
   |                                    |
   |         formations ────────────────┼── formation_teachers
   |              |                      |         (role, assignedById)
   |              +-- languages / formation_levels
   |
   enrollments (studentId → users, formationId → formations)
        |
   certificates (1:1 enrollment)
```

### 2.2 Tables

#### `users`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | |
| `first_name`, `last_name` | varchar(100) | |
| `email` | varchar(255) nullable | unique when set; external learners |
| `bac_year`, `matricule` | int / varchar nullable | internal students; unique `(bac_year, matricule)` |
| `password` | varchar(255) | bcrypt |
| `dob` | date | nullable |
| `role` | `role` enum | `ADMIN` \| `APPRENANT` (DB) |
| `account_type` | enum | `INTERNAL_STUDENT` \| `EXTERNAL_LEARNER` |
| `created_at`, `updated_at` | timestamp | |

**Note:** JWT for teachers does **not** use this table — see `teachers`.

#### `teachers`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | JWT `sub` when `role === ENSEIGNANT` |
| `first_name`, `last_name` | varchar(100) | |
| `email` | varchar(255) | unique |
| `password` | varchar(255) | |
| `created_at`, `updated_at` | timestamp | |

#### `languages`

Reference: `name`, `code` (unique), `is_active`.

#### `formation_levels`

Per-language levels: `language_id` FK, `code`, `name`, `description`, `order`, `is_active`. Unique `(language_id, code)`.

#### `formations`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | |
| `title` | varchar(255) | |
| `description` | text | nullable |
| `language_id`, `level_id` | uuid FK | nullable |
| `creator_id` | uuid → users | nullable |
| `price` | numeric(10,2) | default 0 |
| `capacity` | int | nullable = unlimited in business logic |
| `is_sale_open` | boolean | gates learner self-enrollment |
| `start_date`, `end_date` | timestamp | nullable; **single interval per formation** |
| `created_at` | timestamp | |

**There is no** `rooms`, **no** `sessions` / séances table, **no** `modules` / curriculum table in the current schema.

#### `enrollments`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | |
| `student_id` | uuid → users | learner always `users.id` |
| `formation_id` | uuid → formations | |
| `status` | enum | `ENROLLED` \| `CANCELLED` |
| `enrolled_at` | timestamp | |

Unique `(student_id, formation_id)`.

#### `formation_teachers`

| Column | Type | Notes |
|--------|------|--------|
| `formation_id`, `teacher_id` | uuid | unique pair |
| `role` | enum | `MAIN_TEACHER` \| `ASSISTANT` |
| `assigned_at` | timestamp | |
| `assigned_by_id` | uuid → users | admin who assigned |
| `created_at`, `updated_at` | timestamp | |

#### `certificates`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | |
| `enrollment_id` | uuid | **unique** → enrollments; cascade delete |
| `certificate_number`, `verification_code` | varchar | unique |
| `issued_at` | timestamp | |
| `pdf_url` | varchar(500) | nullable |

### 2.3 Cascades (high level)

- Delete **user** → enrollments removed → certificates removed.  
- Delete **formation** → enrollments + `formation_teachers` removed.  
- Unique and FK details: see `schema.ts`.

---

## 3. Enums and Drizzle-inferred types

### 3.1 PostgreSQL enums (Drizzle `pgEnum`)

| Enum | Values |
|------|--------|
| `role` | `ADMIN`, `APPRENANT` |
| `account_type` | `INTERNAL_STUDENT`, `EXTERNAL_LEARNER` |
| `enrollment_status` | `ENROLLED`, `CANCELLED` |
| `formation_teacher_role` | `MAIN_TEACHER`, `ASSISTANT` |

### 3.2 Inferred TS types (export from schema)

`User`, `NewUser`, `Teacher`, `Formation`, `Enrollment`, `FormationTeacher`, `Certificate`, `Language`, `FormationLevel`, plus `New*` insert types.

### 3.3 Application `UserRole` (JWT — not identical to DB enum)

Defined in `src/modules/auth/types/user-role.type.ts`:

| Value | Used when |
|-------|-----------|
| `ADMIN` | `users.role === ADMIN` |
| `APPRENANT` | `users.role === APPRENANT` (internal + external learners) |
| `ENSEIGNANT` | **Teacher** login; `sub` is `teachers.id` |

So: **three** API roles, **two** DB roles on `users`; teachers are a **separate** entity.

---

## 4. Auth, JWT, and security model

### 4.1 Login / register

| Endpoint | Purpose |
|----------|---------|
| `POST /auth/register` | External learner: creates `APPRENANT` + `EXTERNAL_LEARNER`, returns JWT |
| `POST /auth/login` | `loginType`: `STUDENT` (bacYear + matricule), `EMAIL` (email), `TEACHER` (email) |

JWT payload: `{ sub: string; role: UserRole }` (`jwt-payload.type.ts`).  
`AuthUser`: `{ id: string; role: UserRole }` — `id` is user id **or** teacher id depending on role.

### 4.2 Guards

- `@Auth()` — any authenticated JWT.  
- `@Auth(UserRole.X)` — role must match (via `RolesGuard` / `@lib/decorators/auth.decorator`).

### 4.3 Dev-only

- `POST /users` guarded by `DevOnlyGuard` — not for production exposure.

---

## 5. HTTP API catalog

All paths are **relative to** `/api/v1`.

### 5.1 Root

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | No | Health/hello |

### 5.2 Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | External learner registration + JWT |
| POST | `/auth/login` | No | Student / email / teacher login |

### 5.3 Users (dev)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/users` | Dev guard | Create user |

### 5.4 Languages

Controller prefix: `languages`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/languages` | Any | List (filters in query DTO) |
| GET | `/languages/:id` | Any | By id |
| POST | `/languages` | ADMIN | Create |
| PATCH | `/languages/:id` | ADMIN | Update |
| DELETE | `/languages/:id` | ADMIN | Delete |

### 5.5 Levels

Controller: `levels` and nested routes (prefix mixed — see controller).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/levels` | Any | List levels (`languageId` optional) |
| GET | `/languages/:languageId/levels` | Any | Levels for language |
| POST | `/levels` | ADMIN | Create |
| PATCH | `/levels/:id` | ADMIN | Update |
| DELETE | `/levels/:id` | ADMIN | Delete |

### 5.6 Formations

Prefix: `formations`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/formations` | Any | Paginated list + `enrolledCount`, language, level |
| GET | `/formations/admin/stats` | ADMIN | Stats cards (**before** `:id`) |
| GET | `/formations/admin/analytics` | ADMIN | Charts data |
| GET | `/formations/:id` | Any | Detail |
| POST | `/formations` | ADMIN | Create |
| PATCH | `/formations/:id` | ADMIN | Update (revalidates teacher schedules if dates change) |
| PATCH | `/formations/:id/sale` | ADMIN | Toggle `isSaleOpen` |
| DELETE | `/formations/:id` | ADMIN | Delete |

#### Formation sessions (séances)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/formations/:formationId/sessions/preview` | ADMIN | Preview generated séances from weekly slots (no DB write) |
| POST | `/formations/:formationId/sessions/generate` | ADMIN | Insert all generated séances in one transaction if no conflicts |
| POST | `/formations/:formationId/sessions` | ADMIN | Create one session |
| GET | `/formations/:formationId/sessions` | ADMIN | List |
| GET | `/formations/:formationId/sessions/:sessionId` | ADMIN | Detail |
| PATCH | `/formations/:formationId/sessions/:sessionId` | ADMIN | Update |
| DELETE | `/formations/:formationId/sessions/:sessionId` | ADMIN | Delete |

See **`docs/formation-session-generation-api.md`** for preview/generate. Enrollment and teacher assignment remain **formation-scoped**; rooms attach to **sessions** only.

### 5.7 Enrollments

Prefix: `enrollments`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/enrollments` | APPRENANT | Self-enroll |
| GET | `/enrollments/me/profile` | APPRENANT | Card-shaped enrollments + `progressState`, bucket filter |
| GET | `/enrollments/me` | APPRENANT | Legacy raw list (deprecated in Swagger) |
| GET | `/enrollments` | ADMIN | All enrollments |
| GET | `/enrollments/formation/:formationId` | ADMIN | By formation |
| GET | `/enrollments/teacher` | ENSEIGNANT | Enrollments for taught formations |
| GET | `/enrollments/teacher/:enrollmentId` | ENSEIGNANT | Detail + certificate |

### 5.8 Certificates

Routes are **not** all under `certificates` prefix (see controller).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/certificates/:enrollmentId/generate` | ADMIN | Create certificate row |
| GET | `/certificates/me` | APPRENANT | My certificates + formation + verificationUrl |
| GET | `/public/certificates/:verificationCode` | **Public** | Verification DTO |

Teachers list certificates for a formation via **teachers** module (`GET /teachers/me/formations/:formationId/certificates`).

### 5.9 Teachers (admin)

Prefix: `teachers`. **Entire controller** `@Auth(ADMIN)` except separate `TeachersMeController`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/teachers` | ADMIN | Create teacher |
| GET | `/teachers` | ADMIN | List |
| GET | `/teachers/admin/stats` | ADMIN | Stats (**route order**: before `:teacherId`) |
| GET | `/teachers/:teacherId` | ADMIN | Detail |
| GET | `/teachers/:teacherId/formations` | ADMIN | Formations |
| POST | `/teachers/:teacherId/formations/:formationId` | ADMIN | Assign |
| DELETE | `/teachers/:teacherId/formations/:formationId` | ADMIN | Unassign |
| GET | `/teachers/:teacherId/calendar` | ADMIN | Calendar for teacher |

### 5.10 Teachers (self — `TeachersMeController`)

Prefix: `teachers`, class-level `@Auth(ENSEIGNANT)`.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/teachers/me/formations` | ENSEIGNANT | My formations |
| GET | `/teachers/me/formations/:formationId` | ENSEIGNANT | Formation detail (guard: assigned) |
| GET | `/teachers/me/calendar` | ENSEIGNANT | Global **session** calendar (`from` / `to` / `search`) |
| GET | `/teachers/me/formations/:formationId/sessions` | ENSEIGNANT | Sessions for one formation (same query filters; guard: assigned) |
| GET | `/teachers/me/formations/:formationId/enrollments` | ENSEIGNANT | Roster |
| GET | `/teachers/me/formations/:formationId/certificates` | ENSEIGNANT | Certificates for formation |

### 5.11 Dashboard

Prefix: `dashboard`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/dashboard/admin` | ADMIN | Legacy aggregated admin (deprecated) |
| GET | `/dashboard/admin/stats` | ADMIN | Stats |
| GET | `/dashboard/admin/formation-tracking/by-capacity` | ADMIN | |
| GET | `/dashboard/admin/formation-tracking/by-deadline` | ADMIN | |
| GET | `/dashboard/admin/alerts` | ADMIN | |
| GET | `/dashboard/admin/top-formations` | ADMIN | |
| GET | `/dashboard/admin/top-teachers` | ADMIN | |
| GET | `/dashboard/teacher` | ENSEIGNANT | Teacher dashboard |
| GET | `/dashboard/student/overview` | APPRENANT | Learner profile summary + next card |
| GET | `/dashboard/student` | APPRENANT | Legacy learner dashboard (deprecated) |

### 5.12 Calendar / Notifications

- `calendar` — controller exists; **no** routes beyond class shell (stub).  
- `notifications` — **no** public HTTP routes; used internally on enrollment.

---

## 6. Pagination and shared contracts

Typical shape:

```ts
{
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
```

Built via `BaseRepository.paginate` and `buildPaginatedResponse`. Limits often max **100** per DTO.

---

## 7. Domain logic (by bounded area)

### 7.1 Formations

- **Catalog:** `startDate` / `endDate` are **timestamps** — one continuous interval per formation (not a native recurrence / séance model).
- **Admin analytics** classify formations: `ENDED` > `UPCOMING` > `CLOSED` > `OPEN` (priority order) — see `formations` service/repository docs.
- **PATCH dates:** if both bounds exist after merge, `TeacherAssignmentsService.validateFormationScheduleForAssignedTeachers` runs: no overlapping intervals with **other** assigned formations; no **partially dated** sibling assignments for same teachers.

### 7.2 Teacher assignment overlap (strict interval overlap)

Rules (`teacher-assignments.service.ts` + formation PATCH validation):

- Assignment requires formation **both** `startDate` and `endDate` set.
- Teacher must not have another assignment whose formation is **missing** either date (cannot prove non-overlap).
- Overlap: `other.start < newEnd && other.end > newStart` (open interval overlap; back-to-back allowed).

**Calendar overlap queries** for teacher views use similar interval semantics (see `teachers.repository`).

### 7.3 Enrollments

- Self-enroll: formation exists, `isSaleOpen`, not duplicate, capacity check (`ENROLLED` count vs `capacity`; `null` capacity = unlimited).
- Notifications: async email after enroll (implementation in `NotificationsService`).
- **Learner profile:** `progressState` `UPCOMING` | `ACTIVE` | `COMPLETED` and `profileBucket` `IN_PROGRESS` | `COMPLETED` — see `src/modules/enrollments/domain/learner-enrollment-progress.ts` and `docs/learner-profile-api.md`.

### 7.4 Certificates

- One certificate max per enrollment (`enrollment_id` unique).
- Generate: admin-only; optional business rules (e.g. after end date) **not** fully enforced in service today.
- Public verify returns student + formation + teacher name (earliest assignment by `assigned_at`).

### 7.5 Learner vs teacher identity

- **Enrollments.** `student_id` → **always** `users.id`.  
- **JWT** for learners: `APPRENANT`, `sub` = that user id.  
- **JWT** for teachers: `ENSEIGNANT`, `sub` = `teachers.id` — never mixed into `users` for the same person unless product duplicates data (current schema assumes separate accounts).

---

## 8. E2E flows

### 8.1 External learner: register → browse → enroll → certificate

1. `POST /auth/register` → JWT (`APPRENANT`).  
2. `GET /formations` + `GET /formations/:id` → pick offering.  
3. `POST /enrollments` `{ formationId }`.  
4. `GET /enrollments/me/profile?bucket=IN_PROGRESS` and/or `GET /dashboard/student/overview`.  
5. Admin `POST /certificates/:enrollmentId/generate`.  
6. `GET /certificates/me`; public `GET /public/certificates/:code`.

### 8.2 Internal student

1. `POST /auth/login` `loginType: STUDENT` with `bacYear`, `matricule`, `password`.  
2. Same enrollment and certificate flow as above.

### 8.3 Admin: course lifecycle

1. CRUD reference data: `languages`, `levels`.  
2. `POST /formations` with language/level and dates.  
3. `POST /teachers`, `POST /teachers/:id/formations/:formationId` (requires both dates on formation).  
4. Toggle `PATCH /formations/:id/sale`; monitor `GET /dashboard/admin/*`, `GET /formations/admin/*`.

### 8.4 Teacher

1. `POST /auth/login` `TEACHER`.  
2. `GET /teachers/me/formations`, `GET /teachers/me/calendar?from&to&search`.  
3. `GET /enrollments/teacher` or per-formation enrollments; detail `GET /enrollments/teacher/:enrollmentId`.

### 8.5 Formation date change (conflict)

1. Admin `PATCH /formations/:id` with new `startDate`/`endDate`.  
2. If any assigned teacher has another formation with overlapping range → **409** with message naming conflicting formation.  
3. If teacher has undated formation assignment → **400**.

---

## 9. Use case matrix

| ID | Actor | Goal | Primary endpoints |
|----|--------|------|-------------------|
| UC-A1 | Admin | Create language/level | `POST /languages`, `POST /levels` |
| UC-A2 | Admin | Create/publish formation | `POST /formations`, `PATCH .../sale` |
| UC-A3 | Admin | Assign teacher | `POST /teachers/:id/formations/:fid` |
| UC-A4 | Admin | Fix schedule safely | `PATCH /formations/:id` (validated) |
| UC-A5 | Admin | Issue certificate | `POST /certificates/:eid/generate` |
| UC-A6 | Admin | Monitor ops | `GET /dashboard/admin/*`, `/formations/admin/*`, `/teachers/admin/stats` |
| UC-L1 | Learner | Register (external) | `POST /auth/register` |
| UC-L2 | Learner | Enroll | `POST /enrollments` |
| UC-L3 | Learner | Profile UI | `GET /dashboard/student/overview`, `GET /enrollments/me/profile` |
| UC-L4 | Learner | View certificates | `GET /certificates/me` |
| UC-T1 | Teacher | See load | `GET /teachers/me/formations`, `GET /teachers/me/calendar` |
| UC-T2 | Teacher | See students | `GET /enrollments/teacher`, formation-scoped enrollments |
| UC-P1 | Public | Verify credential | `GET /public/certificates/:code` |

---

## 10. Code map (where things live)

| Concern | Path |
|---------|------|
| Schema | `src/db/schema.ts` |
| Seeds | `src/db/seeds/*`, `src/db/seed.ts` |
| Formations repo | `src/lib/repositories/formations/formations.repository.ts` |
| Enrollments repo | `src/lib/repositories/enrollments/enrollments.repository.ts` |
| Dashboard repo | `src/lib/repositories/dashboard/dashboard.repository.ts` |
| Certificates repo | `src/lib/repositories/certificates/certificates.repository.ts` |
| Teacher assignment rules | `src/modules/teachers/teacher-assignments.service.ts` |
| Learner progress rules | `src/modules/enrollments/domain/learner-enrollment-progress.ts` |
| Module graph | `src/app.module.ts` |

---

## 11. Migration planning: rooms, séances, modules

Current platform models a **formation** as a **single time range** + metadata. There are **no**:

- **Rooms** (physical or virtual locations)  
- **Séances / sessions** (recurring or explicit occurrences)  
- **Curriculum modules** (ordered units, per-learner progress inside a formation)

Use this section as a **checklist** for a migration plan.

### 11.1 What stays stable vs what must evolve

| Area | Today | If you add séances |
|------|--------|---------------------|
| Enrollment | Per **formation** | Likely still per formation; attendance might be per session later |
| Certificate | Per **enrollment** | May stay enrollment-scoped unless product wants “module completion” |
| Teacher calendar | One block per **formation** | Should move to **union of session intervals** (or keep formation “summary” + expand sessions) |
| Overlap logic | Two **formation** `[start,end]` | Should become: teacher cannot overlap **sessions** (or rooms), not only formation envelope |
| Learner profile `progressState` | Uses **formation** `startDate`/`endDate` | May need: derive from sessions or keep formation-level “course active” + separate session UX |

### 11.2 Suggested modeling direction (incremental)

**Phase A — Additive schema (no breaking API)**

1. **`rooms`**: `id`, `name`, `code?`, `capacity?`, `metadata` jsonb optional.  
2. **`formation_sessions` (séances)**: `id`, `formation_id`, `starts_at`, `ends_at`, `room_id` nullable, `label` optional, `order` optional.  
3. Optional **`formation_modules`**: `id`, `formation_id`, `sort_order`, `title`, `description` nullable — curriculum containers.  
4. Optional link **`formation_session_modules`** if a session covers specific modules.

Backfill: for each existing formation, insert **one** `formation_sessions` row copying `start_date`/`end_date` so old data stays consistent.

**Phase B — Read paths**

- Expose `GET /formations/:id/sessions` (and/or embed in formation detail).  
- Teacher calendar: compute events from **sessions**; optionally keep current formation-level event as deprecated.

**Phase C — Write paths & constraints**

- Admin CRUD sessions; validate **room capacity** vs expected attendance if you model it.  
- Replace `validateFormationScheduleForAssignedTeachers` with **session-level** (or “formation envelope must contain all sessions” + session overlap checks).  
- Decide: can `formations.start_date`/`end_date` become **generated** (min/max of sessions) or remain source of truth until cutover.

**Phase D — Modules**

- If **modules** are only content navigation: link from LMS frontend with `formation_modules` IDs.  
- If **graded progress**: add `enrollment_module_progress` (`enrollment_id`, `module_id`, `status`, `completed_at`).

### 11.3 Risks / decisions to document early

- **Timezone:** timestamps are server/DB; séances need a policy (store UTC, display local).  
- **Teacher assignment:** still at formation level vs per-session co-teachers.  
- **Capacity:** today at formation level; room capacity might **conflict** with formation capacity.  
- **Certificates:** still tied to enrollment vs “pathway” completion.  
- **Performance:** calendar queries may need indexes on `(teacher_id)` + session time range, `(room_id, starts_at)`.

### 11.4 Module dependency order (suggested)

1. Rooms table + admin API.  
2. Sessions table + backfill + read APIs.  
3. Switch calendar to sessions (feature flag).  
4. Tighten assignment / overlap on sessions.  
5. Modules + progress (if required).  
6. Deprecate dual formation dates or auto-sync from sessions.

---

## 12. Existing deep-dive docs

Use together with this file:

| Doc | Focus |
|-----|--------|
| `formation-session-generation-api.md` | Weekly-slot **preview/generate** for séances |
| `formation-scheduling-and-attendance-api.md` | **Rooms / sessions / attendance** spec |
| `business-use-cases-and-seed.md` | Domain + academic seed |
| `learners-formations-certificates-full.md` | Learner + formation + cert flows |
| `learner-profile-api.md` | APPRENANT profile & progress |
| `enrollments-api.md` | Inscriptions / admin enrollments |
| `formations-api.md` | Formations + admin analytics |
| `certificates-api.md` | Certificates |
| `teachers-api.md` | Teachers + admin calendar |
| `teacher-calendar-api.md` | Calendar query semantics |
| `admin-dashboard-api.md` | Admin dashboard widgets |
| `enseignant-api-llm-spec.md` | Teacher-facing spec (LLM-oriented) |

---

*UBMA CEIL — platform master reference for DB, APIs, types, logic, flows, and structural migration planning.*
