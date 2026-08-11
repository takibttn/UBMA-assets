# Certificate Template Integration Follow-up

## 1. Executive summary
This document outlines the current state of the certificate backend and provides a roadmap for integrating the new CEIL certificate UI template. The backend already supports certificate generation, listing, and verification, but several fields required by the new template are either not currently returned or need to be derived from related tables.

## 2. Current backend files inspected
- **Controller**: `src/modules/certificates/certificates.controller.ts`
- **Service**: `src/modules/certificates/certificates.service.ts`
- **Repository**: `src/lib/repositories/certificates/certificates.repository.ts`
- **Schema**: `src/db/schema.ts` (Table: `certificates`)
- **Other Repositories**: 
  - `src/lib/repositories/enrollments/enrollments.repository.ts`
  - `src/lib/repositories/formations/formations.repository.ts`
  - `src/lib/repositories/formation-sessions/formation-sessions.repository.ts`

## 3. Existing certificate endpoints
All endpoints are prefixed with `/api/v1`.

| Method | Path | Role | Description |
|---|---|---|---|
| `POST` | `/certificates/:enrollmentId/generate` | `ADMIN` | Generates a new certificate record. |
| `GET` | `/certificates/me` | `APPRENANT` | Lists certificates for the logged-in learner. |
| `GET` | `/public/certificates/:verificationCode` | `PUBLIC` | Public verification of a certificate. |
| `GET` | `/enrollments/teacher/:enrollmentId` | `ENSEIGNANT` | View enrollment details including certificate if issued. |

## 4. Current response shapes
### `GET /public/certificates/:verificationCode`
```json
{
  "status": "VALID",
  "certificateNumber": "CEIL-2026-A1B2",
  "issuedAt": "2026-05-02T10:00:00Z",
  "studentName": "Cata Zaki",
  "studentMatricule": "2022/1234",
  "formationTitle": "Anglais B2",
  "teacherName": "Taha Djemili",
  "pdfUrl": null
}
```

### `GET /certificates/me` (Paginated)
```json
{
  "data": [
    {
      "id": "uuid",
      "certificateNumber": "CEIL-2026-A1B2",
      "verificationCode": "hex-code",
      "issuedAt": "timestamp",
      "pdfUrl": null,
      "formation": {
        "id": "uuid",
        "title": "Anglais B2",
        "startDate": "timestamp",
        "endDate": "timestamp"
      },
      "verificationUrl": "/api/v1/public/certificates/hex-code"
    }
  ],
  "meta": { ... }
}
```

## 5. Template field mapping

| Template field | Backend source | Currently returned? | Notes |
|---|---|---|---|
| **candidateName** | `users.firstName` + `users.lastName` | Partial | Only in public verification. Needs to be added to all cert DTOs. |
| **formationTitle** | `formations.title` | **Yes** | |
| **language** | `languages.name` | **No** | Join required on `formations.languageId`. |
| **level** | `formation_levels.code` | **No** | Join required on `formations.levelId`. |
| **academicYear** | Derived from `formations.startDate` | **No** | Suggestion: `2025 / 2026` format. |
| **sessionLabel** | None | **No** | Missing from schema. Suggest nullable for now. |
| **durationHours** | Sum of `formation_sessions` durations | **No** | Requires calculation in repository/service. |
| **completionDate** | `formations.endDate` or `issuedAt` | **No** | Currently only `issuedAt` is returned. |
| **certificateNumber** | `certificates.certificateNumber` | **Yes** | |
| **verificationCode** | `certificates.verificationCode` | **Yes** | |
| **verificationUrl** | Absolute app URL + code | Partial | Currently returns a relative API path. |

## 6. Recommended CertificateTemplateDto
This DTO should be returned by a new "Detail" or "Template" endpoint to provide all fields necessary for the frontend dialog.

```typescript
export type CertificateTemplateDto = {
  id: string;
  enrollmentId: string;

  candidateName: string;
  formationTitle: string;
  language: string; // e.g., "Anglais"
  level: string;    // e.g., "B2"

  academicYear: string | null;  // e.g., "2025 / 2026"
  sessionLabel: string | null;  // e.g., "Session Printemps"
  durationHours: number | null; // Derived from sessions
  completionDate: string | null; // formation.endDate or issuedAt

  certificateNumber: string;
  verificationCode: string;
  verificationUrl: string; // Absolute URL for QR code

  issuedAt: string;
  pdfUrl: string | null;
};
```

