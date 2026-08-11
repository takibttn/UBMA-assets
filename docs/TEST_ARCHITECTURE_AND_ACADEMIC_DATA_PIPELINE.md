# UBMA CEIL — Test architecture, data flow, migrations & academic seed pipeline

**Last updated:** 2026-05-01  
**Purpose:** Describe how **automated tests**, **runtime API flows**, **Drizzle migrations**, and **academic seeds** fit together after the scheduling, attendance, and dashboard refactors.

---

## 1. Test architecture (E2E)

### 1.1 Stack

| Piece | Role |
|-------|------|
| **Jest** (`test/jest-e2e.json`) | `testMatch: test/**/*.e2e-spec.ts`, `maxWorkers: 1`, long timeout |
| **Supertest** | HTTP against the real Nest HTTP server (`import request = require('supertest')` — CommonJS interop) |
| **Nest `TestingModule`** | `AppModule` via `test/utils/e2e-app.factory.ts` — global prefix `api/v1`, same `ValidationPipe` as prod intent |
| **PostgreSQL** | Dedicated DB from **`.env.test`** (`DATABASE_URL`), never the default dev DB |
| **Drizzle migrations** | `test/global-setup.e2e.ts` → `runMigrations(DATABASE_URL)` before any suite |

### 1.2 Lifecycle

```
globalSetup          → migrate test DB (drizzle folder)
jest-setup.e2e.ts    → load .env.test, require DATABASE_URL + JWT_SECRET
per describe file:
  beforeAll          → truncateTestTables() (optional first)
  beforeEach         → truncateTestTables() for isolation
  createE2eApp()     → Nest bootstrap + DRIZZLE_DB
afterAll             → app.close()
globalTeardown       → close pg pool used for TRUNCATE
```

### 1.3 Database hygiene

- **`test/utils/test-db.ts`** — `TRUNCATE … CASCADE` on app tables (not `drizzle` migration metadata). Order respects FKs.
- **`npm run test:db:reset`** — `DROP SCHEMA public CASCADE` on **test URL only**, then re-run migrations (`src/db/reset-test-db.ts`).
- **`npm run test:all`** — `build` + **`test:db:reset`** + `test:e2e` (see `package.json`).

### 1.4 Auth in tests

- **Real JWT** via **`POST /api/v1/auth/login`** with `EMAIL`, `TEACHER`, or seed payloads.
- **`test/utils/http-helpers.ts`** — `loginAsUser`, `authHeader`, `api(app)`.
- **`test/utils/factories.ts`** — inserts users/teachers/formations/sessions aligned with validation rules (capacity, dates).

### 1.5 What E2E proves vs. what seeds prove

| Concern | E2E (test DB) | Academic seed (dev DB) |
|---------|----------------|-------------------------|
| HTTP + guards | Yes | Manual / scripts |
| Conflict / preview / generate logic | Yes (per suite) | Optional API calls |
| Stable multi-tenant dataset | No (truncate each run) | Yes (idempotent upserts) |
| Demo logins for UX / training | No | Yes (`Password123`, documented emails) |

---

## 2. Implementation data flow (runtime)

### 2.1 Request path (simplified)

```
Client
  → JWT middleware (sub = users.id OR teachers.id, role from payload)
  → RolesGuard (+ optional TeacherFormationAccessGuard)
  → Controller DTO validation (class-validator)
  → Service orchestration
  → Repository (Drizzle) / cross-cutting ScheduleConflictService
  → PostgreSQL
```

### 2.2 Scheduling & attendance (feature cross-cut)

```
POST/PATCH sessions (admin)
  → FormationSessionsService / FormationSessionGenerationService
      → formation validation (dates, room capacity, active room)
      → ScheduleConflictService.checkGenerationProbesAgainstDb
          → room overlap, same-formation overlap, teacher overlap
          → ignores CANCELLED sessions

GET/PATCH .../teachers/me/sessions/:id/attendance
  → SessionAttendanceService + session_attendance repository
  → enrollment must belong to session’s formation

Enrollment lists / learner profile
  → EnrollmentsRepository.getAttendanceSummariesByEnrollmentIds (batch)
      → totalSessionsCount = non-CANCELLED sessions per formation
      → attendanceRate = round(present / total * 100)
```

### 2.3 Migrations vs. seeds

