# UBMA CEIL — Academic scheduling & attendance implementation report

**Date:** 2026-05-01  
**Stack:** NestJS, Drizzle ORM, PostgreSQL, JWT, Swagger, class-validator.  
**Scope:** Rooms, formation sessions (séances), **weekly-slot preview/generate**, schedule conflicts (incl. batch probe check), session-based teacher calendar, formation-scoped teacher sessions, `nextSession` on teacher formations, `session_attendance`, attendance summaries on enrollment APIs, seeds, docs.

---

## 1. Changed files (summary)

### Database & migration

- `src/db/schema.ts` — `rooms`, `formation_sessions`, `session_attendance`; enums `session_status`, `attendance_status`; indexes; relations.
- `drizzle/0001_furry_dark_beast.sql` — migration for the above.
- `drizzle/meta/_journal.json`, `drizzle/meta/0001_snapshot.json`
- `src/db/seeds/index.ts` — orchestrates `seedRooms`, `seedFormationSessions`.
- `src/db/seeds/types.ts` — `roomsInserted`, `formationSessionsInserted` counters.
- `src/db/seeds/seed.rooms.ts` — **new**
- `src/db/seeds/seed.formation-sessions.ts` — **new**

### Scheduling

- `src/lib/scheduling/schedule-conflict.types.ts` — `SessionGenerationProbe`
- `src/lib/scheduling/schedule-conflict.service.ts` — `checkGenerationProbesAgainstDb`
- `src/lib/scheduling/scheduling.module.ts`

### Repositories

- `src/lib/repositories/rooms/rooms.repository.ts` — `findManyByIds`
- `src/lib/repositories/formation-sessions/formation-sessions.repository.ts`
- `src/lib/repositories/session-attendance/session-attendance.repository.ts`
- `src/lib/repositories/enrollments/enrollments.repository.ts` — batch attendance summaries, `countEnrollmentsInFormation`

### Rooms module

- `src/modules/rooms/` — controller, service, module, DTOs

### Formations / sessions

- `src/modules/formations/formations.controller.ts` — `POST /formations/with-sessions`
- `src/modules/formations/formations.service.ts` — `createFormationWithSessions` (transaction)
- `src/modules/formations/formations.module.ts` — `FormationSessionGenerationService`; imports `TeachersModule` (assignments only, no cycle)
- `src/modules/formations/formation-sessions.controller.ts` — **preview / generate** routes ordered before `POST .../sessions`
- `src/modules/formations/formation-sessions.service.ts`
- `src/modules/formations/formation-session-generation.service.ts` — **new**
- `src/modules/formations/formation-session-generation.util.ts` — **new** (UTC weekly expansion)
- `src/modules/formations/formation-session-validation.util.ts`
- `src/modules/formations/dto/generate-formation-sessions.dto.ts` — **new**
- `src/modules/formations/dto/generated-sessions-preview-response.dto.ts` — **new**
- `src/modules/formations/dto/generate-sessions-response.dto.ts` — **new**
- `src/modules/formations/dto/create-formation-session.dto.ts`
- `src/modules/formations/dto/update-formation-session.dto.ts`
- `src/modules/formations/dto/create-formation-with-sessions.dto.ts`

### Teachers

- `src/modules/teachers/teachers.repository.ts` — `findTeacherCalendarEvents`, `findTeacherFormationSessions`, `findNextSessionsByFormationIds`
- `src/modules/teachers/teachers.service.ts` — calendar + formation sessions mapping (`SESSION`); removed `FormationsModule` circular dependency
- `src/modules/teachers/teachers-me.controller.ts`
- `src/modules/teachers/teachers.module.ts` — imports `EnrollmentsModule` only (no `FormationsModule`)
- `src/modules/teachers/dto/find-teacher-formation-sessions-query.dto.ts` — **new**
- `src/modules/teachers/session-attendance.service.ts`
- `src/modules/teachers/dto/update-session-attendance.dto.ts`

### Enrollments

- `src/modules/enrollments/enrollments.service.ts` — `attendanceSummary` on profile, admin, teacher, legacy `me`

### App

- `src/app.module.ts` — registers `RoomsModule`

### Docs

- `docs/formation-session-generation-api.md` — **new** (preview vs generate, algorithm, UTC note)
- `docs/teacher-calendar-api.md` — SESSION calendar + formation-scoped sessions
- `docs/formation-scheduling-and-attendance-api.md` — pointer to generation doc
- `docs/platform-master-reference.md` — sessions + teacher routes
- **This file:** `docs/IMPLEMENTATION_REPORT.md`

---

## 2. New DB tables & enums

