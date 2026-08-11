# UBMA CEIL — Platform master reference (modules, APIs, DTOs, services, data)

**Project:** UBMA CEIL — Centre d’Enseignement Intensif des Langues, Université Badji Mokhtar Annaba.  
**Last updated:** 2026-05-01  
**API base path:** `/api/v1` (global prefix).  
**Stack:** NestJS 11, Drizzle ORM, PostgreSQL, JWT (`passport-jwt`), Swagger, `class-validator` / `class-transformer`.

**Companion docs (feature depth):**

- `IMPLEMENTATION_REPORT.md` — scheduling & attendance implementation changelog.
- `TEST_ARCHITECTURE_AND_ACADEMIC_DATA_PIPELINE.md` — E2E tests, migrations, academic seed pipeline & demo scenarios.
- `formation-session-generation-api.md` — weekly preview/generate, UTC rules.
- `academic-scheduling-feature.md`, `formation-scheduling-and-attendance-api.md`, `teacher-calendar-api.md`, `business-use-cases-and-seed.md`, `platform-master-reference.md` (if present).

---

## Table of contents

1. [Auth, roles, and guards](#1-auth-roles-and-guards)
2. [PostgreSQL schema summary](#2-postgresql-schema-summary)
3. [Repositories](#3-repositories)
4. [Scheduling library (`src/lib/scheduling`)](#4-scheduling-library-srclibscheduling)
5. [HTTP API by module](#5-http-api-by-module)
6. [DTO catalog (request/response)](#6-dto-catalog-requestresponse)
7. [Service catalog](#7-service-catalog)
8. [Domain rules (high level)](#8-domain-rules-high-level)
9. [Automated tests & DB](#9-automated-tests--db)

---

## 1. Auth, roles, and guards

### User roles (`UserRole`)

- **`ADMIN`** — `users` row, JWT `sub` = user id.
- **`APPRENANT`** — `users` row (internal student or external learner per `account_type`), JWT `sub` = user id.
- **`ENSEIGNANT`** — **`teachers`** row (separate table), JWT `sub` = **teacher id**; login via `loginType: TEACHER`.

### Auth decorator

- `@Auth()` — JWT required; optional role list via `@Auth(UserRole.ADMIN, …)` using `JwtAuthGuard` + `RolesGuard`.
- Bearer token: `Authorization: Bearer <accessToken>`.

### Other guards

- **`DevOnlyGuard`** — `POST /users` (dev-only user creation).
- **`TeacherFormationAccessGuard`** — ensures the teacher is assigned to the formation for selected “me” formation routes.

---

## 2. PostgreSQL schema summary

Defined in `src/db/schema.ts` (Drizzle). Enums:

| Enum | Values |
|------|--------|
| `role` | `ADMIN`, `APPRENANT` |
| `account_type` | `INTERNAL_STUDENT`, `EXTERNAL_LEARNER` |
| `enrollment_status` | `ENROLLED`, `CANCELLED` |
| `formation_teacher_role` | `MAIN_TEACHER`, `ASSISTANT` |
| `session_status` | `SCHEDULED`, `CANCELLED`, `COMPLETED` |
| `attendance_status` | `PRESENT`, `ABSENT`, `LATE`, `EXCUSED` |

**Tables (core):**

| Table | Purpose |
|-------|---------|
| `users` | Students/admins; unique `email`; unique `(bac_year, matricule)` for internal. |
| `teachers` | Teacher accounts; unique `email`. |
| `languages` | Language catalog; unique `code`. |
| `formation_levels` | Levels per language; unique `(language_id, code)`. |
| `formations` | Course offerings; FK language, level, optional `creator_id`. |
| `rooms` | Physical/virtual rooms; unique `code`; `capacity`, `is_active`. |
| `formation_sessions` | Séances; FK formation, room; `start_at` / `end_at`, `status`. |
| `formation_teachers` | Teacher ↔ formation assignments; unique `(formation_id, teacher_id)`. |
| `enrollments` | Student ↔ formation; unique `(student_id, formation_id)`; `status`. |
| `session_attendance` | Per session + enrollment; unique `(session_id, enrollment_id)`; marks + `marked_by_teacher_id`. |
| `certificates` | One per enrollment; `verification_code`, `certificate_number`, optional `pdf_url`. |

Indexes include room/time composites on `formation_sessions` and lookup indexes on attendance and `formation_teachers`.

---

## 3. Repositories

Repositories live primarily under **`src/lib/repositories/`**. The teachers domain also uses **`src/modules/teachers/teachers.repository.ts`** for calendar/formation queries.

| Repository | Location | Responsibility |
|------------|----------|----------------|
| `auth.repository` | `lib/repositories/auth` | Auth persistence helpers. |
| `users.repository` | `lib/repositories/users` | Users CRUD / lookup. |
| `formations.repository` | `lib/repositories/formations` | Formations, admin stats/analytics queries. |
| `formation-sessions.repository` | `lib/repositories/formation-sessions` | Sessions CRUD, overlap/conflict queries. |
| `rooms.repository` | `lib/repositories/rooms` | Rooms; `findManyByIds` for batch validation. |
| `enrollments.repository` | `lib/repositories/enrollments` | Enrollments, pagination, **batch `attendanceSummary`**, learner profile cards. |
| `session-attendance.repository` | `lib/repositories/session-attendance` | Attendance rows, upserts. |
| `certificates.repository` | `lib/repositories/certificates` | Certificates. |
| `languages.repository` | `lib/repositories/languages` | Languages. |
| `levels.repository` | `lib/repositories/levels` | Formation levels. |
| `dashboard.repository` | `lib/repositories/dashboard` | Admin/teacher/learner dashboard aggregates. |
| `teachers.repository` | `modules/teachers/teachers.repository` | Teacher calendar events, formation sessions, `nextSession` helpers. |

---

## 4. Scheduling library (`src/lib/scheduling`)

| File | Role |
|------|------|
| `scheduling.module.ts` | Nest module exporting conflict scheduling service. |
| `schedule-conflict.service.ts` | `checkGenerationProbesAgainstDb` — room / same-formation / teacher conflicts; **ignores `CANCELLED`** sessions. |
| `schedule-conflict.types.ts` | `SessionGenerationProbe` and related types. |

Used by `FormationSessionGenerationService` and manual session create/update flows in `FormationSessionsService`.

---

## 5. HTTP API by module

All routes below are prefixed with **`/api/v1`**.

### 5.1 `AppController` (`/`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` → effectively **`/api/v1`** | No | Health-style greeting (`AppService.getHello`). |

### 5.2 Auth (`auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Register external learner (`APPRENANT` + `EXTERNAL_LEARNER`); returns JWT + user. |
| POST | `/auth/login` | No | `STUDENT` (matricule + bacYear), `EMAIL`, or `TEACHER`. |

### 5.3 Users (`users`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/users` | **DevOnlyGuard** | Create user (dev tooling). |

### 5.4 Languages (`languages`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/languages` | Any authenticated | Active languages (paginated). |
| GET | `/languages/:id` | Any authenticated | Language by id. |
| POST | `/languages` | ADMIN | Create. |
| PATCH | `/languages/:id` | ADMIN | Update. |
| DELETE | `/languages/:id` | ADMIN | Deactivate. |

### 5.5 Levels (`levels` — note: controller has **empty** global prefix; paths are as listed)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/levels` | Any authenticated | Active levels (`languageId` optional). |
| GET | `/languages/:languageId/levels` | Any authenticated | Levels for one language. |
| POST | `/levels` | ADMIN | Create level. |
| PATCH | `/levels/:id` | ADMIN | Update. |
| DELETE | `/levels/:id` | ADMIN | Deactivate. |

### 5.6 Rooms (`rooms`) — **ADMIN only** (class-level `@Auth(ADMIN)`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/rooms/availability-for-weekly-slot` | Weekly slot room availability over formation period (**UX helper**; no teacher conflicts). |
| POST | `/rooms` | Create room. |
| GET | `/rooms` | List (search, `isActive`, pagination). |
| GET | `/rooms/:id` | Get one. |
| PATCH | `/rooms/:id` | Update. |
| DELETE | `/rooms/:id` | Delete if unused by sessions. |

See `docs/rooms-api.md`. **Route order:** `availability-for-weekly-slot` is registered before `:id` to avoid UUID parse issues.

### 5.7 Formations (`formations`) — `FormationsController` + `FormationSessionsController` share **`@Controller('formations')`**

**Catalog & admin:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/formations` | ADMIN | Create formation. |
| POST | `/formations/with-sessions` | ADMIN | Transaction: formation + teacher assignments + initial sessions. |
| GET | `/formations` | Any authenticated | Paginated list; filters `languageId`, `levelId`. |
| GET | `/formations/admin/stats` | ADMIN | Stats cards. |
| GET | `/formations/admin/analytics` | ADMIN | Charts: by status, language, level. |
| GET | `/formations/:id` | Any authenticated | Detail. |
| PATCH | `/formations/:id` | ADMIN | Update. |
| PATCH | `/formations/:id/sale` | ADMIN | Toggle `isSaleOpen`. |
| DELETE | `/formations/:id` | ADMIN | Delete formation. |

**Sessions (ordering: preview/generate before `:sessionId`):**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/formations/:formationId/sessions/preview` | ADMIN | Weekly-slot preview; **no DB writes**; conflict metadata per candidate. |
| POST | `/formations/:formationId/sessions/generate` | ADMIN | Transactional insert; **409** on conflict. |
| POST | `/formations/:formationId/sessions` | ADMIN | Manual create séance. |
| GET | `/formations/:formationId/sessions` | ADMIN | List sessions for formation. |
| GET | `/formations/:formationId/sessions/:sessionId` | ADMIN | Get one. |
| PATCH | `/formations/:formationId/sessions/:sessionId` | ADMIN | Update. |
| DELETE | `/formations/:formationId/sessions/:sessionId` | ADMIN | Delete. |

### 5.8 Enrollments (`enrollments`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/enrollments` | APPRENANT | Enroll (`formationId`). |
| GET | `/enrollments/me/profile` | APPRENANT | Card-shaped profile rows + **`attendanceSummary`**. |
| GET | `/enrollments/me` | APPRENANT | Deprecated raw list. |
| GET | `/enrollments` | ADMIN | All enrollments (+ summaries). |
| GET | `/enrollments/teacher` | ENSEIGNANT | Enrollments for taught formations (+ summaries). |
| GET | `/enrollments/teacher/:enrollmentId` | ENSEIGNANT | One enrollment detail. |
| GET | `/enrollments/formation/:formationId` | ADMIN | By formation (+ summaries). |

### 5.9 Teachers — **admin** (`teachers`, `TeachersController`, `@Auth(ADMIN)`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/teachers` | Create teacher. |
| GET | `/teachers` | List teachers. |
| GET | `/teachers/admin/stats` | Dashboard teacher stats. |
| GET | `/teachers/:teacherId` | Teacher detail. |
| GET | `/teachers/:teacherId/formations` | Teacher’s formations. |
| POST | `/teachers/:teacherId/formations/:formationId` | Assign teacher. |
| DELETE | `/teachers/:teacherId/formations/:formationId` | Unassign. |
| GET | `/teachers/:teacherId/calendar` | Admin view of teacher calendar (SESSION events). |

### 5.10 Teachers — **“me”** (`teachers`, `TeachersMeController`, `@Auth(ENSEIGNANT)`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/teachers/me/formations` | Assigned formations (+ **`nextSession`** where implemented). |
| GET | `/teachers/me/formations/:formationId` | Formation detail (guard: assigned). |
| GET | `/teachers/me/calendar` | Global calendar — **SESSION** events only (`from` / `to` / `search`). |
| GET | `/teachers/me/formations/:formationId/sessions` | Sessions for one formation (same filters). |
| GET | `/teachers/me/sessions/:sessionId/attendance` | List learners + attendance for session. |
| PATCH | `/teachers/me/sessions/:sessionId/attendance` | Bulk upsert attendance. |
| GET | `/teachers/me/formations/:formationId/enrollments` | Paginated enrollments for formation. |
| GET | `/teachers/me/formations/:formationId/certificates` | Paginated certificates for formation. |

### 5.11 Certificates (`CertificatesController` — **empty** controller prefix)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/certificates/:enrollmentId/generate` | ADMIN | Issue certificate. |
| GET | `/certificates/me` | APPRENANT | My certificates. |
| GET | `/public/certificates/:verificationCode` | **Public** | Verify by code. |

### 5.12 Dashboard (`dashboard`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/dashboard/admin` | ADMIN | **Legacy** aggregated admin dashboard. |
| GET | `/dashboard/admin/stats` | ADMIN | New stats cards. |
| GET | `/dashboard/admin/formation-tracking/by-capacity` | ADMIN | Occupancy tracking. |
| GET | `/dashboard/admin/formation-tracking/by-deadline` | ADMIN | Deadline tracking. |
| GET | `/dashboard/admin/alerts` | ADMIN | Priority alerts. |
| GET | `/dashboard/admin/top-formations` | ADMIN | Top formations. |
| GET | `/dashboard/admin/top-teachers` | ADMIN | Top teachers. |
| GET | `/dashboard/teacher` | ENSEIGNANT | Teacher dashboard. |
| GET | `/dashboard/student/overview` | APPRENANT | Learner overview DTO. |
| GET | `/dashboard/student` | APPRENANT | **Deprecated** learner dashboard. |

### 5.13 Calendar (`calendar`)

| Method | Path | Description |
|--------|------|-------------|
| — | — | **`CalendarController` is currently a stub** (no HTTP routes). |

### 5.14 Notifications (`notifications`)

| Method | Path | Description |
|--------|------|-------------|
| — | — | **`NotificationsController` is a stub**; `NotificationsService` used internally (e.g. enrollment emails). |

---

## 6. DTO catalog (request/response)

Paths are under `src/` unless noted.

### Common

| DTO | File | Fields / notes |
|-----|------|----------------|
| `PaginationQueryDto` | `common/pagination/dto/pagination-query.dto.ts` | `page`, `limit`, `search?`, `sortBy?`, `sortOrder` (`asc`/`desc`). |

### Auth

| DTO | Fields |
|-----|--------|
| `LoginDto` | `loginType` (`STUDENT` \| `EMAIL` \| `TEACHER`), conditional `bacYear`+`matricule` or `email`, `password`. |
| `RegisterDto` | `firstName`, `lastName`, `email`, `password`, `dob` (ISO date). |

### Users

| DTO | Fields |
|-----|--------|
| `CreateUserDto` | `firstName`, `lastName`, `bacYear`, `matricule`, `password`, `role` (`ADMIN` \| `APPRENANT`). |

### Languages

| DTO | Fields |
|-----|--------|
| `CreateLanguageDto` | `name`, `code`, `isActive?`. |
| `UpdateLanguageDto` | Partial of create. |
| `FindLanguagesQueryDto` | Extends pagination. |

### Levels

| DTO | Fields |
|-----|--------|
| `CreateLevelDto` | `languageId`, `code`, `name`, `description?`, `order`, `isActive?`. |
| `UpdateLevelDto` | Partial of create. |
| `FindLevelsQueryDto` | Pagination + optional `languageId`. |

### Rooms

| DTO | Fields |
|-----|--------|
| `CreateRoomDto` | `code`, `name`, `capacity` (≥1). |
| `UpdateRoomDto` | Optional `code`, `name`, `capacity`, `isActive`. |
| `RoomAvailabilityForWeeklySlotDto` | `formationId`, `dayOfWeek` (1–7), `startTime`, `endTime` (`HH:mm`). |
| `RoomWeeklyAvailabilityResponseDto` / row / conflict DTOs | Response for weekly room availability helper. See `docs/rooms-api.md`. |

| DTO | Fields |
|-----|--------|
| `CreateFormationDto` | `title`, `description?`, `languageId`, `levelId`, `price?`, `capacity`, `startDate`, `endDate`. |
| `UpdateFormationDto` | `PartialType` of create. |
| `ToggleSaleDto` | `isSaleOpen`. |
| `FindFormationsQueryDto` | Pagination + `languageId?`, `levelId?`. |
| `CreateFormationWithSessionsDto` | `formation` (nested body), `teacherIds[]`, `sessions[]` (`roomId`, `startAt`, `endAt`, optional title/description). |

### Formations — sessions & generation

| DTO | Fields |
|-----|--------|
| `CreateFormationSessionDto` | `title?`, `description?`, `roomId`, `startAt`, `endAt` (ISO). |
| `UpdateFormationSessionDto` | Optional `title`, `description`, `roomId`, `startAt`, `endAt`, `status` (`SCHEDULED`/`CANCELLED`/`COMPLETED`). |
| `WeeklySessionSlotDto` | `dayOfWeek` (1–7), `startTime`/`endTime` `HH:mm`, `roomId`, optional `title`/`description`. |
| `GenerateFormationSessionsDto` | `weeklySlots` (1–14 items). |

### Formations — Swagger response DTOs

| DTO | Role |
|-----|------|
| `PreviewConflictRoomItemDto` | Room conflict detail (`roomId`, `roomCode`, `sessionId`, titles, times). |
| `PreviewConflictTeacherItemDto` | Teacher conflict detail. |
| `PreviewConflictFormationItemDto` | Same-formation overlap detail. |
| `GeneratedSessionPreviewItemDto` | `tempId`, `title`, `description`, `startAt`, `endAt`, `dayOfWeek`, **`slotIndex` (0-based index into request `weeklySlots`)**, nested `room`, `conflictStatus` (`OK`/`CONFLICT`), `status` (`SCHEDULED`/`CONFLICT`), `roomConflicts`, `teacherConflicts`, `formationConflicts`. |
| `GenerateSessionsPreviewSummaryDto` | `totalGenerated`, `validCount`, `conflictCount`. |
| `GenerateSessionsPreviewResponseDto` | `data[]`, `summary`. |
| `GenerateSessionsSummaryDto` | `createdCount`. |
| `GenerateSessionsResponseDto` | `created[]`, `summary`. |
| `AdminFormationStatsDto` | `totalFormations`, `openSales`, `closedSales`, `upcomingFormations`. |
| `AdminFormationAnalyticsDto` | `byStatus`, `byLanguage`, `byLevel` arrays. |

### Enrollments

| DTO | Fields |
|-----|--------|
| `CreateEnrollmentDto` | `formationId`. |
| `FindEnrollmentsQueryDto` | Pagination + `status?`, `formationId?`. |
| `FindLearnerProfileEnrollmentsQueryDto` | `bucket?` (`IN_PROGRESS`/`COMPLETED`/`ALL`), `page`, `limit`, `sortBy`, `sortOrder`. |
| `LearnerProfileSummaryDto` | Counts for overview. |
| `LearnerFormationCardNestedDto` | Formation subset for cards. |
| `LearnerEnrollmentCardItemDto` | Card row shape (+ used in overview). |
| `LearnerProfileOverviewResponseDto` | `summary`, optional `nextFormation`. |

### Teachers

| DTO | Fields |
|-----|--------|
| `CreateTeacherDto` | `firstName`, `lastName`, `email`, `password`. |
| `FindTeachersQueryDto` | Pagination only. |
| `FindTeacherCalendarQueryDto` | `from?`, `to?`, `search?` (validated range). |
| `FindTeacherFormationsQueryDto` | Extends `FindFormationsQueryDto`. |
| `FindTeacherFormationSessionsQueryDto` | Same as calendar query (formation-scoped). |
| `UpdateSessionAttendanceDto` | `records[]`: `enrollmentId`, `status` (`PRESENT`/`ABSENT`/`LATE`/`EXCUSED`). |
| `AdminTeacherStatsDto` | Teacher/assignment aggregate counts. |

### Certificates

| DTO | Fields |
|-----|--------|
| `FindMyCertificatesQueryDto` | Pagination only. |

### Dashboard

| DTO | Fields |
|-----|--------|
| `DashboardQueryDto` | `limit?`, `minOccupancyRate?`, `withinDays?` (for tracking endpoints). |
| `AdminDashboardStatsDto` | Card metrics (open formations, pending, active students, certificates to generate, active teachers). |
| `FormationCapacityTrackingItemDto` | Formation occupancy row + `status`. |
| `FormationDeadlineTrackingItemDto` | Deadline row + `daysRemaining` + `status`. |
| `AdminAlertDto` | `id`, `type`, `severity`, `title`, `description`, `count`, `actionLabel`, `actionHref`. |
| `TopFormationDto` | Ranking + `successRate`. |
| `TopTeacherDto` | Ranking by formations/students. |

---

## 7. Service catalog

| Service | Module | Responsibility |
|---------|--------|----------------|
| `AppService` | App | Root hello. |
| `AuthService` | Auth | Register/login, JWT issuance. |
| `UsersService` | Users | Dev user creation. |
| `LanguagesService` | Languages | Language CRUD/list. |
| `LevelsService` | Levels | Level CRUD/list. |
| `RoomsService` | Rooms | Room CRUD; delete guard if sessions exist. |
| `FormationsService` | Formations | Formations CRUD, sale toggle, admin stats/analytics, `createFormationWithSessions`. |
| `FormationSessionsService` | Formations | Manual session CRUD; validation (period, room capacity, conflicts); list/get. |
| `FormationSessionGenerationService` | Formations | Weekly **preview** vs **generate**; uses UTC expansion util + `ScheduleConflictService`. |
| `EnrollmentsService` | Enrollments | Enroll, profile cards, admin/teacher lists, **`attendanceSummary` attachment**. |
| `TeachersService` | Teachers | Admin teacher CRUD/list/stats; calendars; formation sessions; formation enrollments/certificates; `nextSession` helpers. |
| `TeacherAssignmentsService` | Teachers | Assign/unassign teachers to formations. |
| `SessionAttendanceService` | Teachers | GET/PATCH attendance for a session (assigned teacher). |
| `CertificatesService` | Certificates | Generate, list mine, public verify. |
| `DashboardService` | Dashboard | Admin/teacher/learner dashboard aggregations. |
| `CalendarService` | Calendar | Stub / reserved. |
| `NotificationsService` | Notifications | Email/notifications (e.g. Resend). |
| `ScheduleConflictService` | Scheduling | Cross-session conflict probes. |

---

## 8. Domain rules (high level)

### Session times & formation window

- Manual and generated sessions must fall within formation `startDate`–`endDate` (inclusive of instants per service validation).
- Duration caps (e.g. max 6h) enforced in services/DTOs as implemented.

### Conflicts

- Overlap rule: `existing.startAt < newEndAt && existing.endAt > newStartAt`.
- **`CANCELLED`** sessions are excluded from conflict checks.
- Dimensions: **room**, **same formation**, **teacher** (across all assigned formations).

### Attendance summaries (`EnrollmentAttendanceSummary`)

Computed in `EnrollmentsRepository.getAttendanceSummariesByEnrollmentIds`:

- **`totalSessionsCount`**: count of **non-`CANCELLED`** sessions for the formation.
- Per-enrollment marks aggregated by status; **`unmarkedCount`** = total − present − absent − late − excused.
- **`attendanceRate`**: `round(presentCount / totalSessionsCount * 100)` (0 if no sessions).

### JWT / teacher vs admin

- Teacher-only routes expect **`ENSEIGNANT`** and `sub` matching **`teachers.id`**.
- Admin JWT must not pass teacher “me” guards (typically **403**).

---

## 9. Automated tests & DB

- **E2E config:** `test/jest-e2e.json`, setup `test/jest-setup.e2e.ts`, global migrate `test/global-setup.e2e.ts`.
- **Test DB:** Docker service `postgres_test` (see `docker-compose.yaml`); connection in **`.env.test`** (`DATABASE_URL`, `JWT_SECRET`, etc.).
- **Scripts:** `npm run test:e2e`, `npm run test:db:migrate`, `npm run test:db:reset`, `npm run test:all` (see `package.json`).
- **Specs:** `test/scheduling.*.e2e-spec.ts`, `test/app.e2e-spec.ts` — HTTP, real Postgres, migrations, JWT login.

**Development DB** remains the default `postgres` service in Compose (separate port/DB name from test).

---

*This document is generated as a single “full stack” reference. For behavioral nuance (edge cases, exact error codes, Swagger examples), use the running Swagger UI and the feature-specific docs under `docs/`.*
