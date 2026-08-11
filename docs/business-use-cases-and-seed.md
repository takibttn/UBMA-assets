# UBMA CEIL API — business logic, data flow, E2E behaviour, use cases & academic seed

This document ties together **domain rules**, **request flows**, **representative scenarios**, and the **modular academic database seed** (`src/db/seeds/`).

---

## 1. High-level architecture

| Area | Responsibility |
|------|----------------|
| **Auth** | Login for `users` (APPRENANT / ADMIN via `STUDENT` \| `EMAIL`) and `teachers` (`TEACHER`). JWT: `sub` + `role` (`ENSEIGNANT` for teachers despite separate table). |
| **Users** | Admins and learners (`role`: `ADMIN` \| `APPRENANT`). Learners: `INTERNAL_STUDENT` (bac + matricule) or `EXTERNAL_LEARNER` (email). |
| **Teachers** | Dedicated `teachers` table; admin CRUD, assignments, calendar, “me” APIs. |
| **Formations** | Catalog CRUD (admin), dates, capacity, sale flag; date changes recheck teacher schedules. |
| **Enrollments** | Learner joins a formation; capacity / sale checks; teacher-wide and per-formation listings. |
| **Certificates** | One per enrollment (unique `enrollment_id`); verification metadata. |
| **Dashboard** | Aggregated stats for admin / teacher / student. |
| **Languages / levels** | Reference data for formation classification. |

---

## 2. Core data model (simplified)

```
users (ADMIN | APPRENANT) ─┬─ enrollments ── formations ─┬─ languages / formation_levels
                           │                                  │
teachers ──────────────────┴─ formation_teachers ───────────┘

formations.creator_id → users (admin)
formation_teachers.assigned_by_id → users (admin)
certificates.enrollment_id → enrollments
```

Uniqueness highlights:

- `users`: `(bac_year, matricule)` for internals; `email` for non-null emails.
- `teachers`: `email` unique.
- `enrollments`: `(student_id, formation_id)` unique.
- `formation_teachers`: `(formation_id, teacher_id)` unique.

---

## 3. Data flows

### 3.1 Authentication

```
Client → POST /auth/login
  ├─ STUDENT: bacYear + matricule + password → users
  ├─ EMAIL: email + password → users (learner/admin)
  └─ TEACHER: email + password → teachers
       → JWT { sub, role } (teacher: sub = teachers.id, role = ENSEIGNANT)
```

### 3.2 Learner enrollment

```
APPRENANT + JWT → POST /enrollments { formationId }
  → formation exists, isSaleOpen, capacity not exceeded (ENROLLED count)
  → no duplicate (student, formation)
  → optional enrollment notification (async)
```

### 3.3 Admin assigns teacher to formation

```
ADMIN + JWT → POST /teachers/:teacherId/formations/:formationId
  → teacher exists; formation has **both** startDate and endDate
  → no duplicate assignment
  → teacher has **no** other assignment to a formation **missing** start/end (otherwise overlap cannot be proved)
  → **no time overlap** with any other assigned formation (strict interval overlap; back-to-back allowed)
```

### 3.4 Admin updates formation dates

```
ADMIN → PATCH /formations/:id (start/end)
  → merged effective range valid (start < end)
  → **validateFormationScheduleForAssignedTeachers**: same overlap/undated rules as assignment
  → 409 on clash with another formation for an assigned teacher
```

### 3.5 Teacher views

- **Calendar preview:** `GET /teachers/me/calendar` (`from` / `to` / `search`, no pagination).
- **Formation detail / enrollments / certificates:** `GET /teachers/me/formations/:formationId/...` with guard (must be assigned).

### 3.6 Global teacher enrollment list

- `GET /enrollments/teacher` — all enrollments across taught formations (rich list + optional `GET /enrollments/teacher/:id` detail).

---

## 4. Use-case catalogue (scenarios)

### 4.1 Learner (external)

| ID | Scenario | Preconditions | Main API | Expected |
|----|-----------|---------------|----------|----------|
| L1 | Register / exists seed user | Email `EXTERNAL_LEARNER` | `POST /auth/login` `EMAIL` | 200 + JWT |
| L2 | List my enrollments | JWT APPRENANT | `GET /enrollments/me` | Paginated |
| L3 | Enroll | Sale open, capacity OK | `POST /enrollments` | 201 |
| L4 | Duplicate enroll | Already enrolled | `POST /enrollments` | 409 |
| L5 | Closed sale | `isSaleOpen` false | `POST /enrollments` | 400 |
| L6 | Full formation | `ENROLLED` count ≥ capacity | `POST /enrollments` | 400 |

