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
import { CalendarBlueprintsService } from './calendar-blueprints.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreateCalendarBlueprintDto } from './dto/create-calendar-blueprint.dto';
import { UpdateCalendarBlueprintDto } from './dto/update-calendar-blueprint.dto';
import { CreateBlueprintDayDto } from './dto/create-blueprint-day.dto';
import { UpdateBlueprintDayDto } from './dto/update-blueprint-day.dto';
import { CreateBlueprintEventDto } from './dto/create-blueprint-event.dto';
import { UpdateBlueprintEventDto } from './dto/update-blueprint-event.dto';
import { BulkCreateDaysDto } from './dto/bulk-create-days.dto';
import type {
  CalendarBlueprint,
  CalendarBlueprintDay,
  CalendarBlueprintEvent,
  CalendarBlueprintWithDetails,
  CalendarStage,
  BlueprintStatus,
} from '../common/types';

@Controller('calendar-blueprints')
@UseGuards(JwtAuthGuard)
export class CalendarBlueprintsController {
  constructor(
    private blueprintsService: CalendarBlueprintsService,
    private usersService: UsersService,
    private tenantsService: TenantsService,
    private logger: LoggerService,
  ) {}

  private async getTenantId(subdomain: string | undefined): Promise<string> {
    if (!subdomain) {
      throw new BadRequestException('Subdomain obrigatorio');
    }

    const tenant = await this.tenantsService.getTenantBySubdomain(subdomain);
    if (!tenant) {
      throw new NotFoundException('Tenant nao encontrado');
    }

    return tenant.id;
  }

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Query('year') year?: string,
    @Query('stage') stage?: CalendarStage,
    @Query('status') status?: BlueprintStatus,
    @Query('isSystem') isSystem?: string,
    @Query('jurisdictionCode') jurisdictionCode?: string,
  ): Promise<CalendarBlueprint[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.blueprintsService.findAll(tenantId, {
      year: year ? parseInt(year, 10) : undefined,
      stage,
      status,
      isSystem: isSystem !== undefined ? isSystem === 'true' : undefined,
      jurisdictionCode,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('includeDetails') includeDetails?: string,
  ): Promise<CalendarBlueprint | CalendarBlueprintWithDetails> {
    const tenantId = await this.getTenantId(subdomain);

    if (includeDetails === 'true') {
      const blueprint = await this.blueprintsService.findOneWithDetails(
        id,
        tenantId,
      );
      if (!blueprint) {
        throw new NotFoundException('Blueprint nao encontrado');
      }
      return blueprint;
    }

    const blueprint = await this.blueprintsService.findOne(id, tenantId);
    if (!blueprint) {
      throw new NotFoundException('Blueprint nao encontrado');
    }
    return blueprint;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateCalendarBlueprintDto,
  ): Promise<CalendarBlueprint> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.blueprintsService.create(tenantId, dto, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCalendarBlueprintDto,
  ): Promise<CalendarBlueprint> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.blueprintsService.update(id, tenantId, dto, dbUser?.id);
  }

  @Post(':id/publish')
  async publish(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CalendarBlueprint> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.blueprintsService.publish(id, tenantId, dbUser?.id);
  }

  @Post(':id/archive')
  async archive(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CalendarBlueprint> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.blueprintsService.archive(id, tenantId, dbUser?.id);
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
      throw new NotFoundException('Usuario nao encontrado');
    }
    await this.blueprintsService.remove(id, tenantId, dbUser.id);
    return { message: 'Blueprint removido com sucesso' };
  }

  @Get(':id/days')
  async findDays(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CalendarBlueprintDay[]> {
    const tenantId = await this.getTenantId(subdomain);
    const blueprint = await this.blueprintsService.findOne(id, tenantId);
    if (!blueprint) {
      throw new NotFoundException('Blueprint nao encontrado');
    }
    return this.blueprintsService.findDays(id);
  }

  @Post(':id/days')
  async createDay(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateBlueprintDayDto,
  ): Promise<CalendarBlueprintDay> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.blueprintsService.createDay(id, tenantId, dto, dbUser?.id);
  }

  @Post(':id/days/bulk')
  async createDaysBulk(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BulkCreateDaysDto,
  ): Promise<CalendarBlueprintDay[]> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.blueprintsService.createDaysBulk(
      id,
      tenantId,
      dto.days,
      dbUser?.id,
    );
  }

  @Put(':id/days/:dayId')
  async updateDay(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('dayId', ParseUUIDPipe) dayId: string,
    @Body() dto: UpdateBlueprintDayDto,
  ): Promise<CalendarBlueprintDay> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.blueprintsService.updateDay(
      id,
      dayId,
      tenantId,
      dto,
      dbUser?.id,
    );
  }

  @Delete(':id/days/:dayId')
  async removeDay(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('dayId', ParseUUIDPipe) dayId: string,
  ): Promise<{ message: string }> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    if (!dbUser) {
      throw new NotFoundException('Usuario nao encontrado');
    }
    await this.blueprintsService.removeDay(id, dayId, tenantId, dbUser.id);
    return { message: 'Dia removido com sucesso' };
  }

  @Get(':id/events')
  async findEvents(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CalendarBlueprintEvent[]> {
    const tenantId = await this.getTenantId(subdomain);
    const blueprint = await this.blueprintsService.findOne(id, tenantId);
    if (!blueprint) {
      throw new NotFoundException('Blueprint nao encontrado');
    }
    return this.blueprintsService.findEvents(id);
  }

  @Post(':id/events')
  async createEvent(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateBlueprintEventDto,
  ): Promise<CalendarBlueprintEvent> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.blueprintsService.createEvent(id, tenantId, dto, dbUser?.id);
  }

  @Put(':id/events/:eventId')
  async updateEvent(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: UpdateBlueprintEventDto,
  ): Promise<CalendarBlueprintEvent> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.blueprintsService.updateEvent(
      id,
      eventId,
      tenantId,
      dto,
      dbUser?.id,
    );
  }

  @Delete(':id/events/:eventId')
  async removeEvent(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<{ message: string }> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    if (!dbUser) {
      throw new NotFoundException('Usuario nao encontrado');
    }
    await this.blueprintsService.removeEvent(id, eventId, tenantId, dbUser.id);
    return { message: 'Evento removido com sucesso' };
  }
}
