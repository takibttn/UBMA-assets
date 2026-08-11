import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

type AuthSuccessBody = {
  accessToken: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    accountType: string | null;
    email: string | null;
  };
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Register external learner (APPRENANT + EXTERNAL_LEARNER); returns JWT',
  })
  @ApiCreatedResponse({
    description: 'User created; same shape as login',
  })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  register(@Body() dto: RegisterDto): Promise<AuthSuccessBody> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Login: STUDENT (matricule + bacYear + password), EMAIL (learner email + password), or TEACHER (teacher email + password)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns access token and user info',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: LoginDto): Promise<AuthSuccessBody> {
    return this.authService.login(dto);
  }
}
