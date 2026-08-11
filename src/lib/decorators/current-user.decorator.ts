import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '@modules/auth/types/auth-user.type';

export const CurrentUser = createParamDecorator(
  (
    key: keyof AuthUser | undefined,
    ctx: ExecutionContext,
  ): AuthUser | AuthUser[keyof AuthUser] => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    const user = request.user;
    return key ? user[key] : user;
  },
);
