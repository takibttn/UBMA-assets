# Rooms API (UBMA CEIL)

**Base URL:** `/api/v1`  
All routes require **ADMIN** + JWT unless noted.

## CRUD (summary)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/rooms` | Create room |
| GET | `/rooms` | List (search, `isActive`, pagination) |
| GET | `/rooms/:id` | Get one |
| PATCH | `/rooms/:id` | Update |
| DELETE | `/rooms/:id` | Delete if no sessions reference it |

---

## `POST /rooms/availability-for-weekly-slot`

**Purpose:** Admin UX helper for weekly séance planning. Given a formation and a recurring weekday + time window, returns **every room** with:

- `AVAILABLE` — active, room capacity ≥ formation capacity (when set), and **no** overlapping **non-CANCELLED** session in that room for **any** generated occurrence of the slot inside the formation period.
- `OCCUPIED` — at least one such overlap; `conflicts[]` lists each clashing session (`sessionId`, titles, times, formation).
- `INSUFFICIENT_CAPACITY` — active room but `room.capacity < formation.capacity` when formation capacity is set.
- `INACTIVE` — `isActive === false` (`conflicts` empty).

### Contract notes

- Uses the **same** weekly expansion as `POST /formations/:id/sessions/preview` / `generate` (`generateWeeklySlotIntervals` — UTC calendar + `HH:mm`).
- **Does not** evaluate teacher conflicts; **preview** and **generate** remain the source of truth for full scheduling validation.
- **CANCELLED** sessions are ignored for overlap.
- **Back-to-back** allowed: existing `11:00–13:00` does not block candidate `09:00–11:00`.
- Formation must exist and have **`startDate` and `endDate`**; otherwise **400** (`Formation must have startDate and endDate before checking room availability.`).
- Max slot duration **6 hours** (same as manual / preview).

### Request body

`RoomAvailabilityForWeeklySlotDto`: `formationId` (UUID), `dayOfWeek` (1–7 ISO), `startTime` / `endTime` (`HH:mm`).

### Response

`{ data: RoomWeeklyAvailabilityRowDto[] }` — see Swagger `RoomWeeklyAvailabilityResponseDto`.

---

## Preview `slotIndex` (related)

`POST /formations/:formationId/sessions/preview` returns **`slotIndex` as 0-based**, matching the index of the `weeklySlots` array entry that produced each row (after global sort by `startAt`, `slotIndex` still refers to the original weekly slot).

See `docs/formation-session-generation-api.md`.
