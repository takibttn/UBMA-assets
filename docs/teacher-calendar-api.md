# Teacher calendar API — UBMA CEIL

**Global prefix:** `/api/v1` · **Swagger:** `/docs`

Teacher-facing calendar APIs return **séances** (`formation_sessions`) for formations the teacher is assigned to via **`formation_teachers`**. There are **no** session-level enrollments and **no** per-session teacher links: teachers reach sessions through the formation.

---

## Endpoints (ENSEIGNANT)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/teachers/me/calendar` | **Global** calendar: all **SESSION** events across assigned formations. |
| `GET` | `/teachers/me/formations/:formationId/sessions` | **Formation-scoped** list: only sessions for that formation (`TeacherFormationAccessGuard`). Same filters as global calendar. |
| `GET` | `/teachers/me/formations/:formationId` | Formation detail (assignment must exist). |
| `GET` | `/teachers/me/formations/:formationId/enrollments` | Roster. |
| `GET` | `/teachers/me/sessions/:sessionId/attendance` | Attendance for one session. |
| `PATCH` | `/teachers/me/sessions/:sessionId/attendance` | Update attendance (teachers **cannot** create/edit/delete sessions). |

**ADMIN** may use `GET /teachers/:teacherId/calendar` with the same query semantics as `me/calendar`.

---

## Query: `FindTeacherCalendarQueryDto` / `FindTeacherFormationSessionsQueryDto`

**Files:**  
`src/modules/teachers/dto/find-teacher-calendar-query.dto.ts`  
`src/modules/teachers/dto/find-teacher-formation-sessions-query.dto.ts` (extends calendar DTO)

| Param | Description |
|-------|-------------|
| `from` | Optional. `YYYY-MM-DD` → UTC start of day, or full ISO datetime. |
| `to` | Optional. Plain date → UTC end of day `23:59:59.999Z`. |
| `search` | Optional. `ilike` on session title, formation title, language, level, room code/name. |

Validation: **`TeacherCalendarDateRangeConstraint`**; see `calendar-date-range.validator.ts` and `parseTeacherCalendarBoundary`.

---

## Session event shape (`type: "SESSION"`)

Returned under `{ data: [...] }` for both calendar and formation-scoped sessions.

```ts
type TeacherFormationSessionDto = {
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

`enrolledCount` counts **ENROLLED** learners on the formation. `spotsRemaining` is `capacity - enrolledCount` when `capacity` is set.

---

## Data source

| Method | Repository |
|--------|------------|
| Global calendar | `TeachersRepository.findTeacherCalendarEvents` |
| Formation sessions | `TeachersRepository.findTeacherFormationSessions` |

Both aggregate enrollments with `GROUP BY` session to avoid N+1 queries.

---

## Admin: automatic session generation

Séances can be bulk-created from weekly slots (formation must have `startDate` and `endDate`). See **`docs/formation-session-generation-api.md`**.

---

## Code map

| Piece | File |
|-------|------|
| DTOs | `find-teacher-calendar-query.dto.ts`, `find-teacher-formation-sessions-query.dto.ts` |
| Date parsing | `utils/teacher-calendar-query.util.ts` |
| Repository | `teachers.repository.ts` |
| Service | `teachers.service.ts` → `getTeacherCalendar`, `getTeacherFormationSessions` |
| Routes | `teachers-me.controller.ts` |

---

*UBMA CEIL — teacher session calendar (reference).*