| Name | Notes |
|------|--------|
| `rooms` | `id`, `code` (unique), `name`, `capacity`, `isActive`, timestamps |
| `formation_sessions` | FK `formationId` → `formations` (cascade), `roomId` → `rooms` (restrict), `title`, `description`, `startAt`, `endAt`, `status`, `createdById` |
| `session_attendance` | FK `sessionId`, `enrollmentId`; unique `(sessionId, enrollmentId)`; `status`, `markedAt`, `markedByTeacherId` |
| Enum `session_status` | `SCHEDULED`, `CANCELLED`, `COMPLETED` |
| Enum `attendance_status` | `PRESENT`, `ABSENT`, `LATE`, `EXCUSED` |

Indexes (high level): `formation_sessions` by `formationId`, `roomId`, `startAt`, `status`, composite room/time; `session_attendance` by `sessionId`, `enrollmentId`; `formation_teachers` by `teacherId` / `formationId` (from schema).

---

## 3. New / changed endpoints

### Admin — rooms (`UserRole.ADMIN`)

| Method | Path |
|--------|------|
| POST | `/rooms` |
| GET | `/rooms` |
| GET | `/rooms/:id` |
| PATCH | `/rooms/:id` |
| DELETE | `/rooms/:id` |

Delete blocked if any session references the room (prefer deactivate).

### Admin — formation sessions

| Method | Path |
|--------|------|
| POST | `/formations/:formationId/sessions/preview` |
| POST | `/formations/:formationId/sessions/generate` |
| POST | `/formations/:formationId/sessions` |
| GET | `/formations/:formationId/sessions` |
| GET | `/formations/:formationId/sessions/:sessionId` |
| PATCH | `/formations/:formationId/sessions/:sessionId` |
| DELETE | `/formations/:formationId/sessions/:sessionId` |

### Admin — create formation with sessions

| Method | Path |
|--------|------|
| POST | `/formations/with-sessions` |

`POST /formations` unchanged.

### Teacher (`UserRole.ENSEIGNANT`, JWT `sub` = `teachers.id`)

| Method | Path |
|--------|------|
| GET | `/teachers/me/calendar` — **breaking:** returns `type: "SESSION"` events (no longer FORMATION date span) |
| GET | `/teachers/me/formations` — each row includes `nextSession` or `null` |
| GET | `/teachers/me/formations/:formationId/sessions` — read-only **SESSION** list; optional `from` / `to` / `search` (same as calendar) |
| GET | `/teachers/me/sessions/:sessionId/attendance` |
| PATCH | `/teachers/me/sessions/:sessionId/attendance` |

Enrollment / certificate routes kept; enrollments gain `attendanceSummary` on list/detail responses where implemented below.

---

## 4. DTOs added / changed

- **Session generation:** `GenerateFormationSessionsDto`, `WeeklySessionSlotDto`; Swagger preview/response DTO classes under `dto/generated-sessions-preview-response.dto.ts`, `dto/generate-sessions-response.dto.ts`.
- **Rooms:** `CreateRoomDto`, `UpdateRoomDto`, `FindRoomsQueryDto` (aligned with spec: search code/name, `isActive`, pagination).
- **Sessions:** `CreateFormationSessionDto`, `UpdateFormationSessionDto`, `CreateFormationWithSessionsDto`.
- **Attendance:** `UpdateSessionAttendanceDto` (`records[]` with `enrollmentId`, `status`).
- **Responses:** session payloads include nested `room`, `formation` (title + language + level), `enrolledCount`, optional `attendanceSummary` (admin session list/detail).

---

## 5. Conflict rules (`ScheduleConflictService`)

Overlap rule: `existing.startAt < newEndAt && existing.endAt > newStartAt` (touching boundaries allowed).

1. **Room:** same `roomId`, status ≠ `CANCELLED`, overlap, optional `excludeSessionId` on update.
2. **Same formation:** same `formationId`, status ≠ `CANCELLED`, overlap, exclude current session on update.
3. **Teacher:** teachers from `formation_teachers` for the **target** formation; any session (any formation) assigned to those teachers via `formation_teachers`, status ≠ `CANCELLED`, overlap, exclude current session on update.

On failure: `ConflictException` body shape  
`{ message: "Schedule conflict detected", roomConflicts, teacherConflicts, formationConflicts }`.

Payload-internal overlaps for `POST /formations/with-sessions` use `assertNoInternalSessionOverlaps` (pairwise).

**Bulk generate:** internal candidate overlaps + `checkGenerationProbesAgainstDb` (three queries over the candidate time window). **`POST .../generate` 409** adds **`candidateConflicts`** (per `tempId`) to the manual conflict body.

Session validation (shared util): room active when set; `startAt` &lt; `endAt`; max duration 6h; session inside formation `startDate`/`endDate` when present; room capacity ≥ formation capacity when formation capacity set; default title `"{formation.title} - Séance"`.

