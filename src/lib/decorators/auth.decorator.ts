import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';
import { UserRole } from '@modules/auth/types/user-role.type';

export const Auth = (...roles: UserRole[]) =>
  applyDecorators(
    ...(roles.length ? [Roles(...roles)] : []),
    UseGuards(JwtAuthGuard, RolesGuard),
    ApiBearerAuth(),
  );
