import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { TeachersService } from '../teachers.service';

@Injectable()
export class TeacherFormationAccessGuard implements CanActivate {
  private readonly logger = new Logger(TeacherFormationAccessGuard.name);

  constructor(private readonly teachersService: TeachersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user: AuthUser;
      method: string;
      url: string;
      params: { formationId?: string };
    }>();

    const teacherId = request.user?.id;
    const formationId = request.params?.formationId;
    if (!teacherId || !formationId) {
      this.logger.warn(
        `Missing teacherId or formationId for ${request.method} ${request.url}`,
      );
      throw new ForbiddenException('You cannot access this formation');
    }

    const canAccess = await this.teachersService.isTeacherAssignedToFormation(
      teacherId,
      formationId,
    );
    if (!canAccess) {
      this.logger.warn(
        `Teacher ${teacherId} denied access to formation ${formationId}`,
      );
      throw new ForbiddenException('You cannot access this formation');
    }

    return true;
  }
}
