# Formations API

Reference documentation for the formations module — admin and read endpoints.

---

## 1. Overview

The formations module covers:

- Listing and pagination (any authenticated user)
- Read by id (any authenticated user)
- Admin-only CRUD (create, update, sale toggle, delete)
- Admin analytics: stats cards + chart card (`byStatus`, `byLanguage`, `byLevel`)

---

## 2. Auth Requirements

All endpoints require a `Bearer` JWT token.

| Scope | Roles |
|-------|-------|
| Read (list, by id) | Any authenticated user |
| Admin operations (create, update, delete, toggle sale, stats, analytics) | `ADMIN` only |

Any unauthorized role receives `403 Forbidden`.

---

## 3. Endpoint List

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/formations` | Any auth | Paginated list (cards/table) |
| `GET` | `/formations/:id` | Any auth | Formation detail with language and level |
| `POST` | `/formations` | ADMIN | Create |
| `PATCH` | `/formations/:id` | ADMIN | Update |
| `PATCH` | `/formations/:id/sale` | ADMIN | Toggle `isSaleOpen` |
| `DELETE` | `/formations/:id` | ADMIN | Delete |
| `GET` | `/formations/admin/stats` | ADMIN | Stats cards |
| `GET` | `/formations/admin/analytics` | ADMIN | Chart card data |

> Route order note: `admin/stats` and `admin/analytics` are declared **before** the `:id` parameterized routes in the controller so they are not matched as a UUID.

---

## 4. List Endpoint — `GET /formations`

### Query params

Inherited from `PaginationQueryDto` plus formations-specific filters.

| Param | Type | Description |
|-------|------|-------------|
| `page` | integer | 1-based page index |
| `limit` | integer | Page size |
| `search` | string | `ilike` match on `title` |
| `sortBy` | string | One of: `createdAt`, `title`, `startDate`, `price` |
| `sortOrder` | `asc` \| `desc` | Default `desc` |
| `saleStatus` | `OPEN` \| `CLOSED` \| `ALL` | Optional. `OPEN` → `isSaleOpen === true`; `CLOSED` → `false`; `ALL` or omitted → no sale filter |
| `languageId` | uuid | Filter by language |
| `levelId` | uuid | Filter by level |

Invalid `saleStatus` (anything other than `OPEN`, `CLOSED`, `ALL`) → **400** with message `saleStatus must be OPEN, CLOSED, or ALL`.

### Response item shape

Each item includes nested `language` and `level` objects and an aggregated `enrolledCount` (count of `ENROLLED` enrollments).

```ts
type AdminFormationListItem = {
  id: string;
  title: string;
  description: string | null;
  creatorId: string | null;
  languageId: string | null;
  levelId: string | null;
  price: string | null;        // Drizzle numeric returns string
  capacity: number | null;
  isSaleOpen: boolean;
  startDate: string | null;    // ISO 8601
  endDate: string | null;
  createdAt: string;
  enrolledCount: number;       // computed via correlated subquery
  language: {
    id: string | null;
    name: string | null;
    code: string | null;
  };
  level: {
    id: string | null;
    code: string | null;
    name: string | null;
  };
};
```

### Example response

```json
{
  "data": [
    {
      "id": "c1a2b3c4-0000-0000-0000-000000000001",
      "title": "Anglais Intermédiaire B2",
      "description": "Formation de 3 mois pour cadres",
      "creatorId": "00000000-0000-0000-0000-00000000aaaa",
      "languageId": "11111111-1111-1111-1111-111111111111",
      "levelId": "22222222-2222-2222-2222-222222222222",
      "price": "1500.00",
      "capacity": 20,
      "isSaleOpen": true,
      "startDate": "2026-06-01T08:00:00.000Z",
      "endDate": "2026-09-01T17:00:00.000Z",
      "createdAt": "2026-04-15T12:30:00.000Z",
      "enrolledCount": 14,
      "language": { "id": "11111111-...", "name": "Anglais", "code": "EN" },
      "level": { "id": "22222222-...", "code": "B2", "name": "Intermédiaire" }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5
  }
}
```

The pagination envelope shape is unchanged — `enrolledCount`, `language`, and `level` are additive.

---

## 5. `GET /formations/:id`

Returns the same item shape as a list row (without `enrolledCount`).

`404 Not Found` if no formation with the given id.

---

## 6. Admin Stats — `GET /formations/admin/stats`

```ts
type AdminFormationStatsDto = {
  totalFormations: number;
  openSales: number;
  closedSales: number;
  upcomingFormations: number;
};
```

### Definitions

| Field | Definition |
|-------|-----------|
| `totalFormations` | total count of formations |
| `openSales` | `isSaleOpen = true` |
| `closedSales` | `isSaleOpen = false` |
| `upcomingFormations` | `startDate > now` |

### Example

```json
{
  "totalFormations": 42,
  "openSales": 18,
  "closedSales": 24,
  "upcomingFormations": 5
}
```

---

## 7. Admin Analytics — `GET /formations/admin/analytics`

Powers the chart card with three tabs: **Statuses**, **Languages**, **Levels**.

```ts
type AdminFormationAnalyticsDto = {
  byStatus: Array<{
    status: "OPEN" | "CLOSED" | "UPCOMING" | "ENDED";
    count: number;
  }>;
  byLanguage: Array<{
    languageId: string | null;
    languageCode: string | null;
    languageName: string | null;
    count: number;
  }>;
  byLevel: Array<{
    levelId: string | null;
    levelCode: string | null;
    levelName: string | null;
    count: number;
  }>;
};
```

### Status priority rules

Each formation is classified into **exactly one** status using this strict priority order:

1. **`ENDED`** — `endDate < now`
2. **`UPCOMING`** — `startDate > now`
3. **`CLOSED`** — `isSaleOpen = false`
4. **`OPEN`** — otherwise

> A formation that has already ended is `ENDED` even if `isSaleOpen` was `true`.
> A formation that has not started yet is `UPCOMING` regardless of `isSaleOpen`.
> The `byStatus` array always contains all four buckets, including those with `count = 0`.

### Grouping rules

- `byLanguage`: groups by `languages.id` (left-joined). Formations without a linked language appear as a row where `languageId`, `languageCode`, and `languageName` are all `null`.
- `byLevel`: groups by `formationLevels.id` (left-joined). Same null behavior as language.

### Example

```json
{
  "byStatus": [
    { "status": "OPEN", "count": 18 },
    { "status": "CLOSED", "count": 9 },
    { "status": "UPCOMING", "count": 5 },
    { "status": "ENDED", "count": 10 }
  ],
  "byLanguage": [
    { "languageId": "11111111-...", "languageCode": "EN", "languageName": "Anglais", "count": 16 },
    { "languageId": "22222222-...", "languageCode": "FR", "languageName": "Français", "count": 14 },
    { "languageId": null, "languageCode": null, "languageName": null, "count": 1 }
  ],
  "byLevel": [
    { "levelId": "33333333-...", "levelCode": "A1", "levelName": "Débutant", "count": 12 },
    { "levelId": "44444444-...", "levelCode": "B2", "levelName": "Intermédiaire", "count": 8 }
  ]
}
```

---

## 8. Admin Mutations

### `POST /formations`

Body: `CreateFormationDto` — title, description, languageId, levelId, price, capacity, startDate, endDate. Server enforces `startDate < endDate` and language/level relationship.

### `PATCH /formations/:id`

Body: `UpdateFormationDto` — partial update. Same date ordering validation as create (`startDate` &lt; `endDate` when both present).

If **`startDate`** and/or **`endDate`** change and the formation still has **both** bounds after the update, the server checks **every teacher assigned to this formation**: their **other** assignments must not overlap the new window, and those other formations must have complete dates. Otherwise **400** (undated sibling formation) or **409** (schedule overlap).

### `PATCH /formations/:id/sale`

Body: `{ isSaleOpen: boolean }`.

### `DELETE /formations/:id`

`204 No Content` on success.

---

## 9. Frontend Integration Notes

1. The list endpoint already exposes language, level, and `enrolledCount` — no extra fetch needed for cards/table.
2. Stats and analytics endpoints are independent of pagination; call them once on dashboard mount.
3. `byStatus` always returns all four buckets in this fixed order: `OPEN`, `CLOSED`, `UPCOMING`, `ENDED`. The frontend can iterate without checking presence.
4. Group rows with `null` `languageId` / `levelId` represent legacy/orphaned formations missing a link — display as "Other" or "Unassigned".
5. `price` is returned as a string (PostgreSQL numeric) — parse to `Number` on the client only when formatting.
6. Empty arrays / zero counts are returned cleanly for empty databases — no need for null checks.

---

## 10. Formation price and enrollment data consistency

List and detail responses use a shared **formation card** shape:

- **`price`**: PostgreSQL `numeric`, returned as **string** (or `null`). Format for display on the client; avoid float math for money.
- **`enrolledCount`**: count of enrollments with status **`ENROLLED`** only.
- **`spotsRemaining`**: `null` when `capacity` is `null` (unlimited); otherwise `max(0, capacity - enrolledCount)`.
- **`language` / `level`**: objects always present with nullable `id`, `name`, `code` (and `code`/`name` on level) — not omitted keys.

For **`APPRENANT`** on `GET /formations` and `GET /formations/:id`, the API also returns:

- **`myEnrollment`**: `{ enrollmentId, status, enrolledAt }` or `null`.
- **`canEnroll`**: `true` only when the learner has no blocking enrollment row, sale is open, and the formation is not full (see service mapper).
- **`enrollmentBlockedReason`**: `ALREADY_ENROLLED`, `SALE_CLOSED`, `FORMATION_FULL`, or `null` (learners with a **CANCELLED** row cannot re-enroll yet; see enrollments API).

Other roles receive the card fields without the learner-specific properties.

---

*Generated for UBMA CEIL — formations admin backend contract.*
