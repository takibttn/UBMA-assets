import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginationQueryDto } from '@common/pagination/dto/pagination-query.dto';
import { FormationFeedbackRepository } from '@lib/repositories/formation-feedback/formation-feedback.repository';
import { EnrollmentsRepository } from '@lib/repositories/enrollments/enrollments.repository';
import { UpsertFormationFeedbackDto } from './dto/upsert-formation-feedback.dto';

@Injectable()
export class FormationFeedbackService {
  constructor(
    private readonly formationFeedbackRepository: FormationFeedbackRepository,
    private readonly enrollmentsRepository: EnrollmentsRepository,
  ) {}

  private async requireEnrolledLearner(studentId: string, formationId: string) {
    const exists =
      await this.formationFeedbackRepository.formationExists(formationId);
    if (!exists) {
      throw new NotFoundException('Formation not found');
    }

    const enrollment =
      await this.enrollmentsRepository.findByStudentAndFormation(
        studentId,
        formationId,
      );
    if (!enrollment || enrollment.status !== 'ENROLLED') {
      throw new ForbiddenException(
        'You must be enrolled in this formation to submit feedback',
      );
    }
    return enrollment;
  }

  async upsertMyFeedback(
    studentId: string,
    formationId: string,
    dto: UpsertFormationFeedbackDto,
  ) {
    const enrollment = await this.requireEnrolledLearner(
      studentId,
      formationId,
    );
    const row = await this.formationFeedbackRepository.upsertFeedback({
      formationId,
      studentId,
      enrollmentId: enrollment.id,
      rating: dto.rating,
      comment: dto.comment ?? null,
    });
    if (!row) {
      throw new NotFoundException('Could not save feedback');
    }
    return this.toFeedbackDto(row);
  }

  async getMyFeedback(studentId: string, formationId: string) {
    await this.requireEnrolledLearner(studentId, formationId);
    const row = await this.formationFeedbackRepository.findFeedbackForStudent(
      formationId,
      studentId,
    );
    return row ? this.toFeedbackDto(row) : null;
  }

  async getAdminFormationFeedback(
    formationId: string,
    query: PaginationQueryDto,
  ) {
    const exists =
      await this.formationFeedbackRepository.formationExists(formationId);
    if (!exists) {
      throw new NotFoundException('Formation not found');
    }

    return this.formationFeedbackRepository.listAdminPaginated({
      formationId,
      page: query.page,
      limit: query.limit,
    });
  }

  private toFeedbackDto(row: {
    id: string;
    formationId: string;
    studentId: string;
    enrollmentId: string | null;
    rating: number;
    comment: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      formationId: row.formationId,
      studentId: row.studentId,
      enrollmentId: row.enrollmentId,
      rating: row.rating,
      comment: row.comment,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
