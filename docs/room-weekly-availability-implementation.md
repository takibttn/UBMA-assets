# Room weekly availability — implementation guide

This document describes the **room weekly availability** admin helper endpoint, **`slotIndex`** semantics in session preview, and how they relate to **preview** and **generate**. It is intended for frontend integration and backend maintenance.

---

## 1. Executive summary

**What was implemented**

- **`POST /api/v1/rooms/availability-for-weekly-slot`** — an **ADMIN-only** endpoint that, for a given formation and a single recurring weekly time window (weekday + `HH:mm` start/end), scores every room as **AVAILABLE**, **OCCUPIED**, **INSUFFICIENT_CAPACITY**, or **INACTIVE**, including optional **conflict** details for occupied rooms.
- **Contract clarity for `GeneratedSessionPreviewItem.slotIndex`** — documented and covered by tests as **0-based**, aligned with the order of entries in the `weeklySlots` array sent to preview.

**Why this endpoint exists**

Bulk séance generation asks the admin to pick **rooms** for one or more **weekly slots**. Without a hint, the UI would force trial-and-error or guesswork. This endpoint answers: “If we repeat this slot every week during the formation period, which rooms are free enough (capacity + calendar), ignoring cancelled sessions?”

**How it helps the admin bulk séance generation UI**