### 4.2 Learner (internal)

| ID | Scenario | Main API | Notes |
|----|----------|----------|--------|
| I1 | Login with bac + matricule | `STUDENT` login | Same enrollment rules as external |

### 4.3 Teacher

| ID | Scenario | Main API | Expected |
|----|----------|----------|----------|
| T1 | Login | `POST /auth/login` `TEACHER` | `sub` = `teachers.id` |
| T2 | List my formations | `GET /teachers/me/formations` | Paginated |
| T3 | Formation detail | `GET /teachers/me/formations/:id` | 200 / 404 |
| T4 | Not my formation | Guard | 403 |
| T5 | Calendar preview | `GET /teachers/me/calendar` | `{ data }` no enrollments |
| T6 | Roster | `GET /teachers/me/formations/:id/enrollments` | Paginated |
| T7 | Teacher dashboard | `GET /dashboard/teacher` | Stats + lists |

### 4.4 Admin

| ID | Scenario | Main API | Expected |
|----|----------|----------|----------|
| A1 | Create teacher | `POST /teachers` | 201; no password in body response |
| A2 | Duplicate teacher email | `POST /teachers` | 409 |
| A3 | Assign teacher | `POST /teachers/:tid/formations/:fid` | 201 / 409 overlap |
| A4 | Assign undated sibling exists | Another formation missing dates | 400 |
| A5 | Patch formation dates conflict | `PATCH /formations/:id` | 409 |
| A6 | List enrollments (global) | `GET /enrollments` | ADMIN |
| A7 | Admin dashboard | `GET /dashboard/admin/stats` etc. | See admin-dashboard doc |

### 4.5 Cross-cutting

| ID | Scenario | Outcome |
|----|----------|---------|
| X1 | Missing / invalid JWT | 401 |
| X2 | Wrong role for route | 403 |

---

## 5. E2E-style behaviour (integration mental model)

1. **Migrate** DB → **seed** academic data → **login** admin → create optional extra teacher or formation → assign with overlap attempt → expect **409**.
2. **Login** teacher → **calendar** `from`/`to` window → list **formations** → open **enrollments** for one `formationId`.
3. **Login** learner → **enroll** → **me** → **dashboard/student**.
4. **Login** admin → **enrollments** list → **certificates** where implemented.

Automated E2E tests are project-specific; this describes observable API behaviour for manual or contract tests.

---

## 6. Academic seed (integration dataset)

### 6.1 Entrypoint

- **Command:** `npm run db:seed` → `ts-node src/db/seed.ts` → **`runAcademicSeed()`** in `src/db/seeds/index.ts`.  
- **Developer reference:** `src/db/seeds/README.md` (pipeline, FK order, capacity rules).

### 6.2 Modules (execution order)

| Step | File | Action |
|------|------|--------|
| 1 | `seed.languages-levels.ts` | Upsert 5 languages × 6 levels (CEFR-style). |
| 2 | `seed.admin.ts` | Upsert **one** admin: `admin@ceil-academic.seed`. |
| 3 | `seed.teachers.ts` | Upsert **10** teachers: `teacher.01@ceil-academic.seed` … `teacher.10@…`. |
| 4 | `seed.rooms.ts` | Upsert **5** rooms: `SALLE-01`, `SALLE-02`, `SALLE-03`, `LAB-01`, **`SALLE-MAINT`** (inactive). |
| 5 | `seed.formations.ts` | Upsert **20** formations titled `CEIL Academic Formation 01` … `20`, **capacity 20** (fits all rooms), stable date windows (see below), assign **two per teacher** in order. |
| 6 | `seed.formation-sessions.ts` | Up to **4** `formation_sessions` per formation (SCHEDULED); rooms chosen so `room.capacity >= formation.capacity`; skip formation if it already has sessions. |
| 7 | `seed.learners.ts` | Upsert **20** external learners: `learner.01@ceil-academic.seed` … `learner.20@…`. |
| 8 | `seed.enrollments.ts` | **One** `ENROLLED` row per learner: learner *i* → formation *i* (1:1 index mapping). |
| 9 | `seed.session-attendance.ts` | Demo marks: first **3** formations, first **2** sessions each, all enrolled learners; statuses cycle PRESENT / ABSENT / LATE / EXCUSED; idempotent on `(session_id, enrollment_id)`. |
| 10 | `seed.certificates.ts` | One certificate per **ENROLLED** enrollment whose formation title matches `CEIL Academic Formation%` (**excludes** `CEIL Academic Demo%` demo titles). |
| 11 | `seed.demo-academic-scenarios.ts` | **Feature-complete academic demos:** closed-sale formation; internal student (`STUDENT` login); extra **CANCELLED** / **COMPLETED** sessions on Formation 01; **ASSISTANT** on Formation 01; cancelled-enrollment cohort + `learner.demo.annule@…`. |

