import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { CertificatesRepository } from '@lib/repositories/certificates/certificates.repository';
import { EnrollmentsRepository } from '@lib/repositories/enrollments/enrollments.repository';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { FindMyCertificatesQueryDto } from './dto/find-my-certificates-query.dto';

@Injectable()
export class CertificatesService {
  constructor(
    private readonly certificatesRepository: CertificatesRepository,
    private readonly enrollmentsRepository: EnrollmentsRepository,
  ) {}

  async generateCertificate(enrollmentId: string) {
    const enrollment = await this.enrollmentsRepository.findById(enrollmentId);
    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    const existing =
      await this.certificatesRepository.findByEnrollment(enrollmentId);
    if (existing) {
      if (process.env.NODE_ENV === 'development') {
        await this.certificatesRepository.deleteByEnrollment(enrollmentId);
      } else {
        throw new ConflictException(
          'Certificate already generated for this enrollment',
        );
      }
    }

    const year = new Date().getFullYear();
    const serial = randomBytes(2).toString('hex').toUpperCase();
    const certificateNumber = `CEIL-${year}-${serial}`;
    const verificationCode = randomBytes(32).toString('hex');

    const certificate = await this.certificatesRepository.create({
      enrollmentId,
      certificateNumber,
      verificationCode,
    });

    return {
      certificate: {
        ...certificate,
        verificationUrl: `/api/v1/public/certificates/${certificate.verificationCode}`,
      },
      verificationUrl: `/api/v1/public/certificates/${certificate.verificationCode}`,
    };
  }

  async getMyCertificates(user: AuthUser, query: FindMyCertificatesQueryDto) {
    const response = await this.certificatesRepository.findByStudentPaginated(
      user.id,
      query,
    );

    return {
      ...response,
      data: response.data.map((cert) => ({
        ...cert,
        verificationUrl: `/api/v1/public/certificates/${cert.verificationCode}`,
      })),
    };
  }

  async verifyCertificate(verificationCode: string) {
    const record =
      await this.certificatesRepository.findByVerificationCode(
        verificationCode,
      );
    if (!record) {
      throw new NotFoundException('Certificate not found');
    }

    let teacherName: string | null = null;
    const teacher = await this.certificatesRepository.findTeacherByFormationId(
      record.formation.id,
    );
    if (teacher) {
      teacherName = `${teacher.firstName} ${teacher.lastName}`;
    }

    return {
      status: 'VALID',
      certificateNumber: record.certificateNumber,
      issuedAt: record.issuedAt,
      studentName: `${record.student.firstName} ${record.student.lastName}`,
      studentMatricule: record.student.matricule,
      formationTitle: record.formation.title,
      teacherName,
      pdfUrl: record.pdfUrl ?? null,
    };
  }
}
