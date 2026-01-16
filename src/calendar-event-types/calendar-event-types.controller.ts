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
import { CalendarEventTypesService } from './calendar-event-types.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreateCalendarEventTypeDto } from './dto/create-calendar-event-type.dto';
import { UpdateCalendarEventTypeDto } from './dto/update-calendar-event-type.dto';
import type { CalendarEventType, CalendarEventCategory } from '../common/types';

@Controller('calendar-event-types')
@UseGuards(JwtAuthGuard)
export class CalendarEventTypesController {
  constructor(
    private calendarEventTypesService: CalendarEventTypesService,
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
    @Query('category') category?: CalendarEventCategory,
    @Query('isSystem') isSystem?: string,
  ): Promise<CalendarEventType[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.calendarEventTypesService.findAll(tenantId, {
      category,
      isSystem: isSystem !== undefined ? isSystem === 'true' : undefined,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CalendarEventType> {
    const tenantId = await this.getTenantId(subdomain);
    const eventType = await this.calendarEventTypesService.findOne(
      id,
      tenantId,
    );

    if (!eventType) {
      throw new NotFoundException(
        `Tipo de evento com id '${id}' não encontrado`,
      );
    }

    return eventType;
  }

  @Get('slug/:slug')
  async findBySlug(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('slug') slug: string,
  ): Promise<CalendarEventType> {
    const tenantId = await this.getTenantId(subdomain);
    const eventType = await this.calendarEventTypesService.findBySlug(
      slug,
      tenantId,
    );

    if (!eventType) {
      throw new NotFoundException(
        `Tipo de evento com slug '${slug}' não encontrado`,
      );
    }

    return eventType;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateCalendarEventTypeDto,
  ): Promise<CalendarEventType> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.calendarEventTypesService.create(tenantId, dto, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCalendarEventTypeDto,
  ): Promise<CalendarEventType> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.calendarEventTypesService.update(id, tenantId, dto, dbUser?.id);
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

    await this.calendarEventTypesService.remove(id, tenantId, dbUser.id);

    return { message: 'Tipo de evento removido com sucesso' };
  }

  @Post(':id/restore')
  async restore(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    await this.calendarEventTypesService.restore(id, tenantId, dbUser.id);

    return { message: 'Tipo de evento restaurado com sucesso' };
  }
}
