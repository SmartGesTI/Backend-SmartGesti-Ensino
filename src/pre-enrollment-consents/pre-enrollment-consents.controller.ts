import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PreEnrollmentConsentsService } from './pre-enrollment-consents.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreatePreEnrollmentConsentDto } from './dto/create-pre-enrollment-consent.dto';
import { PreEnrollmentConsent } from '../common/types';

@Controller('pre-enrollment-consents')
@UseGuards(JwtAuthGuard)
export class PreEnrollmentConsentsController {
  constructor(
    private service: PreEnrollmentConsentsService,
    private tenantsService: TenantsService,
    private logger: LoggerService,
  ) {}

  private async getTenantId(subdomain: string | undefined): Promise<string> {
    if (!subdomain) {
      throw new BadRequestException('Subdomain é obrigatório');
    }

    const tenant = await this.tenantsService.getTenantBySubdomain(subdomain);
    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado');
    }

    return tenant.id;
  }

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Query('schoolId') schoolId?: string,
    @Query('householdId') householdId?: string,
    @Query('applicationId') applicationId?: string,
    @Query('consentType') consentType?: string,
  ): Promise<PreEnrollmentConsent[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.findAll(tenantId, {
      schoolId,
      householdId,
      applicationId,
      consentType,
    });
  }

  @Get('verify')
  async verify(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Query('householdId') householdId: string,
    @Query('consentType') consentType: string,
  ): Promise<{ verified: boolean; consent?: PreEnrollmentConsent }> {
    if (!householdId || !consentType) {
      throw new BadRequestException(
        'householdId e consentType são obrigatórios',
      );
    }

    const tenantId = await this.getTenantId(subdomain);
    return this.service.verify(tenantId, householdId, consentType);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PreEnrollmentConsent> {
    const tenantId = await this.getTenantId(subdomain);
    const consent = await this.service.findOne(id, tenantId);

    if (!consent) {
      throw new NotFoundException(`Consent com id '${id}' não encontrado`);
    }

    return consent;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreatePreEnrollmentConsentDto,
  ): Promise<PreEnrollmentConsent> {
    const tenantId = await this.getTenantId(subdomain);

    this.logger.log(
      'Creating pre-enrollment consent',
      'PreEnrollmentConsentsController',
      {
        userSub: user.sub,
        type: dto.consent_type,
      },
    );

    return this.service.create(tenantId, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    const tenantId = await this.getTenantId(subdomain);
    await this.service.remove(id, tenantId);

    return { message: 'Consent removido com sucesso' };
  }
}
