import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CertificatesService } from './certificates.service';
import { Auth } from '@lib/decorators/auth.decorator';
import { CurrentUser } from '@lib/decorators/current-user.decorator';
import { AuthUser } from '@modules/auth/types/auth-user.type';
import { UserRole } from '@modules/auth/types/user-role.type';
import { FindMyCertificatesQueryDto } from './dto/find-my-certificates-query.dto';

@ApiTags('certificates')
@Controller()
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Post('certificates/:enrollmentId/generate')
  @Auth(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Generate a certificate for an enrollment (ADMIN only)',
  })
  @ApiResponse({ status: 201 })
  generate(@Param('enrollmentId', ParseUUIDPipe) enrollmentId: string) {
    return this.certificatesService.generateCertificate(enrollmentId);
  }

  @Get('certificates/me')
  @Auth(UserRole.APPRENANT)
  @ApiOperation({ summary: 'Get my certificates (APPRENANT only)' })
  getMyCertificates(
    @CurrentUser() user: AuthUser,
    @Query() query: FindMyCertificatesQueryDto,
  ) {
    return this.certificatesService.getMyCertificates(user, query);
  }

  @Get('public/certificates/:verificationCode')
  @ApiOperation({
    summary: 'Publicly verify a certificate by verification code',
  })
  @ApiResponse({ status: 200, description: 'Certificate is VALID' })
  @ApiResponse({ status: 404, description: 'Certificate not found' })
  verify(@Param('verificationCode') verificationCode: string) {
    return this.certificatesService.verifyCertificate(verificationCode);
  }
}