**Password (all seed accounts):** `Password123` (see JSON summary line `seedPassword` on stdout).

### 6.3 Schedule invariants (no teacher overlap)

- Base: `2026-09-01T08:00:00.000Z`.
- Teacher index `t` (0–9): first session starts `base + 90t` days, 30-day duration; second session starts `base + 90t + 45` days, 30-day duration (**15-day gap** between sessions).
- Formations `2t` and `2t+1` belong to teacher `t`.
- **Different teachers** can occupy different timeline blocks; gaps avoid cross-formation overlap for the 20 cohort titles.

### 6.4 Learner / formation pairing (no learner overlap)

- Each learner has **exactly one** active enrollment in this seed, mapped to **one** formation time window — trivially **no overlapping courses per learner**.

### 6.5 Idempotency

- Languages, levels, admin, teachers, learners: **upsert** by natural keys.
- Formations: **find by exact title** before insert.
- Assignments: skip if `(formation_id, teacher_id)` already exists.
- Rooms: idempotent by **`code`**.
- Sessions: skip entire formation if it already has **any** session row.
- Enrollments / certificates / attendance: skip if row already present.

Re-running seed on the same DB **augments** missing pieces; it does **not** wipe data. For a clean slate use `npm run db:reset` (destructive) then migrate + seed.

**Note:** Formations are matched by **title**. If a formation title already exists, its **start/end dates are not updated** on re-run; only missing `formation_teachers` / enrollments may be added.

### 6.6 Login cheatsheet (stdout JSON mirrors this)

| Actor | loginType | Identifier |
|-------|-----------|------------|
| Admin | `EMAIL` | `admin@ceil-academic.seed` |
| Teacher | `TEACHER` | `teacher.NN@ceil-academic.seed` |
| Learner | `EMAIL` | `learner.NN@ceil-academic.seed` |
| Internal learner (I1) | `STUDENT` | `bacYear` **2023**, `matricule` **INT-CEIL-2023-001** |
| Demo annulation | `EMAIL` | `learner.demo.annule@ceil-academic.seed` |

**Demo formations:** `CEIL Academic Demo — Inscriptions fermées` (sale closed); `CEIL Academic Demo — Cohort annulée` (cancelled enrollment + scheduled séance for teacher views).

After the academic seed, use **`npm run db:seed:same-day`** to add many formations on **one UTC day** (default **2026-05-15**), spaced so teacher **overlap rules still pass** (60-minute blocks with 15-minute gaps). By default they attach to **`teacher.01@ceil-academic.seed`**. Override with env: **`SAME_DAY_TEACHER_EMAIL`**, **`SAME_DAY_SLOT_COUNT`** (the script caps count at 24 for sanity). To see them in **`GET /teachers/me/calendar`**, the requested `from`/`to` window must include that date — calendar events are **session-based**; this script does not create `formation_sessions` (only short formation date ranges).

---

## 7. Related documentation

- [`TEST_ARCHITECTURE_AND_ACADEMIC_DATA_PIPELINE.md`](TEST_ARCHITECTURE_AND_ACADEMIC_DATA_PIPELINE.md) — E2E test DB, migrations, seed vs tests
- [`enseignant-api-llm-spec.md`](enseignant-api-llm-spec.md)
- [`teacher-enrollments-api-enhancement.md`](teacher-enrollments-api-enhancement.md)
- [`formations-api.md`](formations-api.md)
- [`teachers-entity-migration.md`](teachers-entity-migration.md)

---

*UBMA CEIL — consolidated business/use-case + academic seed reference.*
