import { UserRole } from './user-role.type';

export interface JwtPayload {
  sub: string;
  role: UserRole;
}
