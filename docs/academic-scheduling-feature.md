# Academic scheduling & attendance — feature overview

This document describes the **latest scheduling domain** in UBMA CEIL API: how a **formation period** relates to **séances (sessions)**, **rooms**, **conflicts**, **teacher calendar**, and **attendance**.

For endpoint-level detail, see also:

- `docs/formation-scheduling-and-attendance-api.md`
- `docs/teacher-calendar-api.md`
- `docs/IMPLEMENTATION_REPORT.md` (changelog-style inventory)

---

## 1. Mental model

| Concept | Meaning |
|--------|---------|
| **Formation** | Course / programme. Learners **enrol on the formation**, not on a single séance. |
| **Formation period** | Optional window `startDate`–`endDate` on the formation: the **official run** of the programme. |
| **Séance (session)** | A **scheduled class occurrence**: exact `startAt`/`endAt`, one **room**, title, `SCHEDULED` / `CANCELLED` / `COMPLETED`. Many séances belong to **one** formation. |
| **Room** | Physical space. Each séance uses **one** room. Rooms are **not** stored on the formation row. |
| **Teacher link (v1)** | Teachers are assigned to **formations** via `formation_teachers`. They are **not** assigned per séance in v1. |
| **Attendance** | Per **(séance, enrolment)** row: was this learner present / absent / late / excused for **this** séance? |
| **Enrollment** | Still `(student, formation)`. Summaries aggregate attendance across **all non-cancelled** séances of that formation. |

**In one sentence:** a formation defines **who** learns and **roughly when** the programme runs; **séances** define **when and where** each class happens inside (or constrained by) that period.

---

## 2. How the period and séances relate

1. **Optional but recommended:** set `startDate` and `endDate` on the formation when you want the API to enforce that every new or updated séance’s `[startAt, endAt]` lies **inside** that range.
2. If both dates are set, creating/updating a séance **outside** the window is rejected.
3. Séance duration is capped (e.g. max **6 hours** per occurrence).
4. If the formation has a **capacity**, the chosen room’s **capacity must be ≥ formation capacity** (so the room can physically host the cohort).

Cancelled séances (`CANCELLED`) **do not** participate in **overlap / conflict** checks.

---

## 3. Rooms (admin)

- CRUD under **`/rooms`** (admin).
- Prefer **deactivating** a room (`isActive: false`) instead of deleting; delete may be blocked if sessions still reference the room.
- **Search** on list endpoints can match room **code** and **name**.

---

## 4. Séances — admin API

Base path pattern:

- `POST   /formations/:formationId/sessions`
- `GET   /formations/:formationId/sessions`
- `GET    /formations/:formationId/sessions/:sessionId`
- `PATCH  /formations/:formationId/sessions/:sessionId`
- `DELETE /formations/:formationId/sessions/:sessionId`

**Bulk create:** `POST /formations/with-sessions` creates a formation, assigns teachers, and inserts all séances in **one transaction**, with internal overlap checks and checks against the **existing** database.

Default title when omitted: **`{formation.title} - Séance`**.

---

## 5. Schedule conflicts (server-side)

Overlap rule (touching boundaries allowed, e.g. 09:00–11:00 then 11:00–13:00 is OK):

`existing.startAt < newEndAt && existing.endAt > newStartAt`

Three dimensions:

1. **Room** — same room, overlapping time, non-cancelled.
2. **Same formation** — two séances of the **same** cohort overlapping, non-cancelled.
3. **Teacher** — any teacher linked to the formation via `formation_teachers` must not be **double-booked** against another **non-cancelled** séance on **another** formation they also teach, if times overlap.

On failure, the API responds with a structured **409**-style conflict payload: `message`, `roomConflicts`, `teacherConflicts`, `formationConflicts` (see implementation for exact DTO).

---

## 6. Teacher experience

Identity: JWT **`sub`** is **`teachers.id`**, role **`ENSEIGNANT`**.

| Capability | Behaviour |
|------------|-----------|
| **Calendar** | `GET /teachers/me/calendar` returns **session-shaped** events (`type: SESSION`): séance id, times, room, formation context, language/level, status, enrolled count, capacity, spots remaining. **Breaking vs old:** no longer returns one block per formation date span. |
| **Formations list** | `GET /teachers/me/formations` includes **`nextSession`**: earliest **non-cancelled** séance with `startAt >= now` (id, start/end, `roomCode`), or `null`. |
| **Read‑only séances for a formation** | `GET /teachers/me/formations/:formationId/sessions` if the teacher is assigned to that formation. |
| **Attendance** | `GET` / `PATCH /teachers/me/sessions/:sessionId/attendance` — list learners (enrolled on the formation) with optional mark; bulk **upsert** by `(sessionId, enrollmentId)`. |

Teachers **do not** create or delete séances via these routes in v1 (admin-only session mutation).

---

## 7. Learner (apprenant) experience

- Enrolments remain **formation-based** (`POST /enrollments`, profile cards, etc.).
- **Attendance summary** on relevant enrollment responses, e.g.:

  - `presentCount`, `absentCount`, `lateCount`, `excusedCount`, `unmarkedCount`
  - `totalSessionsCount` = count of **non-cancelled** séances for that formation
  - `attendanceRate` = `presentCount / totalSessionsCount` (percent, 0 if no sessions)

**Late** counts separately from present. **Unmarked** is not treated as absent.

---

## 8. What v1 deliberately does **not** do

- No curriculum **modules** / units.
- No **session-level enrollments** (enrolment stays on formation).
- No **`roomId`** on the formation as source of truth (room is per séance).
- No **per-séance teacher assignment** in v1 (teacher comes from formation assignments).
- **Certificates** stay tied to **enrollments**, unchanged.

---

## 9. Seeds & local data

Academic seed creates rooms, formations, **formation_sessions** inside each formation window, enrollments, optional demo **session_attendance**, and certificates. See `src/db/seeds/README.md` and `docs/business-use-cases-and-seed.md` for order and idempotency.

---

## 10. Related code (orientation)

| Area | Location (indicative) |
|------|------------------------|
| Schema | `src/db/schema.ts` — `rooms`, `formation_sessions`, `session_attendance`, enums |
| Conflict logic | `src/lib/scheduling/schedule-conflict.service.ts` |
| Session validation | `src/modules/formations/formation-session-validation.util.ts` |
| Admin sessions | `src/modules/formations/formation-sessions.*` |
| Teacher calendar / next session | `src/modules/teachers/teachers.repository.ts`, `teachers.service.ts` |
| Attendance | `src/modules/teachers/session-attendance.service.ts`, `src/lib/repositories/session-attendance/` |
| Enrollment summaries | `src/lib/repositories/enrollments/enrollments.repository.ts`, `enrollments.service.ts` |

---

*UBMA CEIL — last major feature: formation period + many séances, rooms, conflicts, teacher calendar, attendance.*