- After the admin selects **formation**, **day of week**, and **time range**, the client can fetch a **room list with statuses** and show French labels (see [§8](#8-frontend-integration-notes)).
- **OCCUPIED** rows include **conflicts** (session times, titles, formation) so the UI can explain *why* a room is blocked.

**Why preview/generate remain the final source of truth**

- This endpoint checks **one** hypothetical weekly slot and **room + non-cancelled session overlap** only.
- It does **not** check **teacher** availability, **multi-slot** interactions, or **full transactional** rules enforced at generate time.
- **`POST .../sessions/preview`** validates the **entire** proposed schedule (all weekly slots, teachers, rooms, formation boundaries).
- **`POST .../sessions/generate`** performs **authoritative, transactional** creation. The room availability call is a **UX helper**, not a replacement.

---

## 2. Current academic scheduling model

| Concept | Role |
|--------|------|
| **Formation** | Programme / course with **`startDate`** and **`endDate`** (the scheduling window). |
| **Séance / session** | One scheduled occurrence **inside** the formation period; has **`startAt`**, **`endAt`**, optional **room**, **title**, **status** (e.g. `CANCELLED`). |
| **Room** | Physical resource; **assigned per session**, not stored as a property of the formation. **Rooms are not assigned directly to formations** — only to individual sessions. |
| **Teacher** | Linked to a formation via **`formation_teachers`** (and related session/assignment logic elsewhere). |
| **Enrollment** | Learner enrolled in a **formation**. |
| **Attendance** | Per **session** + **enrollment** (not detailed here; see attendance APIs). |

---

## 3. Contract verification: `slotIndex`

**`GeneratedSessionPreviewItem.slotIndex`**

| Property | Behavior |
|----------|----------|
| **0-based** | **Yes.** It is the index of the `weeklySlots` array element that produced each preview row. |
| **Mapping** | `weeklySlots[i]` → every generated preview row from that slot has `slotIndex === i`. |

**Examples**

- `weeklySlots[0]` → `slotIndex = 0`
- `weeklySlots[1]` → `slotIndex = 1`

**Implementation reference**

Candidates are built with `weeklySlots.forEach((slot, slotIndex) => { ... slotIndex ... })` in `generateWeeklySessionCandidates` (`src/modules/formations/formation-session-generation.util.ts`).

**API / OpenAPI**

`GeneratedSessionPreviewItemDto` documents `slotIndex` as the zero-based index mapping preview conflicts back to the UI slot row (`src/modules/formations/dto/generated-sessions-preview-response.dto.ts`).

**Tests**

- **`describe('Preview slotIndex is 0-based')`** in `test/rooms-weekly-availability.e2e-spec.ts`: calls `POST /api/v1/formations/:id/sessions/preview` with two slots (Monday index 0, Tuesday index 1) and asserts all Monday rows have `slotIndex === 0` and all Tuesday rows have `slotIndex === 1`.

**Migration / prior behavior**

Indexing was already **0-based** in generation logic; work here **verifies and documents** it rather than changing the algorithm. No data migration was required for `slotIndex`.

---

## 4. New endpoint documentation

### Route and method

| Item | Value |
|------|--------|
| **Method** | `POST` |
| **Path (controller)** | `/rooms/availability-for-weekly-slot` |
| **Global prefix** | `/api/v1` |
| **Full URL** | **`POST /api/v1/rooms/availability-for-weekly-slot`** |
| **Success HTTP status** | `200 OK` |

The route is registered **before** `GET /rooms/:id` so `availability-for-weekly-slot` is not interpreted as a UUID.

### Authentication / authorization

| Requirement | Detail |
|-------------|--------|
| **Auth** | Bearer JWT |
| **Role** | **`ADMIN` only** — the whole `RoomsController` is `@Auth(UserRole.ADMIN)`. Non-admin roles receive **403 Forbidden**. |

### Request DTO

```ts
type RoomAvailabilityForWeeklySlotDto = {
  formationId: string;
  dayOfWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  startTime: string; // HH:mm (24h)
  endTime: string;   // HH:mm (24h)
};
```

- **`dayOfWeek`**: ISO-style **1 = Monday … 7 = Sunday** (same convention as preview/generate).

Times use the same **UTC wall-clock** combining rules as preview/generate (see DTO `@ApiProperty` notes).

### Response DTO

```ts
type RoomWeeklyAvailabilityResponseDto = {
  data: Array<{
    room: {
      id: string;
      code: string;
      name: string;
      capacity: number;
      isActive: boolean;
    };
    status:
      | 'AVAILABLE'
      | 'OCCUPIED'
      | 'INSUFFICIENT_CAPACITY'
      | 'INACTIVE';
    conflictCount: number;
    conflicts: Array<{
      startAt: string;
      endAt: string;
      sessionId: string;
      sessionTitle: string;
      formationId: string;
      formationTitle: string;
    }>;
  }>;
};
```

- **`conflictCount`** matches the number of overlapping **non-cancelled** sessions listed in **`conflicts`** (for **OCCUPIED** rows).
- **`startAt` / `endAt`** in conflicts are **ISO 8601** strings.

---

## 5. Validation rules

### Request validation (DTO + pipes)

| Rule | Detail |
|------|--------|
| **`formationId`** | Required; **`IsUUID()`** |
| **`dayOfWeek`** | Required integer; must be **1–7** (`@IsIn([1,…,7])`) |
| **`startTime` / `endTime`** | Required strings; must match **`HH:mm`** (`([01]\d|2[0-3]):([0-5]\d)`) |

### Service-level rules (`RoomsService.getAvailabilityForWeeklySlot`)

| Rule | Detail |
|------|--------|
| **Parse times** | If `parseTimeToHoursMinutes` fails → **400** `Invalid time format; use HH:mm` |
| **`startTime` &lt; `endTime`** | Compared on a reference date → **400** `startTime must be before endTime` |
| **Max duration** | Duration must be **≤ 6 hours** (`MAX_SESSION_MS` from `formation-session-validation.util.ts`) → **400** `Session duration must be at most 6 hours` |
| **Formation exists** | **`findById`** → **404** `Formation not found` |
| **Formation period** | Must have **both** `startDate` and `endDate` → **400** with message containing start/end requirement |
| **Valid period** | `startDate >= endDate` → **400** `Formation period is invalid` |

### Auth errors

| Situation | HTTP |
|-----------|------|
| Missing / invalid token | **401 Unauthorized** |
| Authenticated non-**ADMIN** | **403 Forbidden** |

### Summary of status codes

| Code | Typical cause |
|------|----------------|
| **400** | Validation pipe failure, bad times, missing formation dates, invalid period, duration &gt; 6h |
| **401** | Missing or invalid JWT |
| **403** | Non-admin user |
| **404** | Unknown `formationId` |

---

## 6. Availability algorithm

Executed in **`RoomsService.getAvailabilityForWeeklySlot`**:

1. **Validate** times, order, and max duration (see [§5](#5-validation-rules)).
2. **Load formation** by `formationId`; ensure dates and period validity.
3. **Build candidate intervals** — **`generateWeeklySlotIntervals(formation.startDate, formation.endDate, dayOfWeek, startTime, endTime)`** produces every **within-boundaries** weekly occurrence in the formation window (same expansion logic family as preview/generate).
4. **Compute DB query window** — `windowStart` = min of all candidate `startAt`; `windowEnd` = max of all candidate `endAt` (fallback to formation dates if no intervals).
5. **Load rooms** — **`findAllOrderedByCode()`** (all rooms, stable order).
6. **For each room**, in order:
   - If **`!room.isActive`** → **`INACTIVE`** (no conflicts loaded).
   - Else if formation has a **capacity** and **`room.capacity < formation.capacity`** → **`INSUFFICIENT_CAPACITY`**.
   - Else load **non-cancelled** sessions in that room overlapping **`[windowStart, windowEnd]`** via **`findNonCancelledSessionsInRoomTimeWindow`**.
   - **Precise overlap**: keep sessions where **any** candidate interval overlaps the session (using **`sessionIntervalsOverlap`**).
   - If any → **`OCCUPIED`** with **`conflicts`** and **`conflictCount`**; else **`AVAILABLE`**.

### Overlap formula

Intervals **A** = `[aStart, aEnd)` style instants, **B** = `[bStart, bEnd)`:

```text
overlap ⟺ aStart < bEnd AND aEnd > bStart
```

Implemented as **`rangesOverlap`** → **`sessionIntervalsOverlap`** in `formation-session-generation.util.ts`.

**Consequences**

- **Cancelled sessions** — Excluded in SQL (`status != 'CANCELLED'`) and thus **ignored**.
- **Back-to-back** — End `11:00` vs start `11:00` does **not** overlap (`aStart < bEnd` fails when equal end/start in the strict inequality sense as implemented: `11:00 < 11:00` is false). So **back-to-back is allowed**.
- **Teacher conflicts** — **Not** evaluated in this endpoint **by design**.
- **Full rules** — **`preview`** / **`generate`** still enforce the complete conflict model.

---

## 7. Relationship with preview/generate

| Capability | Room weekly availability | Preview | Generate |
|------------|-------------------------|---------|----------|
| Purpose | Hint for **one** weekly slot + **rooms** | Validate **all** slots + teachers + rooms | **Commit** sessions |
| Teacher conflicts | No | Yes | Yes |
| Multi-slot consistency | No | Yes | Yes |
| Transactional create | No | No | Yes |

**Frontend should:**

1. Use **`availability-for-weekly-slot`** to shortlist rooms when editing **one** weekly row.
2. Call **`POST .../sessions/preview`** with the **full** `weeklySlots` array before trusting the schedule.
3. Call **`POST .../sessions/generate`** only after a **fresh, conflict-free** preview (or accepting documented conflict handling if the product allows it).

---

## 8. Frontend integration notes

- **When to call** — Only when **`formationId`**, **`dayOfWeek`**, **`startTime`**, **`endTime`** are syntactically valid (avoid hammering the API while fields are incomplete).
- **Debounce** — Debounce on time/day edits (e.g. 300–500 ms) to limit load.
- **Status labels (French)**  
  - `AVAILABLE` → **Disponible**  
  - `OCCUPIED` → **Occupée**  
  - `INSUFFICIENT_CAPACITY` → **Capacité insuffisante**  
  - `INACTIVE` → **Inactive**
- **Failure fallback** — If the request fails, show an **`UNKNOWN`** (or similar) state; do not pretend the room list is authoritative.
- **No generation without preview** — Do not enable final “generate” without a **recent preview** that matches the current slot configuration and is **conflict-free** per product rules.
- **Do not use as final validation** — Treat this endpoint as **advisory** only.

---

## 9. Tests added

All scenarios below are in **`test/rooms-weekly-availability.e2e-spec.ts`** unless noted.

### Suite: `Room weekly availability (admin UX helper)`

| Test | Scenario | Expected HTTP | Expected response highlights |
|------|-----------|---------------|------------------------------|
| `ADMIN: [...]` | No sessions for room | **200** | Room row **`AVAILABLE`**, `conflictCount` 0, `conflicts` `[]` |
| `returns OCCUPIED when [...]` | Session overlaps a generated candidate | **200** | **`OCCUPIED`**, `conflictCount` 1, conflict has `sessionTitle`, `formationTitle` |
| `allows back-to-back [...]` | Session `11:00–13:00` vs slot `09:00–11:00` same day | **200** | **`AVAILABLE`** |
| `ignores CANCELLED [...]` | Overlapping but `CANCELLED` | **200** | **`AVAILABLE`** |
| `returns INSUFFICIENT_CAPACITY [...]` | Room capacity &lt; formation capacity | **200** | **`INSUFFICIENT_CAPACITY`** |
| `returns INACTIVE [...]` | `isActive: false` | **200** | **`INACTIVE`** |
| `returns 400 when formation has no period` | `startDate`/`endDate` null | **400** | Message mentions **`startDate and endDate`** |
| `returns 400 for invalid dayOfWeek` | `0` and `8` | **400** | Validation failure |
| `returns 400 for invalid time format` | e.g. `9am` | **400** | — |
| `returns 400 when startTime >= endTime` | Reversed times | **400** | — |
| `returns 400 when duration exceeds 6 hours` | `08:00`–`16:00` | **400** | — |
| `ENSEIGNANT and APPRENANT get 403` | Teacher / learner tokens | **403** | — |
| `returns 404 when formation not found` | Random UUID | **404** | — |
| `returns 401 without token` | No `Authorization` | **401** | — |
| `marks OCCUPIED if only a later Monday conflicts` | Conflict on a **later** week in the period | **200** | **`OCCUPIED`**, confirms whole-period check |

### Suite: `Preview slotIndex is 0-based`

| Test | Scenario | Expected HTTP | Expected response |
|------|-----------|---------------|-------------------|
| `maps weeklySlots[0] [...]` | Preview with Mon slot + Tue slot | **200** | All Mon rows `slotIndex === 0`; all Tue rows `slotIndex === 1` |

---

## 10. Files changed (feature scope)

For **room weekly availability** and **`slotIndex`** documentation/verification:

| Area | Files |
|------|--------|
| **DTOs** | `src/modules/rooms/dto/room-availability-for-weekly-slot.dto.ts`, `src/modules/rooms/dto/room-weekly-availability-response.dto.ts`, `src/modules/formations/dto/generated-sessions-preview-response.dto.ts` |
| **Controller** | `src/modules/rooms/rooms.controller.ts` |
| **Service** | `src/modules/rooms/rooms.service.ts` |
| **Module** | `src/modules/rooms/rooms.module.ts` (`FormationsRepository` registered for formation lookup) |
| **Repository** | `src/lib/repositories/rooms/rooms.repository.ts` (`findAllOrderedByCode`, `findNonCancelledSessionsInRoomTimeWindow`) |
| **Utilities** | `src/modules/formations/formation-session-generation.util.ts` (`generateWeeklySlotIntervals`, `sessionIntervalsOverlap`; **`candidatesRoomOverlap` compile fix**) |
| **Validation constant** | `src/modules/formations/formation-session-validation.util.ts` (`MAX_SESSION_MS` reused) |
| **Tests** | `test/rooms-weekly-availability.e2e-spec.ts` |
| **Docs** | `docs/rooms-api.md`, `docs/formation-session-generation-api.md`, `docs/UBMA_CEIL_MASTER_REFERENCE.md` (cross-references as applicable), **`docs/room-weekly-availability-implementation.md`** (this file) |

---

## 11. Commands and results

Captured on **2026-05-01** from a clean **`npm run build`** then **`npm run test:e2e`**.

### `npm run build`

```text
> ubma-services-api@0.0.1 build
> nest build
```

Exit: **success** (no TypeScript errors).

### `npm run test:e2e`

```text
Test Suites: 11 passed, 11 total
Tests:       82 passed, 82 total
Snapshots:   0 total
Time:        ~28 s
```

Exit code: **0**.

### Test database / migrations

- **Global Jest setup** (`test/global-setup.e2e.ts`) runs **migrations** against `DATABASE_URL` from **`.env.test`**.
- **Per-test cleanup** uses **`truncateTestTables()`** in the spec `beforeEach` / `beforeAll` as applicable.
- Optional manual reset script (when developing against the test DB): **`npm run test:db:reset`**.

---

## 12. Known limitations / future work

- **No automatic room assignment** — The API only **scores** rooms; it does not pick a default room.
- **No teacher conflict check** in this endpoint **by design** — Keeps the query fast and scoped; teachers are validated in **preview/generate**.
- **No “formation-less” preview** — Room availability **requires** an existing formation with **`formationId`** and dates.
- **Preview and generate remain mandatory** for authoritative scheduling and transactional creation.

---

## 13. Final backend contract summary

Copy-paste reference for frontend:

| Item | Value |
|------|--------|
| **Endpoint** | `POST /api/v1/rooms/availability-for-weekly-slot` |
| **Auth** | `ADMIN` + Bearer token |
| **Request** | `{ formationId, dayOfWeek, startTime, endTime }` |
| **Statuses** | `AVAILABLE` \| `OCCUPIED` \| `INSUFFICIENT_CAPACITY` \| `INACTIVE` |
| **Final validation** | **`POST .../sessions/preview`** and **`POST .../sessions/generate`** remain **required** for full scheduling truth |

---

## Report (checklist)

| Item | Result |
|------|--------|
| **1. File path** | `docs/room-weekly-availability-implementation.md` |
| **2. Build** | **`npm run build`** — success (`nest build`) |
| **3. Tests** | **`npm run test:e2e`** — **11** suites, **82** tests passed |
| **4. `slotIndex` base** | **0-based**; maps `weeklySlots[i]` → `slotIndex === i` |
| **5. Bugs / fixes** | **`candidatesRoomOverlap`** in `formation-session-generation.util.ts` was **restored** after a bad edit broke the signature/body and **TypeScript build**; behavior again matches **`rangesOverlap`** on candidate pairs same-room. |
