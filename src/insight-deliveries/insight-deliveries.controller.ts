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
import { InsightDeliveriesService } from './insight-deliveries.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import {
  CreateInsightDeliveryDto,
  UpdateDeliveryStatusDto,
} from './dto/create-insight-delivery.dto';
import { InsightDelivery } from '../common/types';

@Controller('insight-deliveries')
@UseGuards(JwtAuthGuard)
export class InsightDeliveriesController {
  constructor(
    private service: InsightDeliveriesService,
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
    @Query('insightInstanceId') insightInstanceId?: string,
    @Query('channel') channel?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ): Promise<InsightDelivery[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.findAll(tenantId, {
      insightInstanceId,
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
  ): Promise<InsightDelivery> {
    const tenantId = await this.getTenantId(subdomain);
    const delivery = await this.service.findOne(id, tenantId);
    if (!delivery)
      throw new NotFoundException(
        `Insight delivery com id '${id}' não encontrada`,
      );
    return delivery;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateInsightDeliveryDto,
  ): Promise<InsightDelivery> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.service.create(tenantId, dto, dbUser?.id);
  }

  @Post(':id/send')
  async send(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InsightDelivery> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.send(id, tenantId);
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeliveryStatusDto,
  ): Promise<InsightDelivery> {
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
    return { message: 'Insight delivery removida com sucesso' };
  }
}
