import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ReportRunsService } from './report-runs.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { LoggerService } from '../common/logger/logger.service';
import {
  GenerateReportDto,
  UpdateReportRunStatusDto,
} from './dto/create-report-run.dto';
import { ReportRun } from '../common/types';

@Controller('report-runs')
@UseGuards(JwtAuthGuard)
export class ReportRunsController {
  constructor(
    private service: ReportRunsService,
    private usersService: UsersService,
    private tenantsService: TenantsService,
    private logger: LoggerService,
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
    @Query('schoolId') schoolId?: string,
    @Query('reportTemplateVersionId') reportTemplateVersionId?: string,
    @Query('status') status?: string,
    @Query('targetKind') targetKind?: string,
    @Query('studentId') studentId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('limit') limit?: string,
  ): Promise<ReportRun[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.findAll(tenantId, {
      schoolId,
      reportTemplateVersionId,
      status,
      targetKind,
      studentId,
      academicYearId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReportRun> {
    const tenantId = await this.getTenantId(subdomain);
    const run = await this.service.findOne(id, tenantId);
    if (!run)
      throw new NotFoundException(`Report run com id '${id}' não encontrado`);
    return run;
  }

  @Post('generate')
  async generate(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: GenerateReportDto,
  ): Promise<ReportRun> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    this.logger.log('Generating report', 'ReportRunsController', {
      userSub: user.sub,
    });
    return this.service.generate(tenantId, dto, dbUser?.id);
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReportRunStatusDto,
  ): Promise<ReportRun> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.updateStatus(id, tenantId, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    if (!dbUser) throw new NotFoundException('Usuário não encontrado');
    await this.service.remove(id, tenantId, dbUser.id);
    return { message: 'Report run removido com sucesso' };
  }
}
