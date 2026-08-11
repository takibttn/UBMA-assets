import {
  ConflictException,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersRepository } from '@lib/repositories/users/users.repository';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async create(dto: CreateUserDto) {
    if (dto.role === 'ENSEIGNANT') {
      throw new BadRequestException(
        'Teachers are not users — create them via POST /teachers (ADMIN)',
      );
    }
    const existing = await this.usersRepository.findByMatriculeAndYear(
      dto.bacYear,
      dto.matricule,
    );
    if (existing) {
      throw new ConflictException(
        'A user with this bacYear + matricule already exists',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.usersRepository.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      bacYear: dto.bacYear,
      matricule: dto.matricule,
      password: hashedPassword,
      role: dto.role,
      accountType: 'INTERNAL_STUDENT',
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omit password from response
    const { password: _, ...safeUser } = user;
    return safeUser;
  }
}
