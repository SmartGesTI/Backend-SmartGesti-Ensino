import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { MetricDefinitionsService } from './metric-definitions.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import {
  CreateMetricDefinitionDto,
  UpdateMetricDefinitionDto,
} from './dto/create-metric-definition.dto';
import { MetricDefinition } from '../common/types';

@Controller('metric-definitions')
@UseGuards(JwtAuthGuard)
export class MetricDefinitionsController {
  constructor(
    private service: MetricDefinitionsService,
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
    @Query('isActive') isActive?: string,
    @Query('metricKind') metricKind?: string,
  ): Promise<MetricDefinition[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.findAll(tenantId, {
      schoolId,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      metricKind,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MetricDefinition> {
    const tenantId = await this.getTenantId(subdomain);
    const metric = await this.service.findOne(id, tenantId);
    if (!metric) {
      throw new NotFoundException(
        `Metric definition com id '${id}' não encontrada`,
      );
    }
    return metric;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateMetricDefinitionDto,
  ): Promise<MetricDefinition> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    this.logger.log(
      'Creating metric definition',
      'MetricDefinitionsController',
      {
        userSub: user.sub,
        key: dto.key,
      },
    );
    return this.service.create(tenantId, dto, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMetricDefinitionDto,
  ): Promise<MetricDefinition> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.service.update(id, tenantId, dto, dbUser?.id);
  }

  @Post(':id/activate')
  async activate(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MetricDefinition> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.service.activate(id, tenantId, dbUser?.id);
  }

  @Post(':id/deactivate')
  async deactivate(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MetricDefinition> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.service.deactivate(id, tenantId, dbUser?.id);
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
    await this.service.remove(id, tenantId, dbUser.id);
    return { message: 'Metric definition removida com sucesso' };
  }
}
