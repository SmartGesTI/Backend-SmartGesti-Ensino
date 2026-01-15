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
import { ConsentsService } from './consents.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreateConsentDto, RevokeConsentDto } from './dto/create-consent.dto';
import { Consent } from '../common/types';

@Controller('consents')
@UseGuards(JwtAuthGuard)
export class ConsentsController {
  constructor(
    private consentsService: ConsentsService,
    private usersService: UsersService,
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
    @Query('guardianId') guardianId?: string,
    @Query('studentId') studentId?: string,
    @Query('consentType') consentType?: string,
    @Query('status') status?: string,
  ): Promise<Consent[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.consentsService.findAll(tenantId, {
      schoolId,
      guardianId,
      studentId,
      consentType,
      status,
    });
  }

  @Get('verify')
  async verify(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Query('studentId') studentId?: string,
    @Query('guardianId') guardianId?: string,
    @Query('consentType') consentType?: string,
    @Query('schoolId') schoolId?: string,
  ): Promise<{ valid: boolean; consent?: Consent }> {
    if (!consentType) {
      throw new BadRequestException('consentType é obrigatório');
    }

    const tenantId = await this.getTenantId(subdomain);
    return this.consentsService.verify(tenantId, {
      studentId,
      guardianId,
      consentType,
      schoolId,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Consent> {
    const tenantId = await this.getTenantId(subdomain);
    const consent = await this.consentsService.findOne(id, tenantId);

    if (!consent) {
      throw new NotFoundException(
        `Consentimento com id '${id}' não encontrado`,
      );
    }

    return consent;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateConsentDto,
  ): Promise<Consent> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Creating consent', 'ConsentsController', {
      userSub: user.sub,
      consentType: dto.consent_type,
    });

    return this.consentsService.create(tenantId, dto, dbUser?.id);
  }

  @Post(':id/revoke')
  async revoke(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevokeConsentDto,
  ): Promise<Consent> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    this.logger.log('Revoking consent', 'ConsentsController', {
      userSub: user.sub,
      consentId: id,
    });

    return this.consentsService.revoke(id, tenantId, dto, dbUser.id);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    await this.consentsService.remove(id, tenantId, dbUser.id);

    return { message: 'Consentimento removido com sucesso' };
  }
}
