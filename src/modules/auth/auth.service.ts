import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersRepository } from '@lib/repositories/users/users.repository';
import { TeachersRepository } from '@modules/teachers/teachers.repository';
import { UserRole } from './types/user-role.type';
import { LoginDto, LoginType } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly teachersRepository: TeachersRepository,
    private readonly jwtService: JwtService,
  ) {}

  private authResponseUser(user: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    accountType: string;
    email: string | null;
  }) {
    const accessToken = this.jwtService.sign({ sub: user.id, role: user.role });
    return { accessToken, user };
  }

  private authResponseTeacher(teacher: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  }) {
    const accessToken = this.jwtService.sign({
      sub: teacher.id,
      role: UserRole.ENSEIGNANT,
    });
    return {
      accessToken,
      user: {
        id: teacher.id,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        role: UserRole.ENSEIGNANT,
        accountType: null as string | null,
        email: teacher.email,
      },
    };
  }

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.usersRepository.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.usersRepository.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email,
      password: hashedPassword,
      dob: dto.dob,
      role: 'APPRENANT',
      accountType: 'EXTERNAL_LEARNER',
      bacYear: null,
      matricule: null,
    });

    return this.authResponseUser({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      accountType: user.accountType,
      email: user.email ?? null,
    });
  }

  async login(dto: LoginDto) {
    if (dto.loginType === LoginType.TEACHER) {
      const teacher = await this.teachersRepository.findByEmail(
        dto.email!.toLowerCase(),
      );
      if (!teacher) {
        throw new UnauthorizedException('Invalid credentials');
      }
      const isPasswordValid = await bcrypt.compare(
        dto.password,
        teacher.password,
      );
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }
      return this.authResponseTeacher({
        id: teacher.id,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        email: teacher.email,
      });
    }

    const user =
      dto.loginType === LoginType.EMAIL
        ? await this.usersRepository.findByEmail(dto.email!.toLowerCase())
        : await this.usersRepository.findByMatriculeAndYear(
            dto.bacYear!,
            dto.matricule!,
          );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.authResponseUser({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      accountType: user.accountType,
      email: user.email ?? null,
    });
  }
}
