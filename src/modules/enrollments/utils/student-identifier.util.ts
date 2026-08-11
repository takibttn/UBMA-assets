export type StudentIdentifierKind = 'EMAIL' | 'MATRICULE' | 'NONE';

export function resolveStudentIdentifier(
  email: string | null | undefined,
  matricule: string | null | undefined,
): { identifierKind: StudentIdentifierKind; identifier: string } {
  const em = email?.trim();
  if (em) {
    return { identifierKind: 'EMAIL', identifier: em.toLowerCase() };
  }
  const mat = matricule?.trim();
  if (mat) {
    return { identifierKind: 'MATRICULE', identifier: mat };
  }
  return { identifierKind: 'NONE', identifier: '' };
}
