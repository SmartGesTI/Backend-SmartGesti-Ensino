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
import { MetricValuesService } from './metric-values.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import {
  CreateMetricValueDto,
  ComputeMetricValuesDto,
} from './dto/create-metric-value.dto';
import { MetricValue } from '../common/types';

@Controller('metric-values')
@UseGuards(JwtAuthGuard)
export class MetricValuesController {
  constructor(
    private service: MetricValuesService,
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
    @Query('metricDefinitionId') metricDefinitionId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('gradingPeriodId') gradingPeriodId?: string,
    @Query('targetKind') targetKind?: string,
    @Query('studentId') studentId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<MetricValue[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.findAll(tenantId, {
      schoolId,
      metricDefinitionId,
      academicYearId,
      gradingPeriodId,
      targetKind,
      studentId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MetricValue> {
    const tenantId = await this.getTenantId(subdomain);
    const value = await this.service.findOne(id, tenantId);
    if (!value)
      throw new NotFoundException(`Metric value com id '${id}' não encontrado`);
    return value;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateMetricValueDto,
  ): Promise<MetricValue> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.service.create(tenantId, dto, dbUser?.id);
  }

  @Post('compute')
  async compute(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: ComputeMetricValuesDto,
  ): Promise<{ message: string; count: number }> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    this.logger.log('Compute metric values', 'MetricValuesController', {
      userSub: user.sub,
    });
    return this.service.compute(tenantId, dto, dbUser?.id);
  }

  @Post(':id/recompute')
  async recompute(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MetricValue> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.service.recompute(id, tenantId, dbUser?.id);
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
    return { message: 'Metric value removido com sucesso' };
  }
}