| Step | Command / file | Database |
|------|----------------|----------|
| Schema change | `drizzle-kit generate` → SQL in `drizzle/` | — |
| Apply | `npm run db:migrate` (`.env`) or `test:db:migrate` (`.env.test`) | Target `DATABASE_URL` |
| Data | `npm run db:seed` | Dev / staging `DATABASE_URL` |

Seeds **do not** replace migrations; they assume tables exist.

---

## 3. Academic seed pipeline (latest)

### 3.1 Entry

- **`npm run db:seed`** → `src/db/seed.ts` → **`runAcademicSeed()`** in `src/db/seeds/index.ts`.

### 3.2 Phases (order = FK safety)

| Phase | Module | Contents |
|-------|--------|----------|
| 1 | `seed.languages-levels.ts` | 5 languages × 6 CEFR-style levels |
| 2 | `seed.admin.ts`, `seed.teachers.ts` | Admin + 10 teachers |
| 3 | `seed.rooms.ts` | Active rooms + **inactive room** for admin API demos |
| 4 | `seed.formations.ts` | 20 staggered formations + MAIN_TEACHER assignments |
| 5 | `seed.formation-sessions.ts` | Up to 4 SCHEDULED séances per formation |
| 6 | `seed.learners.ts`, `seed.enrollments.ts` | 20 external learners, 1:1 ENROLLED |
| 7 | `seed.session-attendance.ts` | Marks on first 3 formations × 2 sessions |
| 8 | `seed.certificates.ts` | Certs for `CEIL Academic Formation%` enrollments only |
| 9 | **`seed.demo-academic-scenarios.ts`** | **Feature-complete demo data** (closed sale, internal learner, session statuses, cancelled enrollment, ASSISTANT teacher) |

### 3.3 Demo scenarios (phase 9) — use-case mapping

| Seed element | Covers |
|--------------|--------|
| **Inactive room** `SALLE-MAINT` | Room list filters, “inactive room” session validation |
| **Formation** `CEIL Academic Demo — Inscriptions fermées` (`isSaleOpen: false`) | Learner **L5** (enrollment closed), admin formations list |
| **User** internal `bacYear: 2023`, `matricule: INT-CEIL-2023-001` | **I1** `STUDENT` login (no email) |
| **Sessions** on Formation 01: `CANCELLED` + `COMPLETED` extras | `nextSession`, conflict-ignore, `attendanceSummary` denominators |
| **Formation + learner** `CEIL Academic Demo — Cohort annulée` + `CANCELLED` enrollment | Cancelled cohort, teacher roster filters |
| **`ASSISTANT`** on Formation 01 (teacher 02) | `formation_teacher_role` |

Demo titles use prefix **`CEIL Academic Demo`** so **`seed.certificates.ts`** (which only matches `CEIL Academic Formation%`) does not issue junk certificates for empty or cancelled-only demos.

### 3.4 Idempotency

- Demo module uses **find-by-title / find-by-code** before insert, or **unique keys** (`session` title suffixes, `(bacYear, matricule)` for internal learner).
- Re-running `db:seed` augments missing demo rows; it does not wipe.

---

## 4. Logic checklist (regression mental model)

1. **Teacher assignment overlap** — Non-overlapping formation windows in main 20-formation grid; demo formations use late 2027 windows to avoid collisions.
2. **Room capacity** — Academic formations `capacity: 20` ≤ smallest active seeded room used (`LAB-01` = 20).
3. **Session overlap** — Seeded SCHEDULED sessions use staggered days/hours inside each formation window.
4. **CANCELLED sessions** — Excluded from conflict checks; still counted in **totalSessionsCount** excludes (only CANCELLED excluded from **total**).
5. **E2E** — Assertions encode overlap rule, JWT roles, and summary math documented in `UBMA_CEIL_MASTER_REFERENCE.md`.

---

## 5. Related docs

- `business-use-cases-and-seed.md` — domain use-case catalogue + seed cheatsheet (update when emails/passwords change).
- `src/db/seeds/README.md` — short pipeline reference for developers.
- `UBMA_CEIL_MASTER_REFERENCE.md` — full module/DTO/API listing.
- `IMPLEMENTATION_REPORT.md` — feature implementation changelog.

---

*UBMA CEIL — test, migration, and academic data pipeline reference.*
