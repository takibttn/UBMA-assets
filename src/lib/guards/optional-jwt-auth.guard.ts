import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { AuthUser } from '@modules/auth/types/auth-user.type';

/**
 * Runs JWT validation when a Bearer token is present; never blocks the route.
 * Use on public catalog endpoints that gain personalization when the user is logged in.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<{ headers: { authorization?: string } }>();
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return true;
    }
    try {
      await super.canActivate(context);
    } catch {
      /* Invalid or expired token: treat as anonymous for public routes */
    }
    return true;
  }

  override handleRequest<TUser = AuthUser>(
    err: Error | undefined,
    user: TUser | false,
  ): TUser | undefined {
    if (err || !user) {
      return undefined;
    }
    return user;
  }
}