---

## 6. Teacher calendar migration

- **Before:** `GET /teachers/me/calendar` — `type: "FORMATION"`, `id` = `formation_teachers.id`, `startsAt`/`endsAt` = formation dates, `status` OPEN/CLOSED from sale.
- **After:** `type: "SESSION"`, `id`/`sessionId` = `formation_sessions.id`, `startsAt`/`endsAt` = session window, `status` = `SCHEDULED` \| `CANCELLED` \| `COMPLETED`, includes `room { id, code, name }`, language/level from formation, `enrolledCount`, `capacity`, `spotsRemaining`.

Query filters: optional `from` / `to` on session time range; `search` on session title, formation title, language/level code/name, room code/name. Sort: `startAt` ASC.

---

## 7. Teacher formations `nextSession`

For each formation in `GET /teachers/me/formations` **page data**:
- Earliest session with `status != CANCELLED` and `startAt >= now`, ordered by `startAt`.
- Shape: `{ id, startAt, endAt, roomCode } | null`.

---

## 8. Attendance API

- **GET** … `/teachers/me/sessions/:sessionId/attendance`  
  All **ENROLLED** learners for the session’s formation; left join attendance for that session.  
  Row: `enrollmentId`, `student`, `attendance: { id, status, markedAt }` (nulls if unmarked).

- **PATCH** same path, body `records: [{ enrollmentId, status }]`  
  Teacher must be assigned to the formation; every `enrollmentId` must belong to that formation; upsert on `(sessionId, enrollmentId)`; sets `markedByTeacherId`, `markedAt`.

---

## 9. Enrollment `attendanceSummary`

Shape:

```ts
{
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  unmarkedCount: number;    // max(0, totalSessionsCount - sum of marked)
  totalSessionsCount: number; // non-CANCELLED sessions for formation
  attendanceRate: number;    // totalSessionsCount > 0 ? round(presentCount/total*100) : 0
}
```

**Late ≠ present.** Unmarked ≠ absent.

**Attached (batched, no N+1 on lists):**

1. `GET /enrollments/me/profile` (cards + `nextFormation`)
2. `GET /enrollments/me` (legacy list)
3. `GET /enrollments` (admin)
4. `GET /enrollments/formation/:formationId`
5. `GET /enrollments/teacher` (+ `GET .../teacher/:enrollmentId`)
6. `GET /teachers/me/formations/:formationId/enrollments`

---

## 10. Seeds

- `seed.rooms.ts` — `SALLE-01` (25), `SALLE-02` (25), `SALLE-03` (30), `LAB-01` (20); idempotent by `code`.
- `seed.formation-sessions.ts` — for each academic formation with no sessions yet, inserts up to four SCHEDULED sessions inside `[startDate, endDate]`, rotating rooms; skips if sessions already exist.
- Optional demo attendance seed: **not** included (can be added later).

---

## 11. Documentation

- **`docs/teacher-calendar-api.md`** — aligned with SESSION calendar and response fields.
- **`docs/formation-scheduling-and-attendance-api.md`** — planning / consolidated notes (if tracked).
- **`docs/platform-master-reference.md`** — update if present in repo.
- Per original spec, you may still add narrow files (`rooms-api.md`, `formation-sessions-api.md`, `attendance-api.md`, `enrollments-api.md`, `learner-profile-api.md`); this report is the single consolidated delivery checklist.

**Frontend notes**

- **Admin:** rooms CRUD; formation session CRUD; **`POST /formations/:id/sessions/preview` / `generate`**; `POST /formations/with-sessions`; parse structured `ConflictException` payload (incl. `candidateConflicts` on generate).
- **Teacher:** calendar uses sessions; formations list shows `nextSession.roomCode`; attendance bulk save.
- **Apprenant:** enrollments remain formation-scoped; profile cards can show `attendanceSummary`; no attendance writes.

---

## 12. Build result

```text
npm run build
```

**Result:** succeeds (Nest compile completed with exit code 0).

---

## 13. Backward compatibility

- **Breaking (acceptable per spec):** `GET /teachers/me/calendar` response shape (`FORMATION` → `SESSION`).
- **Preserved:** `POST /formations`, enrollments creation, certificates linked to enrollments, `formation_teachers` model.

---

## 14. Follow-ups (optional)

- Add focused OpenAPI DTO classes for session/attendance responses if the client needs stricter Swagger models.
- Optional `POST /rooms/available` (time + capacity window) for admin room picking.
- Optional `GET /teachers/me/calendar/sessions` alias (not required; main route is session-based).
- Demo `seed.session-attendance.ts` for UI screenshots.
- Run `drizzle-kit migrate` (or project equivalent) against target PostgreSQL before relying on new tables in deployed environments.
