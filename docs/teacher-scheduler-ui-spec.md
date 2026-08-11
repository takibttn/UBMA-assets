# Teacher (Enseignant) API Documentation — UI & Scheduler Integration Spec

This document provides a highly detailed specification for the Teacher (Enseignant) API. It is tailored for UI and Frontend elements, specifically to build a **Scheduler/Calendar Preview** and other teacher-related interfaces.

## 1. Authentication & Identity

**Role:** `ENSEIGNANT`
**Tokens:** A valid JWT Access Token must be passed in the `Authorization` header as a Bearer token.
**Identity:** For teachers, the `sub` claim in the JWT corresponds strictly to the `teachers.id` (UUID format), **not** the `users.id` table.

### Login Action

**`POST /auth/login`**

Use this endpoint to exchange teacher credentials for a JWT token.

**Request Body (DTO):**
```typescript
interface TeacherLoginBodyDto {
  loginType: 'TEACHER'; // Must be strictly "TEACHER"
  email: string;        // Sent to the backend (normalized to lowercase automatically)
  password: string;     // Must be at least 6 characters long
}
```

**Success Response `200 OK` (DTO):**
```typescript
interface TeacherLoginSuccessDto {
  accessToken: string; // The JWT to utilize in subsequent requests
  user: {
    id: string;              // teachers.id — USE THIS as the API identity/teacherId
    firstName: string;
    lastName: string;
    role: 'ENSEIGNANT';
    accountType: string | null; // Currently generally null for teachers
    email: string;
  };
}
```

---

## 2. API Routes & Data Logic for Scheduler UI

To build a **Scheduler Preview**, the primary entry point is the calendar endpoint.

### 2.1 Get Teacher's Calendar

**`GET /teachers/me/calendar`**

Returns a flattened list of all teaching assignments representing the teacher's schedule.

**Data Logic & Nuances:**
*   **Pagination & Querying:** Although a query object may optionally be sent (like `page`, `limit`, `search`), the backend **ignores** these values and returns **all** calendar entries for the teacher at once. There is no pagination applied to this API response.
*   **Sorting:** Entries are inherently sorted by `startsAt` (which maps to `formations.startDate`) in **ascending** order.
*   **Enrollment Count (`enrolledCount`):** Only reflects enrollments with `status = 'ENROLLED'`. Cancelled enrollments are mathematically excluded (SQL COUNT applies the filter). Will return `0` if empty.
*   **Unique IDs:** Important: The response `id` is the `formation_teachers.id` (the assignment ID), **NOT** the `formationId`. To link a scheduler event to course details, use `formationId` instead of `id`.

**Response Shape (DTO):**
```typescript
interface TeacherCalendarResponseDto {
  data: Array<TeacherCalendarEventDto>;
}

interface TeacherCalendarEventDto {
  id: string;          // GUID of the teaching ASSIGNMENT (formation_teachers.id)
  formationId: string; // GUID of the FORMATION itself (use this for linking/routing)
  title: string;       // Title of the formation
  
  // Start and End dates for the scheduler timeline mapping
  startsAt: string | null; // ISO Date string mapped from formations.startDate
  endsAt: string | null;   // ISO Date string mapped from formations.endDate
  
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
  
  // Computed status based on 'formations.isSaleOpen' 
  status: 'OPEN' | 'CLOSED'; 
  
  enrolledCount: number; // Number of active ('ENROLLED') learners
  type: 'FORMATION';     // Discriminator type, currently fixed
}
```

**UI Implementation Note for Scheduler:**
When rendering these items on a UI timeline or generic calendar component (e.g., FullCalendar), utilize `startsAt` and `endsAt`. Make sure to handle `null` occurrences gracefully (meaning un-scheduled or TBD formations might need to be grouped in a "Draft" or "Unscheduled" bucket rather than breaking the calendar component). 

### 2.2 Dashboard Overview & Upcoming Classes

**`GET /dashboard/teacher`**

While building the dashboard, if you also need to preview standard UI statistics or standard upcoming subsets rather than the full scheduler, use this endpoint.

**Data Logic:**
This route performs three primary functions in parallel under the hood:
1. Gathers scalar numeric statistics.
2. Serves the full list of assigned formations.
3. Filters a subset (`upcomingAssignedFormations`) strictly evaluating `startDate >= now` (sorted ascending).

