# Teacher formation tracking API

Canonical detail: **[FORMATION_TRACKING_AND_FEEDBACK_REFERENCE.md](./FORMATION_TRACKING_AND_FEEDBACK_REFERENCE.md)**

All routes require **`ENSEIGNANT`** JWT (`user.id` = `teachers.id`).

## Course (formation) context

| Method | Path | Guard |
|--------|------|--------|
| `GET` | `/api/v1/teachers/me/formations/:formationId` | Assigned only |
| `GET` | `/api/v1/teachers/me/formations/:formationId/sessions` | Assigned only |
| `GET` | `/api/v1/teachers/me/formations/:formationId/enrollments` | Assigned only (includes `attendanceSummary` per row) |
| `GET` | `/api/v1/teachers/me/formations/:formationId/certificates` | Assigned only |

## Tracking & feedback (read)

| Method | Path | Guard |
|--------|------|--------|
| `GET` | `/api/v1/teachers/me/formations/:formationId/tracking` | Assigned only |
| `GET` | `/api/v1/teachers/me/formations/:formationId/feedback` | Assigned only |

## Attendance (per séance)

| Method | Path |
|--------|------|
| `GET` | `/api/v1/teachers/me/sessions/:sessionId/attendance` |
| `PATCH` | `/api/v1/teachers/me/sessions/:sessionId/attendance` |

Teachers **cannot** create/update/delete sessions via these routes — attendance only.

## Shared analytics

Assigned teachers may also call `GET /api/v1/formations/:id/tracking` (same payload as admin pie endpoint).
