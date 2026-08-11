import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export enum LoginType {
  STUDENT = 'STUDENT',
  EMAIL = 'EMAIL',
  TEACHER = 'TEACHER',
}

export class LoginDto {
  @ApiProperty({ enum: LoginType })
  @IsEnum(LoginType)
  loginType!: LoginType;

  @ApiPropertyOptional({ example: 2020 })
  @ValidateIf((o: LoginDto) => o.loginType === LoginType.STUDENT)
  @IsInt()
  @Min(1900)
  bacYear?: number;

  @ApiPropertyOptional({ example: '20202345' })
  @ValidateIf((o: LoginDto) => o.loginType === LoginType.STUDENT)
  @IsString()
  @IsNotEmpty()
  matricule?: string;

  @ApiPropertyOptional({ example: 'learner@example.com' })
  @ValidateIf(
    (o: LoginDto) =>
      o.loginType === LoginType.EMAIL || o.loginType === LoginType.TEACHER,
  )
  @IsEmail()
  @IsNotEmpty()
  email?: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password!: string;
}