**Response Shape (DTO):**
```typescript
interface TeacherDashboardResponseDto {
  // Statistics Subset
  stats: {
    // Exact schema based on teacher statistics count mapping
    totalAssignedFormations: number;
    activeFormations: number;
    totalEnrollments: number; // Sum of ENROLLED students in this teacher's formations
  };
  upcomingAssignedFormations: FormationSummaryDto[];
  assignedFormations: FormationSummaryDto[];
}

interface FormationSummaryDto {
  id: string; // formations.id
  title: string;
  description: string | null;
  languageId: string | null;
  levelId: string | null;
  creatorId: string | null;
  price: string | number | null; // WARNING: Numeric from Postgres might serialize as string in JS
  capacity: number | null;
  isSaleOpen: boolean;
  startDate: string | null; // ISO Date
  endDate: string | null;   // ISO Date
  createdAt: string;        // ISO Date
}
```

---

## 3. Supplementary Data for Scheduler Tooltips/Modals

When a user clicks on a block inside the Scheduler Preview UI, you might want to fetch contextual details.

### 3.1 Fetching Enrollments (Class Roster feature)

**`GET /teachers/me/formations/:formationId/enrollments`**

Retrieves a paginated list of students enrolled in a precise formation assigned to the current teacher.
*Security Guard:* Checks if `JWT sub (teacherId) + formationId` exist in the `formation_teachers` mapping rule. If not, yields `403 Forbidden`.

**Data Logic & Nuances:**
*   Only `page` and `limit` are honored. `search`, `sortBy`, and `sortOrder` query strings will be ignored effectively defaulting to `enrolledAt` descending.
*   The API returns **both** `ENROLLED` and `CANCELLED` statuses. The UI **must filter actively** if it only wants to display active users to the teacher.

**Query Parameters:** `?page=1&limit=10`

**Response Shape (DTO):**
```typescript
interface PaginatedFormationEnrollmentsDto {
  data: TeacherFormationEnrollmentRowDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface TeacherFormationEnrollmentRowDto {
  id: string;                // Enrollment ID
  studentId: string;         // mapped users.id
  status: 'ENROLLED' | 'CANCELLED'; 
  enrolledAt: string;        // ISO Date
  student: {
    id: string;              // users.id
    firstName: string;
    lastName: string;
    matricule: string | null;
  };
}
```

### 3.2 List All Generalized Enrollments

If building an aggregated "All Students Log" view next to the scheduler:

**`GET /enrollments/teacher`**

Supports full pagination AND robust filtering options.

**Data Logic:**
*   `formationId`: Optionally filter by one specific assignment. (Empty list if teacher isn't assigned).
*   `search`: Case-insensitive lookups matching `title`, student's `name/email`, `matricule`, etc.
*   `status`: You can request only `ENROLLED` or `CANCELLED`.
*   `sortBy`/`sortOrder`: Sort by `enrolledAt` or `status` (`asc` or `desc`).

---

## 4. UI/UX Rules & State Handling Checklist

When rendering the Teacher Scheduler API in the UI, incorporate the following guidelines:

1.  **Differentiating IDs:** Do not pass the calendar response `id` (Assignment ID) when building links or pushing the route structure (e.g. `/formations/:id`). Always grab the `.formationId` property from the timeline events.
2.  **Date Validation:** `startsAt` and `endsAt` can intrinsically be `null` coming from Postgres if a formation is drafted without dates. Protect the scheduler mapping logic (e.g. `const scheduledOnly = calendarEvents.filter(ev => ev.startsAt !== null)`).
3.  **Numerical Parsing:** Sometimes columns containing numeric data (like `price` on the Dashboard endpoint) will hit JSON deserialization as a string. Run `Number(ev.price)` or utilize a formatting helper safely to avoid unintended JS type errors.
4.  **Security Errors:** Always gracefully handle `403 Forbidden` inside deep formation views, as an admin might have forcefully unassigned a teacher while they were browsing the web application. 
5.  **Calendar Fetch Constraint:** The API `GET /teachers/me/calendar` brings everything down un-paginated. In large datasets, cache this query locally at the React Query / Redux slice layer rather than polling it aggressively. 
