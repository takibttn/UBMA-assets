import { forwardRef, Inject, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CertificatesRepository } from '@lib/repositories/certificates/certificates.repository';
import { EnrollmentsRepository } from '@lib/repositories/enrollments/enrollments.repository';
import type { EnrollmentAttendanceSummary } from '@lib/repositories/enrollments/enrollments.repository';
import { FormationsRepository } from '@lib/repositories/formations/formations.repository';
import { UsersRepository } from '@lib/repositories/users/users.repository';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { mapFormationBaseDto } from '@lib/formations/formation-base.mapper';
import { PaymentsService } from '@modules/payments/payments.service';
import type { Enrollment } from '@/database/schema';

export const EMPTY_ATTENDANCE: EnrollmentAttendanceSummary = {
  presentCount: 0,
  absentCount: 0,
  lateCount: 0,
  excusedCount: 0,
  unmarkedCount: 0,
  totalSessionsCount: 0,
  attendanceRate: 0,
};

export type JoinedStudentIdentity = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  matricule: string | null;
};

export abstract class EnrollmentsServiceBase {
  protected readonly enrollmentsRepository: EnrollmentsRepository;
  protected readonly formationsRepository: FormationsRepository;
  protected readonly usersRepository: UsersRepository;
  protected readonly notificationsService: NotificationsService;
  protected readonly configService: ConfigService;
  protected readonly certificatesRepository: CertificatesRepository;
  protected readonly paymentsService: PaymentsService;

  constructor(
    @Inject(EnrollmentsRepository)
    enrollmentsRepository: EnrollmentsRepository,
    @Inject(FormationsRepository) formationsRepository: FormationsRepository,
    @Inject(UsersRepository) usersRepository: UsersRepository,
    @Inject(NotificationsService) notificationsService: NotificationsService,
    @Inject(ConfigService) configService: ConfigService,
    @Inject(CertificatesRepository)
    certificatesRepository: CertificatesRepository,
    @Inject(forwardRef(() => PaymentsService))
    paymentsService: PaymentsService,
  ) {
    this.enrollmentsRepository = enrollmentsRepository;
    this.formationsRepository = formationsRepository;
    this.usersRepository = usersRepository;
    this.notificationsService = notificationsService;
    this.configService = configService;
    this.certificatesRepository = certificatesRepository;
    this.paymentsService = paymentsService;
  }

  protected mapJoinedFormationCard(formation: {
    id: string;
    title: string;
    description: string | null;
    price: unknown;
    capacity: number | null;
    isSaleOpen: boolean;
    startDate: Date | null;
    endDate: Date | null;
    createdAt: Date;
    enrolledCount: unknown;
    language: {
      id: string | null;
      name: string | null;
      code: string | null;
    } | null;
    level: {
      id: string | null;
      code: string | null;
      name: string | null;
    } | null;
  }) {
    return mapFormationBaseDto(
      {
        id: formation.id,
        title: formation.title,
        description: formation.description,
        price: formation.price,
        capacity: formation.capacity,
        isSaleOpen: formation.isSaleOpen,
        startDate: formation.startDate,
        endDate: formation.endDate,
        createdAt: formation.createdAt,
        enrolledCount: formation.enrolledCount,
        language: formation.language,
        level: formation.level,
      },
      { includeCreatedAt: true },
    );
  }

  protected async buildEnrollmentWithFormation(enrollment: Enrollment) {
    const detailed =
      await this.formationsRepository.findByIdWithLanguageAndLevel(
        enrollment.formationId,
      );
    if (!detailed) {
      throw new NotFoundException('Formation not found');
    }
    return {
      id: enrollment.id,
      studentId: enrollment.studentId,
      formationId: enrollment.formationId,
      status: enrollment.status,
      enrolledAt: enrollment.enrolledAt.toISOString(),
      formation: mapFormationBaseDto(
        {
          id: detailed.id,
          title: detailed.title,
          description: detailed.description,
          price: detailed.price,
          capacity: detailed.capacity,
          isSaleOpen: detailed.isSaleOpen,
          startDate: detailed.startDate,
          endDate: detailed.endDate,
          createdAt: detailed.createdAt,
          enrolledCount: detailed.enrolledCount,
          reservedCount: detailed.reservedCount,
          language: detailed.language,
          level: detailed.level,
        },
        { includeCreatedAt: true },
      ),
    };
  }

  protected async triggerEnrollmentNotification(
    studentId: string,
    formationTitle: string,
    enrollmentId: string,
  ): Promise<void> {
    const adminEmail =
      this.configService.get<string>('ADMIN_NOTIFICATION_EMAIL') ?? '';

    const student = await this.usersRepository.findById(studentId);

    if (!student) return;

    await this.notificationsService.sendEnrollmentNotification({
      studentFullName: `${student.firstName} ${student.lastName}`,
      studentMatricule: student.matricule,
      formationTitle,
      teacherEmail: undefined,
      adminEmail: adminEmail || undefined,
      enrollmentId,
    });
  }
}
