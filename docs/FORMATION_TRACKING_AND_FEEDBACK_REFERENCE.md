# Formation Tracking + Feedback — canonical reference

**Single source of truth** for DTOs, HTTP APIs, DB, rules, tests, and implementation summary.  
Feature name: **Formation Tracking + Feedback** (not “attempts”). **Attendance/séances** are the participation model; **exam/quiz attempts** are out of scope.

---

## Teacher lens: “courses” and “students”

| Product term | Backend |
|--------------|---------|
| **Course** / cohort | `formation` |
| **Student** / learner | `users` with role `APPRENANT`, linked via `enrollments` |
| **Schedule** | `formation_sessions` (séances) |
| **Roster + marks** | `GET/PATCH .../sessions/:sessionId/attendance` (only `ENROLLED` learners) |
| **Class overview** | `GET /teachers/me/formations/:formationId` + `.../tracking` |
| **Who is in my class** | `GET /teachers/me/formations/:formationId/enrollments` (includes per-row `attendanceSummary`) |

Access is always gated by **`formation_teachers`**: a teacher only sees formations they are assigned to (`TeacherFormationAccessGuard` or equivalent checks in services).

---

## 1. What already existed (pre-work)

- `GET /teachers/me/formations`, `GET .../:formationId`, `.../:formationId/sessions`, `.../:formationId/enrollments`, `.../:formationId/certificates`
- `GET` / `PATCH /teachers/me/sessions/:sessionId/attendance`
- Teacher formation access via `formation_teachers`
- Batched **attendance summary** on teacher formation enrollments list
- `GET /dashboard/admin/top-formations`, `GET .../top-teachers`
- No `formation_feedback` table; no public “top learners by attendance” endpoint

---

## 2. Files touched (inventory)

- **DB:** `src/db/schema.ts`, `drizzle/0001_fancy_kate_bishop.sql`, `drizzle/meta/_journal.json`
- **Insights module:** `src/lib/formation-insights/formation-insights.module.ts`, `certificate-readiness.util.ts`
- **Repos:** `src/lib/repositories/formation-feedback/formation-feedback.repository.ts`, `formation-tracking/formation-tracking.repository.ts`
- **Enrollments repo:** `ENROLLED`-only `countEnrollmentsInFormation`, `findFormationEnrollmentsWithStudents`, `findIssuedCertificateEnrollmentIds`, attendance summaries join excluding cancelled sessions
- **Teachers:** `teacher-formation-tracking.service.ts`, `teachers.service.ts` (detail + teacher feedback read), `teachers-me.controller.ts`, `teachers.module.ts`
- **Formations:** `formation-feedback.service.ts`, `dto/upsert-formation-feedback.dto.ts`, `formations.controller.ts`, `formations.service.ts` (`GET .../tracking` authz), `formations.module.ts`
- **Dashboard:** `dashboard.repository.ts`, `dashboard.service.ts`, `dashboard.controller.ts`, `dashboard.module.ts`, `dto/top-formation.dto.ts`, `dto/top-learner.dto.ts`
- **Tests:** `test/formation-tracking-feedback.e2e-spec.ts`, `test/utils/test-db.ts`
- **Docs:** this file; see also `docs/admin-dashboard-api.md` (dashboard deltas)

---

## 3. Database

- **Table:** `formation_feedback`
- **Columns:** `id`, `formation_id`, `student_id`, `enrollment_id` (nullable), `rating` (0–5), `comment`, `created_at`, `updated_at`
- **Constraints:** `UNIQUE (formation_id, student_id)`; `CHECK (rating >= 0 AND rating <= 5)`

---

## 4. DTOs / types

| Name | Location |
|------|----------|
| `UpsertFormationFeedbackDto` | `src/modules/formations/dto/upsert-formation-feedback.dto.ts` |
| `TopLearnerDto` | `src/modules/dashboard/dto/top-learner.dto.ts` |
| `TopFormationDto` (extended) | `src/modules/dashboard/dto/top-formation.dto.ts` |
| `CertificateReadiness` (informational) | `src/lib/formation-insights/certificate-readiness.util.ts` |

*Note:* Full response types for tracking/analytics are built in services (Swagger can be extended later with dedicated response DTO classes).

---

## 5. New APIs

