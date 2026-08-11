import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { NewFormation } from '@/database/schema';
import { CreateFormationDto } from './dto/create-formation.dto';
import { UpdateFormationDto } from './dto/update-formation.dto';
import { FormationsReadService } from './formations.service.read';

export abstract class FormationsWriteService extends FormationsReadService {
  async createFormation(user: AuthUser, dto: CreateFormationDto) {
    await this.validateLanguageAndLevel(dto.languageId, dto.levelId);

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (startDate >= endDate) {
      throw new BadRequestException('startDate must be before endDate');
    }

    return this.formationsRepository.create({
      title: dto.title,
      description: dto.description,
      languageId: dto.languageId,
      levelId: dto.levelId,
      creatorId: user.id,
      price: dto.price?.toString() ?? '0',
      capacity: dto.capacity,
      startDate,
      endDate,
    });
  }

  async updateFormation(id: string, dto: UpdateFormationDto) {
    const existing = await this.formationsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Formation not found');
    }

    const effectiveStartDate = dto.startDate
      ? new Date(dto.startDate)
      : existing.startDate;
    const effectiveEndDate = dto.endDate
      ? new Date(dto.endDate)
      : existing.endDate;

    if (
      effectiveStartDate &&
      effectiveEndDate &&
      effectiveStartDate >= effectiveEndDate
    ) {
      throw new BadRequestException('startDate must be before endDate');
    }

    const finalLanguageId = dto.languageId ?? existing.languageId;
    const finalLevelId = dto.levelId ?? existing.levelId;

    if (!finalLanguageId || !finalLevelId) {
      throw new BadRequestException(
        'Formation must have both languageId and levelId',
      );
    }

    if (dto.languageId !== undefined || dto.levelId !== undefined) {
      await this.validateLanguageAndLevel(finalLanguageId, finalLevelId);
    }

    if (
      (dto.startDate !== undefined || dto.endDate !== undefined) &&
      effectiveStartDate &&
      effectiveEndDate &&
      effectiveStartDate < effectiveEndDate
    ) {
      await this.teacherAssignmentsService.validateFormationScheduleForAssignedTeachers();
    }

    const data: Partial<NewFormation> = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.languageId !== undefined) data.languageId = dto.languageId;
    if (dto.levelId !== undefined) data.levelId = dto.levelId;
    if (dto.price !== undefined) data.price = dto.price.toString();
    if (dto.capacity !== undefined) data.capacity = dto.capacity;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = new Date(dto.endDate);

    await this.formationsRepository.update(id, data);
    return this.getFormationById(id);
  }

  async deleteFormation(id: string) {
    await this.getFormationById(id);
    await this.formationsRepository.delete(id);
  }

  async toggleSale(id: string, isSaleOpen: boolean) {
    const formation = await this.getFormationById(id);
    await this.formationsRepository.update(id, { isSaleOpen });

    // Background notification: don't wait for emails to finish
    this.triggerFormationStatusNotification(
      id,
      formation.title,
      isSaleOpen,
    ).catch((err: Error) =>
      process.stdout.write(
        `Failed to trigger status notification: ${err.message}\n`,
      ),
    );

    return this.getFormationById(id);
  }

  private async triggerFormationStatusNotification(
    formationId: string,
    formationTitle: string,
    isSaleOpen: boolean,
  ) {
    const [enrolled, detail] = await Promise.all([
      this.enrollmentsRepository.findByFormation(formationId),
      this.formationsRepository.findByIdWithLanguageAndLevel(formationId),
    ]);

    const learnerEmails = enrolled
      .map((e) => e.student.email)
      .filter((e): e is string => !!e);

    await this.notificationsService.sendFormationStatusNotification({
      formationId,
      formationTitle,
      isSaleOpen,
      learnerEmails,
      teacherEmail: detail?.assignedTeacherEmail ?? undefined,
    });
  }
}
