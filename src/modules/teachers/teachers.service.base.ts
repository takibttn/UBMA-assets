import { ConflictException, Inject, NotFoundException } from '@nestjs/common';
import { EnrollmentsRepository } from '@lib/repositories/enrollments/enrollments.repository';
import { FormationFeedbackRepository } from '@lib/repositories/formation-feedback/formation-feedback.repository';
import { FormationTrackingRepository } from '@lib/repositories/formation-tracking/formation-tracking.repository';
import * as bcrypt from 'bcrypt';
import { AdminTeacherStatsDto } from './dto/admin-teacher-stats.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { FindTeachersQueryDto } from './dto/find-teachers-query.dto';
import { TeachersRepository } from './teachers.repository';

export abstract class TeachersServiceBase {
  protected readonly teachersRepository: TeachersRepository;
  protected readonly enrollmentsRepository: EnrollmentsRepository;
  protected readonly formationTrackingRepository: FormationTrackingRepository;
  protected readonly formationFeedbackRepository: FormationFeedbackRepository;

  constructor(
    @Inject(TeachersRepository) teachersRepository: TeachersRepository,
    @Inject(EnrollmentsRepository)
    enrollmentsRepository: EnrollmentsRepository,
    @Inject(FormationTrackingRepository)
    formationTrackingRepository: FormationTrackingRepository,
    @Inject(FormationFeedbackRepository)
    formationFeedbackRepository: FormationFeedbackRepository,
  ) {
    this.teachersRepository = teachersRepository;
    this.enrollmentsRepository = enrollmentsRepository;
    this.formationTrackingRepository = formationTrackingRepository;
    this.formationFeedbackRepository = formationFeedbackRepository;
  }

  async getTeachers(query: FindTeachersQueryDto) {
    return this.teachersRepository.findTeachersPaginated(query);
  }

  async createTeacher(dto: CreateTeacherDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.teachersRepository.findByEmail(email);
    if (existing) {
      throw new ConflictException('A teacher with this email already exists');
    }
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const teacher = await this.teachersRepository.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email,
      password: hashedPassword,
    });
    const { password: _password, ...safe } = teacher;
    void _password;
    return safe;
  }

  async getAdminTeacherStats(): Promise<AdminTeacherStatsDto> {
    return this.teachersRepository.getAdminTeacherStats();
  }

  async getTeacherById(teacherId: string) {
    const teacher = await this.teachersRepository.findTeacherById(teacherId);
    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    const stats = await this.teachersRepository.findTeacherStats(teacherId);
    return { ...teacher, stats };
  }
}
