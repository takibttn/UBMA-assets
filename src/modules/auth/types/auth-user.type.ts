import { UserRole } from './user-role.type';

export interface AuthUser {
  id: string;
  role: UserRole;
}