## 7. Admin certificate flow
**Current State**: Admins generate certificates via `POST /certificates/:enrollmentId/generate`. The response currently returns the raw certificate row.
**Recommendation**: 
- Update the generation response to include the full `CertificateTemplateDto`.
- This allows the Admin UI to immediately open the "Preview" dialog after generation without an extra fetch.

## 8. Learner profile certificate flow
**Current State**: `GET /certificates/me` provides a list but lacks `language`, `level`, and `candidateName`.
**Recommendation**:
- Update the paginated response to include `CertificateTemplateDto` in the `data` array.
- This ensures the "Voir certificat" button has all data available locally to render the dialog.

## 9. Public verification flow
**Current State**: `GET /public/certificates/:verificationCode` returns a simplified object.
**Recommendation**:
- The public endpoint should return the same `CertificateTemplateDto` but ensure no sensitive user data (like email or private notes) is included.
- The template fields requested are safe for public display as they are part of the certificate's face.

## 10. Data derivation rules
- **candidateName**: `firstName.trim() + " " + lastName.trim()`.
- **academicYear**: 
  - If `startDate` is Sept-Dec: `${year} / ${year + 1}`.
  - If `startDate` is Jan-June: `${year - 1} / ${year}`.
  - Fallback: The year of `startDate`.
- **durationHours**: 
  - Sum of `(endAt - startAt)` for all non-cancelled sessions in the formation.
  - If no sessions exist, return `null` or `0`.
- **completionDate**: 
  - Preferred: `formations.endDate`.
  - Fallback: `certificates.issuedAt`.
- **verificationUrl**: 
  - Use `APP_PUBLIC_URL` from environment to build an absolute link (e.g., `https://ceil.univ-annaba.dz/verify/:code`).

## 11. Missing fields / backend gaps
- **`sessionLabel`**: This is not currently in the database. If this must be accurate (e.g., "Session Automne"), it may need to be added as an optional field to the `formations` table.
- **`durationHours`**: Calculating this on the fly for every certificate in a list might be heavy. We can either:
  1. Calculate it dynamically for the single "Detail/Preview" view.
  2. Cache it on the `formations` table.
  *Recommendation*: Start with dynamic calculation for the detail/preview view.

## 12. Recommended backend changes
1.  **Repository Update**: Modify `CertificatesRepository.findByVerificationCode` and `findByStudentPaginated` to join `languages` and `formation_levels`.
2.  **Service Logic**: Implement a helper method in `CertificatesService` to map the joined database row to the `CertificateTemplateDto`, applying derivation rules for dates and durations.
3.  **New Endpoint**: (Optional but cleaner) `GET /certificates/:id` for Admin to fetch full template data for a specific certificate.

## 13. Frontend integration notes
The frontend should use the `CertificateTemplateDto` to populate the `CeilCertificateDialog`.

**Mapping Logic Suggestion**:
```typescript
function mapBackendToTemplate(cert: CertificateTemplateDto): CertificateData {
  return {
    candidateName: cert.candidateName,
    formationTitle: cert.formationTitle,
    language: cert.language,
    level: cert.level,
    academicYear: cert.academicYear ?? "—",
    sessionLabel: cert.sessionLabel ?? "Session CEIL",
    durationHours: cert.durationHours ?? 0,
    completionDate: formatDate(cert.completionDate),
    certificateNumber: cert.certificateNumber,
    verificationCode: cert.verificationCode,
    verificationUrl: cert.verificationUrl,
  };
}
```

## 14. Tests and QA checklist
- [ ] Verification code generates a valid 64-char hex string.
- [ ] `candidateName` correctly handles mixed-case names and whitespace.
- [ ] `durationHours` accurately sums sessions and ignores cancelled ones.
- [ ] `academicYear` correctly spans years for winter formations.
- [ ] Public endpoint is accessible without authentication.
- [ ] Learner can only see their own certificates in `/me`.

## 15. Final client checklist
- [ ] Confirm if `sessionLabel` (e.g., "Printemps") needs a dedicated DB field.
- [ ] Confirm the exact date format preferred for `completionDate`.
- [ ] Provide the `APP_PUBLIC_URL` for absolute verification links.
