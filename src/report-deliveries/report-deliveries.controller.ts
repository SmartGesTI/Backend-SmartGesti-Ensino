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
import { ReportDeliveriesService } from './report-deliveries.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import {
  CreateReportDeliveryDto,
  UpdateReportDeliveryStatusDto,
} from './dto/create-report-delivery.dto';
import { ReportDelivery } from '../common/types';

@Controller('report-deliveries')
@UseGuards(JwtAuthGuard)
export class ReportDeliveriesController {
  constructor(
    private service: ReportDeliveriesService,
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
    @Query('reportRunId') reportRunId?: string,
    @Query('channel') channel?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ): Promise<ReportDelivery[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.findAll(tenantId, {
      reportRunId,
      channel,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReportDelivery> {
    const tenantId = await this.getTenantId(subdomain);
    const delivery = await this.service.findOne(id, tenantId);
    if (!delivery)
      throw new NotFoundException(
        `Report delivery com id '${id}' não encontrada`,
      );
    return delivery;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateReportDeliveryDto,
  ): Promise<ReportDelivery> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.service.create(tenantId, dto, dbUser?.id);
  }

  @Post(':id/send')
  async send(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReportDelivery> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.send(id, tenantId);
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReportDeliveryStatusDto,
  ): Promise<ReportDelivery> {
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
    await this.service.remove(id, tenantId);
    return { message: 'Report delivery removida com sucesso' };
  }
}
