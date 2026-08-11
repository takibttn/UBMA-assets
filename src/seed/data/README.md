# CEIL academic seed — architecture

## Entry

- **`npm run db:seed`** → `src/db/seed.ts` → `runAcademicSeed()` in `src/db/seeds/index.ts`.

Other scripts:

- **`npm run db:seed:same-day`** — dense same-calendar-day formations (`seed.same-day-formations.ts`). Run **after** main seed. Does **not** create `formation_sessions` or rooms; use for assignment-overlap demos only.
- **`npm run db:seed:tracking-feedback`** — inserts `formation_feedback` for existing **ENROLLED** enrollments only (`src/db/seed-tracking-feedback.ts`). Run after `db:migrate` if table was added later; idempotent.

## Context (`context.ts`)

- **`AcademicSeedContext`**: PostgreSQL `pool`, **`db`** (`drizzle-orm` with **`src/db/schema`** for typed queries), shared **`hashedPassword`**, **`counters`** (`types.ts`).
- Helpers: `addDays`, `addHours`, certificate id builders.

## Pipeline (order matters)

| Phase | Module | Purpose |
|-------|--------|---------|
| 1 | `seed.languages-levels` | Languages + levels (formations FK) |
| 2 | `seed.admin`, `seed.teachers` | `users` (ADMIN), `teachers` |
| 3 | `seed.rooms` | `rooms` (SALLE-01…03, LAB-01, **SALLE-PETITE** cap.18 for `INSUFFICIENT_CAPACITY` demos, **SALLE-MAINT** inactive); idempotent by `code` |
| 4 | `seed.formations` | 20 `formations` + `formation_teachers` · non-overlapping teacher windows |
| 5 | `seed.formation-sessions` | `formation_sessions` · `room.capacity >= formation.capacity` · 4 sessions/formation |
| 6 | `seed.learners`, `seed.enrollments` | 20 external learners · 1:1 ENROLLED to formation index |
| 7 | `seed.session-attendance` | Demo `session_attendance` (first 3 formations, 2 sessions each) |
| 8 | `seed.certificates` | One certificate per ENROLLED row on `CEIL Academic Formation%` titles only |
| 9 | `seed.demo-academic-scenarios` | Closed-sale formation, internal student, **CANCELLED**/**COMPLETED** sessions on F01, **ASSISTANT** on F01, cancelled-enrollment cohort + demo learner · **`CEIL Academic Demo — Calendrier salle hebdo`** (fixed 2026 window + monday sessions for `POST /rooms/availability-for-weekly-slot`) |
| 10 | `seed.formation-feedback` | **`formation_feedback`** linked to `enrollments` / `users` / `formations` (≤5 earliest ENROLLED per formation); idempotent on `(formation_id, student_id)` |

## Data logic rules

1. **Formation capacity vs rooms**  
   Academic formations use **capacity 20** so default seeded rooms (min **LAB-01** = 20) satisfy “room ≥ formation capacity”. **SALLE-PETITE** (18) stays for **INSUFFICIENT_CAPACITY** in room weekly availability. Session seed picks only **active** rooms with sufficient capacity.

2. **Sessions**  
   Idempotent: if a formation already has any session row, skip that formation (safe re-runs).

3. **Enrollments**  
   Learner *i* → `formationIds[i]` · requires equal lengths (20/20).

4. **Attendance demo**  
   Idempotent on `(sessionId, enrollmentId)`. Uses assigned teacher as `markedByTeacherId`. Only **SCHEDULED** sessions in the first two slots are used.

5. **Counters**  
   Upsert paths may increment even when row already existed (learners/teachers); treat as “operations”, not strict “rows created”.

6. **Demo scenarios (phase 9)**  
   Rows with titles `CEIL Academic Demo…` extend use-case coverage (closed sale, internal student, mixed session statuses, `ASSISTANT`, cancelled enrollment) without polluting the main certificate batch. **Calendrier salle hebdo**: use formation id with `dayOfWeek: 1`, `startTime`/`endTime` `10:00`/`12:00` → **SALLE-01** `OCCUPIED`, **SALLE-02** `AVAILABLE` (overlapping session is `CANCELLED`). See `docs/TEST_ARCHITECTURE_AND_ACADEMIC_DATA_PIPELINE.md` and `docs/room-weekly-availability-implementation.md`.

7. **Formation feedback (phase 10)**  
   Inserts `formation_feedback` for existing `ENROLLED` enrollments (max 5 earliest per formation by `enrolled_at`). Skips when `(formation_id, student_id)` already exists. Ratings cycle 0–5 with sample French comments. Runs after phase 9 so demo cohorts receive rows too.

## Adding features

- New tables: add a `seed.*.ts`, extend `SeedCounters`, register in `index.ts` after its FK prerequisites.
- To resize formations: keep `capacity` ≤ smallest room you assign, or filter rooms in `seed.formation-sessions.ts`.
- **Tracking / feedback only:** `npm run db:seed:tracking-feedback` (requires `formation_feedback` migration + existing enrollments).
