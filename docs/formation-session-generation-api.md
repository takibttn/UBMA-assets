# Formation session generation API (UBMA CEIL)

**Base URL:** `/api/v1`  
**Auth:** `POST .../preview` and `POST .../generate` require **ADMIN** (JWT).

## Purpose

Generate **formation_sessions** (séances) automatically from:

- The formation’s **`startDate` / `endDate`** (required).
- A weekly template: one or more **slots** (weekday + local clock times in **UTC** semantics + room).

Manual **session CRUD** (`POST/GET/PATCH/DELETE /formations/:id/sessions`) remains unchanged.

**Not in scope:** modules/curriculum, session-level enrollments, `roomId` on `formations`, teacher–session assignments.

---

## Timezone & dates

- Slot times are **`HH:mm`** strings; combined with **UTC calendar days** via `Date.UTC` (see `formation-session-generation.util.ts`).
- Formation `startDate` / `endDate` are **timestamps**: a generated séance must satisfy **fully**  
  `startAt >= startDate` and `endAt <= endDate` (same rule as manual creation when both are set).
- Prefer sending ISO 8601 with explicit offset (e.g. `Z`) from clients to avoid ambiguity.

---

## `POST /formations/:formationId/sessions/preview`

- **Does not write** to the database.
- **200** with proposed rows and per-row conflict detail.
- **400** if formation period missing/invalid, invalid DTO, inactive room, etc.
- **404** if formation or room id not found (project style).

### Body: `GenerateFormationSessionsDto`

```json
{
  "weeklySlots": [
    {
      "dayOfWeek": 1,
      "startTime": "09:00",
      "endTime": "11:00",
      "roomId": "uuid",
      "title": "Optional"
    }
  ]
}
```

- `dayOfWeek`: **1 = Monday … 7 = Sunday** (ISO).
- `weeklySlots`: **1–14** entries; each slot yields one recurring séance per week inside the formation period.
- Max duration per slot: **6 hours** (same as manual).
- **Room** must exist and be **active**; **room capacity ≥ formation.capacity** when `formation.capacity` is set.

### Response: `GenerateSessionsPreviewResponseDto`

- `data[]`: each item includes `tempId`, `title`, `startAt`/`endAt` (ISO strings), `room`, **`slotIndex` (0-based index into request `weeklySlots`, stable after sort — use to map conflicts back to the weekly slot row)**, `conflictStatus` (`OK` | `CONFLICT`), `status` (`SCHEDULED` | `CONFLICT` for UI), and `roomConflicts` / `teacherConflicts` / `formationConflicts`.
- `summary`: `totalGenerated`, `validCount`, `conflictCount`.
- Conflicting proposals still return **200** (preview); the admin fixes slots/dates/rooms and previews again.

### Generation algorithm (summary)

For each slot:

1. Find the first **UTC calendar date** on or after `startDate` matching `dayOfWeek`.
2. For that date, `startAt` = date + `startTime`, `endAt` = date + `endTime`.
3. Add 7 days and repeat until `startAt` is beyond `endDate`.
4. Keep only instances **fully inside** `[startDate, endDate]`.

---

## `POST /formations/:formationId/sessions/generate`

- Same validation and candidate building as **preview**.
- If **any** candidate has a conflict: **409 Conflict** with:

  ```json
  {
    "message": "Schedule conflict detected",
    "roomConflicts": [],
    "teacherConflicts": [],
    "formationConflicts": [],
    "candidateConflicts": []
  }
  ```

  `candidateConflicts` lists `tempId` and the three conflict arrays per bad candidate.

- If **no** conflict: inserts **all** sessions in **one transaction**, then returns `{ created, summary }` where `created` matches the usual session list shape from `listSessions`.

**Cancelled** existing sessions are ignored in overlap checks. **Back-to-back** sessions are allowed.

---

## Existing sessions

New séances are **additive**: overlaps with non-CANCELLED sessions surface as conflicts. There is **no** `overwriteExisting` flag in v1 (future work).

---

## Related

- **Room weekly availability (admin UX):** `POST /rooms/availability-for-weekly-slot` — same UTC weekly expansion as preview, but lists **all rooms** with `AVAILABLE` / `OCCUPIED` / `INSUFFICIENT_CAPACITY` / `INACTIVE`; **no teacher conflicts**. See `docs/rooms-api.md`.
- Scheduling conflicts: `ScheduleConflictService` (shared with manual create).
- Teacher views: `docs/teacher-calendar-api.md` (global + formation-scoped sessions).
