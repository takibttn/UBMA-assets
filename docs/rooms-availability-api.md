# Rooms availability API

ADMIN-only UX helpers for picking a **salle** before or while creating or editing a séance, and for weekly bulk generation. These endpoints **do not** replace server-side validation: **`POST` / `PATCH` formation sessions** and **`POST …/sessions/generate`** still run **`ScheduleConflictService`** and return **409** if the room (or teacher / same-formation overlap) conflicts at save time.

## When to use which endpoint

| Endpoint | Use case |
|----------|----------|
| **`POST /api/v1/rooms/availability`** | **Exact** `startAt` / `endAt` (ISO) for a **single** séance — manual create or edit in the session form. |
| **`POST /api/v1/rooms/availability-for-weekly-slot`** | **Recurring** weekday + `HH:mm` window over the formation period — same mental model as preview/generate **weekly slots**. |

Both return every room (unless `availableOnly` is used, exact endpoint only) with a **`status`**, optional **`conflicts`**, and a **`summary`** block.

---

## `POST /api/v1/rooms/availability`

**Auth:** Bearer, **ADMIN** only.

**Purpose:** For a given formation and **exact** interval, list rooms with availability classification so the UI can filter, sort, or badge rooms **before** submit.

### Request body

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `formationId` | UUID | yes | Formation must exist. |
| `startAt` | string (ISO 8601) | yes | Parseable datetime. |
| `endAt` | string (ISO 8601) | yes | Must be **after** `startAt`. |
| `excludeSessionId` | UUID | no | When **editing** a session, pass its id so its own booking is **ignored** for room conflicts. |
| `availableOnly` | boolean | no | Default **`false`**. If **`true`**, only rows with **`status: AVAILABLE`** are returned; **`summary`** counts match the returned list. |

### Validation (400 / 404)

- **404** if formation does not exist.
- **400** if `startAt >= endAt`, duration **> 6 hours**, or session window **outside** `formation.startDate` / `formation.endDate` when **both** are set (same rules as session CRUD via `assertSessionWindow`).
- Invalid ISO strings → **400**.

### Response shape

```json
{
  "data": [
    {
      "room": {
        "id": "uuid",
        "code": "SALLE-01",
        "name": "Amphi A",
        "capacity": 40,
        "isActive": true
      },
      "status": "AVAILABLE",
      "conflictCount": 0,
      "conflicts": []
    }
  ],
  "summary": {
    "totalRooms": 12,
    "availableCount": 5,
    "occupiedCount": 4,
    "insufficientCapacityCount": 2,
    "inactiveCount": 1
  }
}
```

### `status` values

Applied in this **order** (first match wins):

1. **`INACTIVE`** — `room.isActive === false`.
2. **`INSUFFICIENT_CAPACITY`** — formation has **`capacity`** and `room.capacity < formation.capacity`.
3. **`OCCUPIED`** — at least one **non-`CANCELLED`** session in that room overlaps the interval:  
   `existing.startAt < requested.endAt && existing.endAt > requested.startAt`  
   **Back-to-back** is **not** a conflict (`existing.endAt === requested.startAt` → **AVAILABLE** if nothing else applies).
4. **`AVAILABLE`** — otherwise.

**`excludeSessionId`:** that session is omitted from the overlap query so **edit** flows do not show a false **OCCUPIED** for the current row.

**`conflicts`:** for **OCCUPIED**, each item includes `sessionId`, `sessionTitle`, `formationId`, `formationTitle`, `startAt`, `endAt` (ISO). **`conflictCount`** equals **`conflicts.length`**.

---

## `POST /api/v1/rooms/availability-for-weekly-slot`

**Auth:** ADMIN only.

**Purpose:** Same **status** vocabulary as the exact endpoint, but for a **weekly** slot (weekday + `startTime` / `endTime` **HH:mm**, UTC wall clock — aligned with preview/generate).

**Request:** `formationId`, `dayOfWeek` (1 = Monday … 7 = Sunday), `startTime`, `endTime`.

**Behaviour:**

- Formation must have **both** `startDate` and `endDate`.
- Expands all occurrences of that weekday/time **inside** the formation period (same helper as preview).
- For each room, loads sessions overlapping the **union** of those occurrences and marks **OCCUPIED** if **any** occurrence conflicts with a **non-`CANCELLED`** session in that room.

**Response:** `{ data, summary }` — same DTO classes as the exact endpoint (**`RoomAvailabilityRowDto`**, **`RoomAvailabilitySummaryDto`**).

---

## Overlap rules (shared)

- **Cancelled** sessions are **ignored** everywhere.
- **Back-to-back** allowed (touching intervals do not overlap).

---

## Authoritative validation (must still run on save)

The availability calls are **read-only hints**. Always:

1. **Handle 409** on create / update / generate with conflict payloads (`roomConflicts`, `teacherConflicts`, `formationConflicts`).
2. **Refetch** availability when the user changes time or room (and optionally on a timer, e.g. every ~2 minutes) — another admin may book the room after the last prefetch.
3. Never assume the UI list alone guarantees a conflict-free save.

---

## Frontend integration notes

- **`POST /rooms/availability`** — call when the user picks **dates/times** (debounced) and optionally **`excludeSessionId`** when the form is bound to an existing session.
- **`availableOnly: true`** — handy for a “pick only free rooms” picker; use **`false`** (default) when you need badges for occupied / too small / inactive.
- **`POST /rooms/availability-for-weekly-slot`** — still ideal for **bulk / weekly** row editors; exact endpoint is for **one-off** datetime pickers.
- **Swagger:** `GET /docs` (not under `/api/v1`).

---

## Related code

| Area | Path |
|------|------|
| Exact + weekly service | `src/modules/rooms/rooms.service.ts` |
| Shared overlap helpers | `src/lib/scheduling/room-availability.helpers.ts` |
| Session overlap (CRUD) | `src/lib/scheduling/schedule-conflict.service.ts` |
| Room window query | `src/lib/repositories/rooms/rooms.repository.ts` (`findNonCancelledSessionsInRoomTimeWindow`) |
| E2E exact | `test/rooms-availability-exact.e2e-spec.ts` |
| E2E weekly | `test/rooms-weekly-availability.e2e-spec.ts` |
| Weekly deep dive | `docs/room-weekly-availability-implementation.md` |
