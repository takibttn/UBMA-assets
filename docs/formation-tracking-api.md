# Formation tracking API (analytics / pies)

Canonical detail: **[FORMATION_TRACKING_AND_FEEDBACK_REFERENCE.md](./FORMATION_TRACKING_AND_FEEDBACK_REFERENCE.md)**

## Endpoint

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/v1/formations/:id/tracking` | `ADMIN`, or `ENSEIGNANT` if assigned to the formation |

## Response (conceptual)

- `attendancePie` — `PRESENT` | `ABSENT` | `LATE` | `EXCUSED` | `UNMARKED` (denominator: non-cancelled sessions × enrolled; cancelled sessions excluded from attendance slot logic)
- `sessionStatusPie` — `SCHEDULED` | `COMPLETED` | `CANCELLED` (includes cancelled)
- `enrollmentStatusPie` — `ENROLLED` | `CANCELLED`
- `ratingPie` — `0`..`5`
- `summary` — `averageAttendanceRate`, `averageRating`, `ratingCount`, `totalLearners`, `totalSessions`

Percentages: integer rounded; if total for a pie is `0`, all percentages are `0`.