| Method | Path | Auth | Purpose |
|--------|------|------|--------|
| `PUT` | `/api/v1/formations/:id/feedback` | `APPRENANT` | Upsert own feedback (spec also mentioned POST/PATCH; **PUT is the implemented upsert**) |
| `GET` | `/api/v1/formations/:id/feedback/me` | `APPRENANT` | Read own feedback |
| `GET` | `/api/v1/formations/:id/feedback` | `ADMIN` | Paginated list + aggregate + learner fields |
| `GET` | `/api/v1/formations/:id/tracking` | `ADMIN` or assigned `ENSEIGNANT` | Pie analytics + summary |
| `GET` | `/api/v1/teachers/me/formations/:formationId/tracking` | `ENSEIGNANT` | Full tracking payload for one formation |
| `GET` | `/api/v1/teachers/me/formations/:formationId/feedback` | `ENSEIGNANT` | Aggregate + paginated comments |
| `GET` | `/api/v1/dashboard/admin/top-learners` | `ADMIN` | Top learners by **attendance/completion**, not grades |

---

## 6. Updated APIs

| Endpoint | Change |
|----------|--------|
| `GET /api/v1/teachers/me/formations/:formationId` | Structured JSON: `enrolledCount`, `sessionsSummary` (counts + `nextSession`), `teacherRole`, ISO dates — **breaking** vs old raw row |
| `GET /api/v1/dashboard/admin/top-formations` | Adds `averageRating`, `ratingCount`, `averageAttendanceRate`, `totalSessionsCount`, `certificateReadyCount` (backward-compatible extra fields) |
| `PATCH .../sessions/:sessionId/attendance` | Validates only **`ENROLLED`** enrollments belong to formation |

---

## 7. Business rules

- **Attendance rate (per learner):** `PRESENT` only ÷ count of **non-`CANCELLED`** sessions × 100; `0` if no such sessions.
- **`LATE`:** counted separately; **not** included in `presentCount` / rate.
- **Unmarked:** slots = `totalSessions ×` relevant learners; unmarked = slots minus explicit marks (for rollups).
- **Summaries:** attendance status counts ignore rows on **cancelled** sessions.
- **Feedback:** one row per `(formation, student)`; learner must be **`ENROLLED`**.
- **Feedback after formation end:** not required; allowed once enrolled (documented default).
- **Certificate readiness** in tracking: **informational only**; generation rules unchanged.

---

## 8. Dashboard

- **Top formations:** enrollment success plus **ratings**, **mean attendance**, **session count**, **certificate-ready hint** (ended, no cert).
- **Top learners:** rank by **average attendance** across ENROLLED enrollments, then **completed formations** (ended), then **certificates count** — label as engagement/completion, not “grades”.

---

## 9. Tests

- **File:** `test/formation-tracking-feedback.e2e-spec.ts`
- **Coverage (15 cases):** feedback enrolled/unenrolled, rating bounds & upsert, teacher tracking + feedback (assigned vs not), admin list + pies, teacher `GET /formations/:id/tracking`, pie percentages, top formations/learners, **cancelled sessions excluded**, **`LATE` ≠ present**, **unmarked** rate, etc.
- **Commands:**

```bash
npm run build
npm run db:migrate
npm run db:seed
npm run db:seed:tracking-feedback
npm run test:e2e -- --testPathPatterns=formation-tracking-feedback
```

*(Use host environment without sandbox if Jest/Watchman fails.)*

---

## 10. Remaining gaps / TODO

- Certificate **eligibility** is not enforced; helper is informational.
- **Exam/quiz attempts** — not implemented (separate future module).
- **`GET /dashboard/admin/top-learners`** — **new** endpoint.
- **Feedback moderation** — not implemented.
- **POST/PATCH** `/formations/:id/feedback` — not added; **PUT** covers upsert.

---

## Quick route map (teacher workflow)

1. List my courses: `GET /teachers/me/formations`
2. Course detail + session counts: `GET /teachers/me/formations/:formationId`
3. Students roster + attendance summary: `GET /teachers/me/formations/:formationId/enrollments`
4. Session list: `GET /teachers/me/formations/:formationId/sessions`
5. Mark attendance: `PATCH /teachers/me/sessions/:sessionId/attendance`
6. Full tracking + feedback summary: `GET .../tracking`, `GET .../feedback`

---

## Related split docs (pointers)

- Charts / pies: `docs/formation-tracking-api.md`
- Learner/admin feedback: `docs/formation-feedback-api.md`
- Teacher-only routes: `docs/teacher-tracking-api.md`
- Admin dashboard deltas: `docs/admin-dashboard-api.md` (§ top-formations / top-learners)
