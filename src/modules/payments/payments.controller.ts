import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import {
  FindAdminPaymentsQueryDto,
  FindMyPaymentsQueryDto,
} from './dto/find-payments-query.dto';
import { AdminPaymentStatsDto } from './dto/admin-payment-stats.dto';
import { Auth } from '@lib/decorators/auth.decorator';
import { CurrentUser } from '@lib/decorators/current-user.decorator';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { UserRole } from '@modules/auth/types/user-role.type';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('webhook/chargily')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Chargily Pay webhook (signature required on raw JSON body)',
    description:
      'Payment confirmation is authoritative here — success/failure redirects are informational only.',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 400, description: 'Missing body or signature' })
  @ApiResponse({ status: 403, description: 'Invalid signature' })
  async chargilyWebhook(@Req() req: RawBodyRequest<Request>) {
    console.log('Received Chargily webhook with headers:', req.headers);
    const raw = req.rawBody;
    if (!raw || !Buffer.isBuffer(raw)) {
      throw new BadRequestException('Corps brut requis pour la signature');
    }
    return this.paymentsService.handleProviderWebhook(raw, req.headers);
  }

  @Get('me')
  @Auth(UserRole.APPRENANT)
  @ApiOperation({ summary: 'My payments (APPRENANT)' })
  async myPayments(
    @CurrentUser() user: AuthUser,
    @Query() query: FindMyPaymentsQueryDto,
  ) {
    const page = await this.paymentsService.findMyPayments(user.id, query);
    return {
      ...page,
      data: page.data.map((row) => ({
        payment: this.paymentsService.mapToCheckoutDto(row.payment),
        formationTitle: row.formationTitle,
        enrollmentStatus: row.enrollmentStatus,
      })),
    };
  }

  @Get('admin/stats')
  @Auth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Payment counters for admin dashboard' })
  async adminStats(): Promise<AdminPaymentStatsDto> {
    return this.paymentsService.adminStats();
  }

  @Get()
  @Auth(UserRole.ADMIN)
  @ApiOperation({ summary: 'List payments (ADMIN)' })
  async adminList(@Query() query: FindAdminPaymentsQueryDto) {
    const page = await this.paymentsService.findAdminPayments(query);
    return {
      ...page,
      data: page.data.map((row) => ({
        payment: this.paymentsService.mapToCheckoutDto(row.payment),
        student: {
          firstName: row.studentFirstName,
          lastName: row.studentLastName,
          email: row.studentEmail,
          matricule: row.studentMatricule,
        },
        formationTitle: row.formationTitle,
        formationPrice:
          row.formationPrice != null ? String(row.formationPrice) : null,
        enrollmentStatus: row.enrollmentStatus,
      })),
    };
  }

  @Get(':id')
  @Auth(UserRole.ADMIN, UserRole.APPRENANT)
  @ApiOperation({ summary: 'Payment by id (owner or ADMIN)' })
  async one(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const pay = await this.paymentsService.findOneForViewer(id, user);
    return this.paymentsService.mapToCheckoutDto(pay);
  }
}
