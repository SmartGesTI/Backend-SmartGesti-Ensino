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
import { PreEnrollmentEventsService } from './pre-enrollment-events.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreatePreEnrollmentEventDto } from './dto/create-pre-enrollment-event.dto';
import { PreEnrollmentEvent } from '../common/types';

@Controller('pre-enrollment-events')
@UseGuards(JwtAuthGuard)
export class PreEnrollmentEventsController {
  constructor(
    private service: PreEnrollmentEventsService,
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
    @Query('householdId') householdId?: string,
    @Query('applicationId') applicationId?: string,
    @Query('eventType') eventType?: string,
    @Query('actorType') actorType?: string,
    @Query('limit') limit?: string,
  ): Promise<PreEnrollmentEvent[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.findAll(tenantId, {
      householdId,
      applicationId,
      eventType,
      actorType,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('timeline/:householdId')
  async getTimeline(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Query('applicationId') applicationId?: string,
    @Query('limit') limit?: string,
  ): Promise<PreEnrollmentEvent[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.getTimeline(tenantId, householdId, {
      applicationId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PreEnrollmentEvent> {
    const tenantId = await this.getTenantId(subdomain);
    const event = await this.service.findOne(id, tenantId);

    if (!event) {
      throw new NotFoundException(`Event com id '${id}' não encontrado`);
    }

    return event;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreatePreEnrollmentEventDto,
  ): Promise<PreEnrollmentEvent> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log(
      'Creating pre-enrollment event',
      'PreEnrollmentEventsController',
      {
        userSub: user.sub,
        type: dto.event_type,
      },
    );

    return this.service.create(tenantId, dto, dbUser?.id);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    const tenantId = await this.getTenantId(subdomain);
    await this.service.remove(id, tenantId);

    return { message: 'Event removido com sucesso' };
  }
}
