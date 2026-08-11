import {
  IsString,
  IsInt,
  IsNotEmpty,
  Min,
  Max,
  IsIn,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@modules/auth/types/user-role.type';

const USER_CREATE_ROLES = [UserRole.ADMIN, UserRole.APPRENANT] as const;

export class CreateUserDto {
  @ApiProperty({ example: 'Mohamed' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Benali' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 2020 })
  @IsInt()
  @Min(1990)
  @Max(new Date().getFullYear())
  bacYear: number;

  @ApiProperty({ example: '202012345' })
  @IsString()
  @IsNotEmpty()
  matricule: string;

  @ApiProperty({ example: 'secret123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ enum: USER_CREATE_ROLES, default: UserRole.APPRENANT })
  @IsIn(USER_CREATE_ROLES)
  role: UserRole = UserRole.APPRENANT;
}
