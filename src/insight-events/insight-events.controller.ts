import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { InsightEventsService } from './insight-events.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreateInsightEventDto } from './dto/create-insight-event.dto';
import { InsightEvent } from '../common/types';

@Controller('insight-events')
@UseGuards(JwtAuthGuard)
export class InsightEventsController {
  constructor(
    private service: InsightEventsService,
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
    @Query('eventType') eventType?: string,
    @Query('limit') limit?: string,
  ): Promise<InsightEvent[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.findAll(tenantId, {
      insightInstanceId,
      eventType,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('timeline/:insightInstanceId')
  async getTimeline(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('insightInstanceId', ParseUUIDPipe) insightInstanceId: string,
    @Query('limit') limit?: string,
  ): Promise<InsightEvent[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.getTimeline(
      tenantId,
      insightInstanceId,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InsightEvent> {
    const tenantId = await this.getTenantId(subdomain);
    const event = await this.service.findOne(id, tenantId);
    if (!event)
      throw new NotFoundException(
        `Insight event com id '${id}' não encontrado`,
      );
    return event;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateInsightEventDto,
  ): Promise<InsightEvent> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.service.create(tenantId, dto, dbUser?.id);
  }
}
