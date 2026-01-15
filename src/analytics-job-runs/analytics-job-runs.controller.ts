import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AnalyticsJobRunsService } from './analytics-job-runs.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import {
  TriggerAnalyticsJobDto,
  UpdateJobStatusDto,
} from './dto/create-analytics-job-run.dto';
import { AnalyticsJobRun } from '../common/types';

@Controller('analytics-job-runs')
@UseGuards(JwtAuthGuard)
export class AnalyticsJobRunsController {
  constructor(
    private service: AnalyticsJobRunsService,
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
    @Query('jobType') jobType?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ): Promise<AnalyticsJobRun[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.findAll(tenantId, {
      schoolId,
      jobType,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AnalyticsJobRun> {
    const tenantId = await this.getTenantId(subdomain);
    const job = await this.service.findOne(id, tenantId);
    if (!job)
      throw new NotFoundException(
        `Analytics job run com id '${id}' não encontrado`,
      );
    return job;
  }

  @Post('trigger')
  async trigger(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: TriggerAnalyticsJobDto,
  ): Promise<AnalyticsJobRun> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    this.logger.log('Triggering analytics job', 'AnalyticsJobRunsController', {
      userSub: user.sub,
      jobType: dto.job_type,
    });
    return this.service.trigger(tenantId, dto, dbUser?.id);
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobStatusDto,
  ): Promise<AnalyticsJobRun> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.updateStatus(id, tenantId, dto);
  }

  @Patch(':id/cancel')
  async cancel(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AnalyticsJobRun> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.cancel(id, tenantId);
  }
}
