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
import { AcademicCalendarsService } from './academic-calendars.service';
import { AcademicCalendarAuditService } from './academic-calendar-audit.service';
import {
  CalendarDerivationService,
  DerivedDaysResponse,
} from './calendar-derivation.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreateAcademicCalendarDto } from './dto/create-academic-calendar.dto';
import { UpdateAcademicCalendarDto } from './dto/update-academic-calendar.dto';
import { CreateCalendarDayDto } from './dto/create-calendar-day.dto';
import { UpdateCalendarDayDto } from './dto/update-calendar-day.dto';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { ReplicateFromBlueprintDto } from './dto/replicate-from-blueprint.dto';
import type {
  AcademicCalendar,
  AcademicCalendarDay,
  AcademicCalendarEvent,
  AcademicCalendarAudit,
  AcademicCalendarWithDetails,
  AcademicCalendarStatus,
  CalendarScopeType,
  CalendarDayKind,
  CalendarVisibility,
} from '../common/types';

class StatusChangeDto {
  reason: string;
}

@Controller('academic-calendars')
@UseGuards(JwtAuthGuard)
export class AcademicCalendarsController {
  constructor(
    private calendarsService: AcademicCalendarsService,
    private auditService: AcademicCalendarAuditService,
    private derivationService: CalendarDerivationService,
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

  // ============================================
  // Calendars
  // ============================================

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Query('schoolId') schoolId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('scopeType') scopeType?: CalendarScopeType,
    @Query('status') status?: AcademicCalendarStatus,
  ): Promise<AcademicCalendar[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.calendarsService.findAll(tenantId, {
      schoolId,
      academicYearId,
      scopeType,
      status,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('includeDetails') includeDetails?: string,
  ): Promise<AcademicCalendar | AcademicCalendarWithDetails> {
    const tenantId = await this.getTenantId(subdomain);

    if (includeDetails === 'true') {
      const calendar = await this.calendarsService.findOneWithDetails(
        id,
        tenantId,
      );
      if (!calendar) {
        throw new NotFoundException('Calendario nao encontrado');
      }
      return calendar;
    }

    const calendar = await this.calendarsService.findOne(id, tenantId);
    if (!calendar) {
      throw new NotFoundException('Calendario nao encontrado');
    }
    return calendar;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateAcademicCalendarDto,
  ): Promise<AcademicCalendar> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.calendarsService.create(tenantId, dto, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAcademicCalendarDto,
  ): Promise<AcademicCalendar> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.calendarsService.update(id, tenantId, dto, dbUser?.id);
  }

  @Post(':id/activate')
  async activate(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StatusChangeDto,
  ): Promise<AcademicCalendar> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.calendarsService.activate(id, tenantId, dto.reason, dbUser?.id);
  }

