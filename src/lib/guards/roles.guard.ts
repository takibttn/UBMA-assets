import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '@modules/auth/types/user-role.type';
import { AuthUser } from '@modules/auth/types/auth-user.type';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user: AuthUser }>();

    if (!user || !requiredRoles.includes(user.role)) {
      const request = context
        .switchToHttp()
        .getRequest<{ method: string; url: string }>();
      this.logger.warn(
        `Access denied for ${request.method} ${request.url} - required=[${requiredRoles.join(
          ',',
        )}] userRole=${user?.role ?? 'anonymous'}`,
      );
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
