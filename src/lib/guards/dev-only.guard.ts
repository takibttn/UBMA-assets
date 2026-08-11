import { Injectable, CanActivate, ForbiddenException } from '@nestjs/common';

@Injectable()
export class DevOnlyGuard implements CanActivate {
  canActivate(): boolean {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('This endpoint is disabled in production');
    }
    return true;
  }
}