  @Post(':id/lock')
  async lock(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StatusChangeDto,
  ): Promise<AcademicCalendar> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.calendarsService.lock(id, tenantId, dto.reason, dbUser?.id);
  }

  @Post(':id/unlock')
  async unlock(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StatusChangeDto,
  ): Promise<AcademicCalendar> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.calendarsService.unlock(id, tenantId, dto.reason, dbUser?.id);
  }

  @Post(':id/archive')
  async archive(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StatusChangeDto,
  ): Promise<AcademicCalendar> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.calendarsService.archive(id, tenantId, dto.reason, dbUser?.id);
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
    await this.calendarsService.remove(id, tenantId, dbUser.id);
    return { message: 'Calendario removido com sucesso' };
  }

  @Post(':id/replicate-from-blueprint')
  async replicateFromBlueprint(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplicateFromBlueprintDto,
  ): Promise<AcademicCalendar> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.calendarsService.replicateFromBlueprint(
      id,
      tenantId,
      dto.blueprint_id,
      dto.reason,
      dbUser?.id,
    );
  }

  // ============================================
  // Derived Days (Derivacao sob demanda)
  // ============================================

  @Get(':id/derived-days')
  async getDerivedDays(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('start') startDate: string,
    @Query('end') endDate: string,
  ): Promise<DerivedDaysResponse> {
    const tenantId = await this.getTenantId(subdomain);

    if (!startDate || !endDate) {
      throw new BadRequestException(
        'Parametros start e end sao obrigatorios (formato: YYYY-MM-DD)',
      );
    }

    const calendar = await this.calendarsService.findOne(id, tenantId);
    if (!calendar) {
      throw new NotFoundException('Calendario nao encontrado');
    }

    return this.derivationService.deriveDays(calendar, startDate, endDate);
  }

  // ============================================
  // Calendar Days (Overrides)
  // ============================================

  @Get(':id/days')
  async findDays(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('month') month?: string,
    @Query('kind') kind?: CalendarDayKind,
  ): Promise<AcademicCalendarDay[]> {
    const tenantId = await this.getTenantId(subdomain);
    const calendar = await this.calendarsService.findOne(id, tenantId);
    if (!calendar) {
      throw new NotFoundException('Calendario nao encontrado');
    }
    return this.calendarsService.findDays(id, {
      month: month ? parseInt(month, 10) : undefined,
      kind,
    });
  }

  @Get(':id/days/:dayId')
  async findDay(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('dayId', ParseUUIDPipe) dayId: string,
  ): Promise<AcademicCalendarDay> {
    const tenantId = await this.getTenantId(subdomain);
    const calendar = await this.calendarsService.findOne(id, tenantId);
    if (!calendar) {
      throw new NotFoundException('Calendario nao encontrado');
    }
    const day = await this.calendarsService.findDay(id, dayId);
    if (!day) {
      throw new NotFoundException('Dia nao encontrado');
    }
    return day;
  }

  @Post(':id/days')
  async createDay(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCalendarDayDto,
  ): Promise<AcademicCalendarDay> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.calendarsService.createDay(id, tenantId, dto, dbUser?.id);
  }

  @Put(':id/days/:dayId')
  async updateDay(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('dayId', ParseUUIDPipe) dayId: string,
    @Body() dto: UpdateCalendarDayDto,
  ): Promise<AcademicCalendarDay> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.calendarsService.updateDay(
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
    await this.calendarsService.removeDay(id, dayId, tenantId, dbUser.id);
    return { message: 'Dia removido com sucesso' };
  }

  // ============================================
  // Calendar Events
  // ============================================

  @Get(':id/events')
  async findEvents(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('visibility') visibility?: CalendarVisibility,
    @Query('eventTypeId') eventTypeId?: string,
  ): Promise<AcademicCalendarEvent[]> {
    const tenantId = await this.getTenantId(subdomain);
    const calendar = await this.calendarsService.findOne(id, tenantId);
    if (!calendar) {
      throw new NotFoundException('Calendario nao encontrado');
    }
    return this.calendarsService.findEvents(id, {
      visibility,
      eventTypeId,
    });
  }

  @Get(':id/events/:eventId')
  async findEvent(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<AcademicCalendarEvent> {
    const tenantId = await this.getTenantId(subdomain);
    const calendar = await this.calendarsService.findOne(id, tenantId);
    if (!calendar) {
      throw new NotFoundException('Calendario nao encontrado');
    }
    const event = await this.calendarsService.findEvent(id, eventId);
    if (!event) {
      throw new NotFoundException('Evento nao encontrado');
    }
    return event;
  }

  @Post(':id/events')
  async createEvent(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCalendarEventDto,
  ): Promise<AcademicCalendarEvent> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.calendarsService.createEvent(id, tenantId, dto, dbUser?.id);
  }

  @Put(':id/events/:eventId')
  async updateEvent(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: UpdateCalendarEventDto,
  ): Promise<AcademicCalendarEvent> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.calendarsService.updateEvent(
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
    await this.calendarsService.removeEvent(id, eventId, tenantId, dbUser.id);
    return { message: 'Evento removido com sucesso' };
  }

  // ============================================
  // Audits
  // ============================================

  @Get(':id/audits')
  async findAudits(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AcademicCalendarAudit[]> {
    const tenantId = await this.getTenantId(subdomain);
    const calendar = await this.calendarsService.findOne(id, tenantId);
    if (!calendar) {
      throw new NotFoundException('Calendario nao encontrado');
    }
    return this.auditService.findByCalendar(id);
  }

  @Get(':id/audits/by-correlation/:correlationId')
  async findAuditsByCorrelation(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('correlationId', ParseUUIDPipe) correlationId: string,
  ): Promise<AcademicCalendarAudit[]> {
    const tenantId = await this.getTenantId(subdomain);
    const calendar = await this.calendarsService.findOne(id, tenantId);
    if (!calendar) {
      throw new NotFoundException('Calendario nao encontrado');
    }
    return this.auditService.findByCorrelation(correlationId);
  }
}
