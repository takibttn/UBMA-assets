import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { UserRole } from '@modules/auth/types/user-role.type';
import {
  FindAdminPaymentsQueryDto,
  FindMyPaymentsQueryDto,
} from './dto/find-payments-query.dto';
import { PaymentsWebhookService } from './payments.service.webhook';

export abstract class PaymentsListService extends PaymentsWebhookService {
  async findMyPayments(userId: string, query: FindMyPaymentsQueryDto) {
    return this.paymentsRepository.findMyPaymentsPaginated({
      studentId: userId,
      page: query.page,
      limit: query.limit,
      status: query.status,
      formationId: query.formationId,
    });
  }

  async findAdminPayments(query: FindAdminPaymentsQueryDto) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && Number.isNaN(from.getTime())) {
      throw new BadRequestException('from invalide');
    }
    if (to && Number.isNaN(to.getTime())) {
      throw new BadRequestException('to invalide');
    }
    return this.paymentsRepository.findAdminPaymentsPaginated({
      page: query.page,
      limit: query.limit,
      status: query.status,
      formationId: query.formationId,
      studentId: query.studentId,
      search: query.search,
      from,
      to,
    });
  }

  async adminStats() {
    return this.paymentsRepository.adminStats();
  }

  async findOneForViewer(id: string, user: AuthUser) {
    const pay = await this.paymentsRepository.findById(id);
    if (!pay) {
      throw new NotFoundException('Paiement introuvable');
    }
    if (user.role !== UserRole.ADMIN && pay.studentId !== user.id) {
      throw new ForbiddenException();
    }
    return pay;
  }
}
