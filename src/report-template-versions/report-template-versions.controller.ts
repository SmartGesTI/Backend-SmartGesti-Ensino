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
import { ReportTemplateVersionsService } from './report-template-versions.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreateReportTemplateVersionDto } from './dto/create-report-template-version.dto';
import { ReportTemplateVersion } from '../common/types';

@Controller('report-template-versions')
@UseGuards(JwtAuthGuard)
export class ReportTemplateVersionsController {
  constructor(
    private service: ReportTemplateVersionsService,
    private usersService: UsersService,
    private tenantsService: TenantsService,
  ) {}

  private async getTenantId(subdomain: string | undefined): Promise<string> {
    if (!subdomain) throw new BadRequestException('Subdomain é obrigatório');
    const tenant = await this.tenantsService.getTenantBySubdomain(subdomain);
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    return tenant.id;
  }

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Query('reportTemplateId') reportTemplateId?: string,
    @Query('isCurrent') isCurrent?: string,
  ): Promise<ReportTemplateVersion[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.findAll(tenantId, {
      reportTemplateId,
      isCurrent: isCurrent !== undefined ? isCurrent === 'true' : undefined,
    });
  }

  @Get('current/:reportTemplateId')
  async getCurrentVersion(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('reportTemplateId', ParseUUIDPipe) reportTemplateId: string,
  ): Promise<ReportTemplateVersion> {
    const tenantId = await this.getTenantId(subdomain);
    const version = await this.service.getCurrentVersion(
      reportTemplateId,
      tenantId,
    );
    if (!version)
      throw new NotFoundException(
        `Nenhuma versão atual encontrada para template '${reportTemplateId}'`,
      );
    return version;
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReportTemplateVersion> {
    const tenantId = await this.getTenantId(subdomain);
    const version = await this.service.findOne(id, tenantId);
    if (!version)
      throw new NotFoundException(
        `Report template version com id '${id}' não encontrada`,
      );
    return version;
  }

  @Post('create-version')
  async createVersion(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateReportTemplateVersionDto,
  ): Promise<ReportTemplateVersion> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.service.createVersion(tenantId, dto, dbUser?.id);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    const tenantId = await this.getTenantId(subdomain);
    await this.service.remove(id, tenantId);
    return { message: 'Report template version removida com sucesso' };
  }
}
