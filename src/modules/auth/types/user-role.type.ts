export const UserRole = {
  ADMIN: 'ADMIN',
  ENSEIGNANT: 'ENSEIGNANT',
  APPRENANT: 'APPRENANT',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];
