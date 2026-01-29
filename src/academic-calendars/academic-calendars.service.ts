/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { CalendarBlueprintsService } from '../calendar-blueprints/calendar-blueprints.service';
import { AcademicCalendarAuditService } from './academic-calendar-audit.service';
import { CreateAcademicCalendarDto } from './dto/create-academic-calendar.dto';
import { UpdateAcademicCalendarDto } from './dto/update-academic-calendar.dto';
import { CreateCalendarDayDto } from './dto/create-calendar-day.dto';
import { UpdateCalendarDayDto } from './dto/update-calendar-day.dto';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import type {
  AcademicCalendar,
  AcademicCalendarDay,
  AcademicCalendarEvent,
  AcademicCalendarWithDetails,
  AcademicCalendarStatus,
  CalendarScopeType,
  CalendarDayKind,
  CalendarVisibility,
} from '../common/types';

interface FindAllFilters {
  schoolId?: string;
  academicYearId?: string;
  scopeType?: CalendarScopeType;
  status?: AcademicCalendarStatus;
  includeDeleted?: boolean;
}

interface FindDaysFilters {
  month?: number;
  kind?: CalendarDayKind;
}

interface FindEventsFilters {
  visibility?: CalendarVisibility;
  eventTypeId?: string;
}

// Helper para tipar resultados do Supabase
interface SupabaseResult<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

@Injectable()
export class AcademicCalendarsService {
  constructor(
    private supabase: SupabaseService,
    private softDeleteService: SoftDeleteService,
    private blueprintsService: CalendarBlueprintsService,
    private auditService: AcademicCalendarAuditService,
  ) {}

  // ============================================
  // Calendars
  // ============================================

  async findAll(
    tenantId: string,
    filters: FindAllFilters = {},
  ): Promise<AcademicCalendar[]> {
    let query = this.supabase
      .getClient()
      .from('academic_calendars')
      .select('*')
      .eq('tenant_id', tenantId);

    if (!filters.includeDeleted) {
      query = query.is('deleted_at', null);
    }

    if (filters.schoolId) {
      query = query.eq('school_id', filters.schoolId);
    }

    if (filters.academicYearId) {
      query = query.eq('academic_year_id', filters.academicYearId);
    }

    if (filters.scopeType) {
      query = query.eq('scope_type', filters.scopeType);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    query = query.order('name');

    const result = await query;
    const { data, error } = result as {
      data: AcademicCalendar[] | null;
      error: { message: string } | null;
    };

    if (error) {
      throw new Error(`Erro ao buscar calendarios: ${error.message}`);
    }

    return data || [];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<AcademicCalendar | null> {
    const result = await this.supabase
      .getClient()
      .from('academic_calendars')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    const { data, error } = result as SupabaseResult<AcademicCalendar>;

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erro ao buscar calendario: ${error.message}`);
    }

    return data;
  }

  async findOneWithDetails(
    id: string,
    tenantId: string,
  ): Promise<AcademicCalendarWithDetails | null> {
    const calendar = await this.findOne(id, tenantId);
    if (!calendar) return null;

    const [days, events] = await Promise.all([
      this.findDays(id),
      this.findEvents(id),
    ]);

    return {
      ...calendar,
      days,
      events,
      days_count: days.length,
      events_count: events.length,
      instructional_days_count: days.filter((d) => d.is_instructional).length,
    };
  }

  async create(
    tenantId: string,
    dto: CreateAcademicCalendarDto,
    userId?: string,
  ): Promise<AcademicCalendar> {
    const insertData = {
      ...dto,
      tenant_id: tenantId,
      scope_type: dto.scope_type ?? 'school',
      status: dto.status ?? 'draft',
      created_by: userId,
      updated_by: userId,
    };

    const { data, error } = await this.supabase
      .getClient()
      .from('academic_calendars')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar calendario: ${error.message}`);
    }

    // Registra auditoria
    await this.auditService.log({
      tenantId,
      schoolId: dto.school_id,
      entityType: 'academic_calendar',
      entityId: data.id,
      calendarId: data.id,
      academicYearId: dto.academic_year_id,
      action: 'calendar.created',
      summary: `Calendario "${data.name}" criado`,
      actorUserId: userId,
      afterSnapshot: this.auditService.createLeanSnapshot(data),
    });

    return data;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateAcademicCalendarDto,
    userId?: string,
  ): Promise<AcademicCalendar> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Calendario com id '${id}' nao encontrado`);
    }

    if (existing.status === 'locked') {
      throw new ConflictException('Calendario bloqueado nao pode ser alterado');
    }

    const beforeSnapshot = this.auditService.createLeanSnapshot(
      existing as unknown as Record<string, unknown>,
    );

    const { data, error } = await this.supabase
      .getClient()
      .from('academic_calendars')
      .update({
        ...dto,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar calendario: ${error.message}`);
    }

    const afterSnapshot = this.auditService.createLeanSnapshot(data);
    const changedFields = this.auditService.calculateChangedFields(
      beforeSnapshot,
      afterSnapshot,
    );

    if (changedFields.length > 0) {
      await this.auditService.log({
        tenantId,
        schoolId: existing.school_id,
        entityType: 'academic_calendar',
        entityId: id,
        calendarId: id,
        academicYearId: existing.academic_year_id,
        action: 'calendar.updated',
        summary: `Calendario atualizado: ${changedFields.join(', ')}`,
        actorUserId: userId,
        changedFields,
        beforeSnapshot,
        afterSnapshot,
      });
    }

    return data;
  }

  async activate(
    id: string,
    tenantId: string,
    reason: string,
    userId?: string,
  ): Promise<AcademicCalendar> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Calendario com id '${id}' nao encontrado`);
    }

    if (existing.status !== 'draft') {
      throw new BadRequestException(
        'Apenas calendarios em rascunho podem ser ativados',
      );
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('academic_calendars')
      .update({
        status: 'active',
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao ativar calendario: ${error.message}`);
    }

    await this.auditService.log({
      tenantId,
      schoolId: existing.school_id,
      entityType: 'academic_calendar',
      entityId: id,
      calendarId: id,
      academicYearId: existing.academic_year_id,
      action: 'calendar.status_changed',
      summary: `Calendario ativado: draft -> active`,
      reason,
      actorUserId: userId,
      beforeSnapshot: { status: 'draft' },
      afterSnapshot: { status: 'active' },
    });

    return data;
  }

  async lock(
    id: string,
    tenantId: string,
    reason: string,
    userId?: string,
  ): Promise<AcademicCalendar> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Calendario com id '${id}' nao encontrado`);
    }

    if (existing.status !== 'active') {
      throw new BadRequestException(
        'Apenas calendarios ativos podem ser bloqueados',
      );
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('academic_calendars')
      .update({
        status: 'locked',
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao bloquear calendario: ${error.message}`);
    }

    await this.auditService.log({
      tenantId,
      schoolId: existing.school_id,
      entityType: 'academic_calendar',
      entityId: id,
      calendarId: id,
      academicYearId: existing.academic_year_id,
      action: 'calendar.status_changed',
      summary: `Calendario bloqueado: active -> locked`,
      reason,
      actorUserId: userId,
      beforeSnapshot: { status: 'active' },
      afterSnapshot: { status: 'locked' },
    });

    return data;
  }

  async unlock(
    id: string,
    tenantId: string,
    reason: string,
    userId?: string,
  ): Promise<AcademicCalendar> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Calendario com id '${id}' nao encontrado`);
    }

    if (existing.status !== 'locked') {
      throw new BadRequestException(
        'Apenas calendarios bloqueados podem ser desbloqueados',
      );
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('academic_calendars')
      .update({
        status: 'active',
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao desbloquear calendario: ${error.message}`);
    }

    await this.auditService.log({
      tenantId,
      schoolId: existing.school_id,
      entityType: 'academic_calendar',
      entityId: id,
      calendarId: id,
      academicYearId: existing.academic_year_id,
      action: 'calendar.status_changed',
      summary: `Calendario desbloqueado: locked -> active`,
      reason,
      actorUserId: userId,
      beforeSnapshot: { status: 'locked' },
      afterSnapshot: { status: 'active' },
    });

    return data;
  }

  async archive(
    id: string,
    tenantId: string,
    reason: string,
    userId?: string,
  ): Promise<AcademicCalendar> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Calendario com id '${id}' nao encontrado`);
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('academic_calendars')
      .update({
        status: 'archived',
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao arquivar calendario: ${error.message}`);
    }

    await this.auditService.log({
      tenantId,
      schoolId: existing.school_id,
      entityType: 'academic_calendar',
      entityId: id,
      calendarId: id,
      academicYearId: existing.academic_year_id,
      action: 'calendar.status_changed',
      summary: `Calendario arquivado: ${existing.status} -> archived`,
      reason,
      actorUserId: userId,
      beforeSnapshot: { status: existing.status },
      afterSnapshot: { status: 'archived' },
    });

    return data;
  }

  async setToDraft(
    id: string,
    tenantId: string,
    reason: string,
    userId?: string,
  ): Promise<AcademicCalendar> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Calendario com id '${id}' nao encontrado`);
    }

    // Apenas calendarios com status 'active' ou 'archived' podem voltar para 'draft'
    if (existing.status !== 'active' && existing.status !== 'archived') {
      throw new BadRequestException(
        'Apenas calendarios ativos ou arquivados podem voltar para rascunho',
      );
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('academic_calendars')
      .update({
        status: 'draft',
        updated_at: new Date().toISOString(),
        updated_by: userId,
        // NÃO alterar wizard_completed_at - mantém histórico
        // NÃO alterar wizard_data - mantém dados preenchidos
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(
        `Erro ao voltar calendario para rascunho: ${error.message}`,
      );
    }

    await this.auditService.log({
      tenantId,
      schoolId: existing.school_id,
      entityType: 'academic_calendar',
      entityId: id,
      calendarId: id,
      academicYearId: existing.academic_year_id,
      action: 'calendar.status_changed',
      summary: `Calendario voltou para rascunho: ${existing.status} -> draft`,
      reason,
      actorUserId: userId,
      beforeSnapshot: { status: existing.status },
      afterSnapshot: { status: 'draft' },
    });

    return data;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Calendario com id '${id}' nao encontrado`);
    }

    if (existing.status === 'active' || existing.status === 'locked') {
      throw new ConflictException(
        'Calendarios ativos ou bloqueados nao podem ser removidos',
      );
    }

    await this.softDeleteService.softDelete(
      this.supabase.getClient(),
      'academic_calendars',
      id,
      userId,
    );
  }

  async replicateFromBlueprint(
    id: string,
    tenantId: string,
    blueprintId: string,
    reason: string,
    userId?: string,
  ): Promise<AcademicCalendar> {
    const calendar = await this.findOne(id, tenantId);
    if (!calendar) {
      throw new NotFoundException(`Calendario com id '${id}' nao encontrado`);
    }

    if (calendar.status !== 'draft') {
      throw new BadRequestException(
        'Apenas calendarios em rascunho podem receber replicacao',
      );
    }

    const blueprint = await this.blueprintsService.findOneWithDetails(
      blueprintId,
      tenantId,
    );
    if (!blueprint) {
      throw new NotFoundException(
        `Blueprint com id '${blueprintId}' nao encontrado`,
      );
    }

    const correlationId = this.auditService.generateCorrelationId();

    // Replica dias
    if (blueprint.days && blueprint.days.length > 0) {
      const daysToInsert = blueprint.days.map((day) => ({
        calendar_id: id,
        day_date: day.day_date,
        day_kind: day.day_kind,
        is_instructional: day.is_instructional,
        source_blueprint_day_id: day.id,
        is_override: false,
        label: day.label,
        notes: day.notes,
        metadata: day.metadata,
        created_by: userId,
        updated_by: userId,
      }));

      const { error: daysError } = await this.supabase
        .getClient()
        .from('academic_calendar_days')
        .insert(daysToInsert);

      if (daysError) {
        throw new Error(`Erro ao replicar dias: ${daysError.message}`);
      }
    }

    // Replica eventos
    if (blueprint.events && blueprint.events.length > 0) {
      const eventsToInsert = blueprint.events.map((event) => ({
        calendar_id: id,
        event_type_id: event.event_type_id,
        title: event.title,
        start_date: event.start_date,
        end_date: event.end_date,
        is_all_day: event.is_all_day,
        affects_instruction: event.affects_instruction,
        visibility: event.visibility,
        grading_period_id: event.grading_period_id,
        source_blueprint_event_id: event.id,
        is_override: false,
        metadata: event.metadata,
        created_by: userId,
        updated_by: userId,
      }));

      const { error: eventsError } = await this.supabase
        .getClient()
        .from('academic_calendar_events')
        .insert(eventsToInsert);

      if (eventsError) {
        throw new Error(`Erro ao replicar eventos: ${eventsError.message}`);
      }
    }

    // Atualiza referencia ao blueprint
    const { data: updated, error: updateError } = await this.supabase
      .getClient()
      .from('academic_calendars')
      .update({
        based_on_blueprint_id: blueprintId,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Erro ao atualizar calendario: ${updateError.message}`);
    }

    // Registra auditoria
    await this.auditService.log({
      tenantId,
      schoolId: calendar.school_id,
      entityType: 'academic_calendar',
      entityId: id,
      calendarId: id,
      academicYearId: calendar.academic_year_id,
      action: 'bulk.replicated_from_blueprint',
      summary: `Replicado do blueprint "${blueprint.name}": ${blueprint.days_count} dias, ${blueprint.events_count} eventos`,
      reason,
      correlationId,
      actorUserId: userId,
      afterSnapshot: {
        blueprint_id: blueprintId,
        blueprint_name: blueprint.name,
        days_count: blueprint.days_count,
        events_count: blueprint.events_count,
      },
    });

    return updated;
  }

  // ============================================
  // Calendar Days
  // ============================================

  async findDays(
    calendarId: string,
    filters: FindDaysFilters = {},
  ): Promise<AcademicCalendarDay[]> {
    let query = this.supabase
      .getClient()
      .from('academic_calendar_days')
      .select('*')
      .eq('calendar_id', calendarId)
      .is('deleted_at', null)
      .order('day_date');

    if (filters.month) {
      const monthStr = filters.month.toString().padStart(2, '0');
      query = query.like('day_date', `%-${monthStr}-%`);
    }

    if (filters.kind) {
      query = query.eq('day_kind', filters.kind);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar dias: ${error.message}`);
    }

    return data || [];
  }

  async findDay(
    calendarId: string,
    dayId: string,
  ): Promise<AcademicCalendarDay | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('academic_calendar_days')
      .select('*')
      .eq('id', dayId)
      .eq('calendar_id', calendarId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erro ao buscar dia: ${error.message}`);
    }

    return data;
  }

  async createDay(
    calendarId: string,
    tenantId: string,
    dto: CreateCalendarDayDto,
    userId?: string,
  ): Promise<AcademicCalendarDay> {
    const calendar = await this.findOne(calendarId, tenantId);
    if (!calendar) {
      throw new NotFoundException(
        `Calendario com id '${calendarId}' nao encontrado`,
      );
    }

    if (calendar.status === 'locked') {
      throw new ConflictException(
        'Calendario bloqueado nao pode receber novos dias',
      );
    }

    const insertData = {
      ...dto,
      calendar_id: calendarId,
      day_kind: dto.day_kind ?? 'instructional',
      is_instructional: dto.is_instructional ?? true,
      is_override: dto.is_override ?? false,
      created_by: userId,
      updated_by: userId,
    };

    const { data, error } = await this.supabase
      .getClient()
      .from('academic_calendar_days')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          `Ja existe um dia para a data ${dto.day_date}`,
        );
      }
      throw new Error(`Erro ao criar dia: ${error.message}`);
    }

    await this.auditService.log({
      tenantId,
      schoolId: calendar.school_id,
      entityType: 'academic_calendar_day',
      entityId: data.id,
      calendarId,
      academicYearId: calendar.academic_year_id,
      dayDate: dto.day_date,
      action: 'day.created',
      summary: `Dia ${dto.day_date} criado`,
      actorUserId: userId,
      afterSnapshot: this.auditService.createLeanSnapshot(data),
    });

    return data;
  }

  async updateDay(
    calendarId: string,
    dayId: string,
    tenantId: string,
    dto: UpdateCalendarDayDto,
    userId?: string,
  ): Promise<AcademicCalendarDay> {
    const calendar = await this.findOne(calendarId, tenantId);
    if (!calendar) {
      throw new NotFoundException(
        `Calendario com id '${calendarId}' nao encontrado`,
      );
    }

    if (calendar.status === 'locked') {
      throw new ConflictException('Calendario bloqueado nao pode ser alterado');
    }

    const existing = await this.findDay(calendarId, dayId);
    if (!existing) {
      throw new NotFoundException(`Dia com id '${dayId}' nao encontrado`);
    }

    const beforeSnapshot = this.auditService.createLeanSnapshot(
      existing as unknown as Record<string, unknown>,
    );

    // Se esta alterando um dia que veio do blueprint, marca como override
    const isOverride = existing.source_blueprint_day_id
      ? true
      : (dto.is_override ?? existing.is_override);

    const { data, error } = await this.supabase
      .getClient()
      .from('academic_calendar_days')
      .update({
        ...dto,
        is_override: isOverride,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', dayId)
      .eq('calendar_id', calendarId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar dia: ${error.message}`);
    }

    const afterSnapshot = this.auditService.createLeanSnapshot(data);
    const changedFields = this.auditService.calculateChangedFields(
      beforeSnapshot,
      afterSnapshot,
    );

    if (changedFields.length > 0) {
      await this.auditService.log({
        tenantId,
        schoolId: calendar.school_id,
        entityType: 'academic_calendar_day',
        entityId: dayId,
        calendarId,
        academicYearId: calendar.academic_year_id,
        dayDate: existing.day_date,
        action: 'day.updated',
        summary: `Dia ${existing.day_date} atualizado: ${changedFields.join(', ')}`,
        reason: dto.override_reason,
        actorUserId: userId,
        changedFields,
        beforeSnapshot,
        afterSnapshot,
      });
    }

    return data;
  }

  async removeDay(
    calendarId: string,
    dayId: string,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const calendar = await this.findOne(calendarId, tenantId);
    if (!calendar) {
      throw new NotFoundException(
        `Calendario com id '${calendarId}' nao encontrado`,
      );
    }

    if (calendar.status === 'locked') {
      throw new ConflictException('Calendario bloqueado nao pode ser alterado');
    }

    const existing = await this.findDay(calendarId, dayId);
    if (!existing) {
      throw new NotFoundException(`Dia com id '${dayId}' nao encontrado`);
    }

    await this.softDeleteService.softDelete(
      this.supabase.getClient(),
      'academic_calendar_days',
      dayId,
      userId,
    );

    await this.auditService.log({
      tenantId,
      schoolId: calendar.school_id,
      entityType: 'academic_calendar_day',
      entityId: dayId,
      calendarId,
      academicYearId: calendar.academic_year_id,
      dayDate: existing.day_date,
      action: 'day.deleted',
      summary: `Dia ${existing.day_date} removido`,
      actorUserId: userId,
      beforeSnapshot: this.auditService.createLeanSnapshot(
        existing as unknown as Record<string, unknown>,
      ),
    });
  }

  // ============================================
  // Helper: Sincronizar Day Overrides com Eventos
  // ============================================

  /**
   * Sincroniza os overrides de dias baseado em um evento que afeta instrução.
   * Cria ou atualiza overrides para cada dia no range do evento.
   */
  private async syncDayOverridesForEvent(
    calendarId: string,
    tenantId: string,
    event: AcademicCalendarEvent,
    userId?: string,
  ): Promise<void> {
    // Se affects_instruction é null, não faz nada (usa padrão do tipo)
    if (event.affects_instruction === null) {
      return;
    }

    // Gerar todas as datas no range do evento
    const dates = this.getDateRange(event.start_date, event.end_date);
    const isInstructional = event.affects_instruction === true;
    const dayKind: CalendarDayKind = isInstructional
      ? 'instructional'
      : 'non_instructional';

    for (const dateStr of dates) {
      // Verificar se já existe um override para este dia
      const { data: existingDay } = await this.supabase
        .getClient()
        .from('academic_calendar_days')
        .select('*')
        .eq('calendar_id', calendarId)
        .eq('day_date', dateStr)
        .is('deleted_at', null)
        .maybeSingle();

      if (existingDay) {
        // Atualizar override existente
        await this.supabase
          .getClient()
          .from('academic_calendar_days')
          .update({
            day_kind: dayKind,
            is_instructional: isInstructional,
            override_reason: `Definido pelo evento "${event.title}"`,
            is_override: true,
            updated_at: new Date().toISOString(),
            updated_by: userId,
          })
          .eq('id', existingDay.id);
      } else {
        // Criar novo override
        await this.supabase
          .getClient()
          .from('academic_calendar_days')
          .insert({
            calendar_id: calendarId,
            day_date: dateStr,
            day_kind: dayKind,
            is_instructional: isInstructional,
            is_override: true,
            override_reason: `Definido pelo evento "${event.title}"`,
            metadata: { source_event_id: event.id },
            created_by: userId,
            updated_by: userId,
          });
      }
    }
  }

  /**
   * Remove overrides de dias que foram criados por um evento específico.
   */
  private async removeDayOverridesForEvent(
    calendarId: string,
    event: AcademicCalendarEvent,
    userId?: string,
  ): Promise<void> {
    // Buscar overrides que foram criados por este evento
    const { data: overrides } = await this.supabase
      .getClient()
      .from('academic_calendar_days')
      .select('*')
      .eq('calendar_id', calendarId)
      .contains('metadata', { source_event_id: event.id })
      .is('deleted_at', null);

    if (overrides && overrides.length > 0) {
      // Soft delete dos overrides relacionados ao evento
      for (const override of overrides) {
        await this.softDeleteService.softDelete(
          this.supabase.getClient(),
          'academic_calendar_days',
          override.id,
          userId ?? '',
        );
      }
    }
  }

  /**
   * Gera um array de datas (YYYY-MM-DD) entre start e end (inclusive).
   */
  private getDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const start = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');

    const current = new Date(start);
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  // ============================================
  // Calendar Events
  // ============================================

  async findEvents(
    calendarId: string,
    filters: FindEventsFilters = {},
  ): Promise<AcademicCalendarEvent[]> {
    let query = this.supabase
      .getClient()
      .from('academic_calendar_events')
      .select('*')
      .eq('calendar_id', calendarId)
      .is('deleted_at', null)
      .order('start_date')
      .order('title');

    if (filters.visibility) {
      query = query.eq('visibility', filters.visibility);
    }

    if (filters.eventTypeId) {
      query = query.eq('event_type_id', filters.eventTypeId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar eventos: ${error.message}`);
    }

    return data || [];
  }

  async findEvent(
    calendarId: string,
    eventId: string,
  ): Promise<AcademicCalendarEvent | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('academic_calendar_events')
      .select('*')
      .eq('id', eventId)
      .eq('calendar_id', calendarId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erro ao buscar evento: ${error.message}`);
    }

    return data;
  }

  async createEvent(
    calendarId: string,
    tenantId: string,
    dto: CreateCalendarEventDto,
    userId?: string,
  ): Promise<AcademicCalendarEvent> {
    const calendar = await this.findOne(calendarId, tenantId);
    if (!calendar) {
      throw new NotFoundException(
        `Calendario com id '${calendarId}' nao encontrado`,
      );
    }

    if (calendar.status === 'locked') {
      throw new ConflictException(
        'Calendario bloqueado nao pode receber novos eventos',
      );
    }

    if (new Date(dto.end_date) < new Date(dto.start_date)) {
      throw new BadRequestException(
        'Data final nao pode ser anterior a data inicial',
      );
    }

    const insertData = {
      ...dto,
      calendar_id: calendarId,
      is_all_day: dto.is_all_day ?? true,
      affects_instruction: dto.affects_instruction ?? false,
      visibility: dto.visibility ?? 'internal',
      is_override: dto.is_override ?? false,
      created_by: userId,
      updated_by: userId,
    };

    const { data, error } = await this.supabase
      .getClient()
      .from('academic_calendar_events')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar evento: ${error.message}`);
    }

    await this.auditService.log({
      tenantId,
      schoolId: calendar.school_id,
      entityType: 'academic_calendar_event',
      entityId: data.id,
      calendarId,
      academicYearId: calendar.academic_year_id,
      startDate: dto.start_date,
      endDate: dto.end_date,
      action: 'event.created',
      summary: `Evento "${dto.title}" criado`,
      actorUserId: userId,
      afterSnapshot: this.auditService.createLeanSnapshot(data),
    });

    // Sincronizar overrides de dias se o evento afeta instrução
    if (data.affects_instruction !== null) {
      await this.syncDayOverridesForEvent(calendarId, tenantId, data, userId);
    }

    return data;
  }

  async updateEvent(
    calendarId: string,
    eventId: string,
    tenantId: string,
    dto: UpdateCalendarEventDto,
    userId?: string,
  ): Promise<AcademicCalendarEvent> {
    const calendar = await this.findOne(calendarId, tenantId);
    if (!calendar) {
      throw new NotFoundException(
        `Calendario com id '${calendarId}' nao encontrado`,
      );
    }

    if (calendar.status === 'locked') {
      throw new ConflictException('Calendario bloqueado nao pode ser alterado');
    }

    const existing = await this.findEvent(calendarId, eventId);
    if (!existing) {
      throw new NotFoundException(`Evento com id '${eventId}' nao encontrado`);
    }

    const startDate = dto.start_date ?? existing.start_date;
    const endDate = dto.end_date ?? existing.end_date;
    if (new Date(endDate) < new Date(startDate)) {
      throw new BadRequestException(
        'Data final nao pode ser anterior a data inicial',
      );
    }

    const beforeSnapshot = this.auditService.createLeanSnapshot(
      existing as unknown as Record<string, unknown>,
    );

    // Se esta alterando um evento que veio do blueprint, marca como override
    const isOverride = existing.source_blueprint_event_id
      ? true
      : (dto.is_override ?? existing.is_override);

    const { data, error } = await this.supabase
      .getClient()
      .from('academic_calendar_events')
      .update({
        ...dto,
        is_override: isOverride,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', eventId)
      .eq('calendar_id', calendarId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar evento: ${error.message}`);
    }

    const afterSnapshot = this.auditService.createLeanSnapshot(data);
    const changedFields = this.auditService.calculateChangedFields(
      beforeSnapshot,
      afterSnapshot,
    );

    if (changedFields.length > 0) {
      await this.auditService.log({
        tenantId,
        schoolId: calendar.school_id,
        entityType: 'academic_calendar_event',
        entityId: eventId,
        calendarId,
        academicYearId: calendar.academic_year_id,
        startDate: existing.start_date,
        endDate: existing.end_date,
        action: 'event.updated',
        summary: `Evento "${existing.title}" atualizado: ${changedFields.join(', ')}`,
        reason: dto.override_reason,
        actorUserId: userId,
        changedFields,
        beforeSnapshot,
        afterSnapshot,
      });
    }

    // Se affects_instruction mudou, atualizar os overrides
    const affectsChanged =
      dto.affects_instruction !== undefined &&
      dto.affects_instruction !== existing.affects_instruction;

    if (affectsChanged) {
      // Primeiro remover overrides antigos
      await this.removeDayOverridesForEvent(calendarId, existing, userId);

      // Depois criar novos se necessário
      if (data.affects_instruction !== null) {
        await this.syncDayOverridesForEvent(calendarId, tenantId, data, userId);
      }
    }

    return data;
  }

  async removeEvent(
    calendarId: string,
    eventId: string,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const calendar = await this.findOne(calendarId, tenantId);
    if (!calendar) {
      throw new NotFoundException(
        `Calendario com id '${calendarId}' nao encontrado`,
      );
    }

    if (calendar.status === 'locked') {
      throw new ConflictException('Calendario bloqueado nao pode ser alterado');
    }

    const existing = await this.findEvent(calendarId, eventId);
    if (!existing) {
      throw new NotFoundException(`Evento com id '${eventId}' nao encontrado`);
    }

    await this.softDeleteService.softDelete(
      this.supabase.getClient(),
      'academic_calendar_events',
      eventId,
      userId,
    );

    await this.auditService.log({
      tenantId,
      schoolId: calendar.school_id,
      entityType: 'academic_calendar_event',
      entityId: eventId,
      calendarId,
      academicYearId: calendar.academic_year_id,
      startDate: existing.start_date,
      endDate: existing.end_date,
      action: 'event.deleted',
      summary: `Evento "${existing.title}" removido`,
      actorUserId: userId,
      beforeSnapshot: this.auditService.createLeanSnapshot(
        existing as unknown as Record<string, unknown>,
      ),
    });

    // Remover overrides de dias que foram criados por este evento
    if (existing.affects_instruction !== null) {
      await this.removeDayOverridesForEvent(calendarId, existing, userId);
    }
  }

  // ============================================
  // Wizard
  // ============================================

  async updateWizard(
    id: string,
    tenantId: string,
    wizardStep: number,
    wizardData?: Record<string, unknown>,
    userId?: string,
  ): Promise<AcademicCalendar> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Calendario com id '${id}' nao encontrado`);
    }

    // Mesclar wizard_data existente com novos dados
    const mergedWizardData = {
      ...(existing.wizard_data || {}),
      ...(wizardData || {}),
    };

    // Preparar dados para atualizacao
    // Permite atualizar wizard_step e wizard_data mesmo apos conclusao
    // mas nao permite alterar wizard_completed_at (só pode ser setado, nunca removido)
    const updateData: {
      wizard_step: number;
      wizard_data: Record<string, unknown>;
      updated_at: string;
      updated_by?: string;
    } = {
      wizard_step: wizardStep,
      wizard_data: mergedWizardData,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    };

    const { data, error } = await this.supabase
      .getClient()
      .from('academic_calendars')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar wizard: ${error.message}`);
    }

    return data;
  }

  async completeWizard(
    id: string,
    tenantId: string,
    finalData?: Record<string, unknown>,
    userId?: string,
  ): Promise<AcademicCalendar> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Calendario com id '${id}' nao encontrado`);
    }

    // Nao permite completar novamente
    if (existing.wizard_completed_at) {
      throw new ConflictException(
        'Wizard ja foi completado para este calendario',
      );
    }

    // Mesclar dados finais
    const mergedWizardData = {
      ...(existing.wizard_data || {}),
      ...(finalData || {}),
    };

    const { data, error } = await this.supabase
      .getClient()
      .from('academic_calendars')
      .update({
        wizard_step: 7,
        wizard_data: mergedWizardData,
        wizard_completed_at: new Date().toISOString(),
        status: 'active', // Ativar calendario ao completar wizard
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao completar wizard: ${error.message}`);
    }

    // Registrar auditoria
    await this.auditService.log({
      tenantId,
      schoolId: existing.school_id,
      entityType: 'academic_calendar',
      entityId: id,
      calendarId: id,
      academicYearId: existing.academic_year_id,
      action: 'calendar.status_changed',
      summary: 'Calendario ativado apos conclusao do wizard',
      reason: 'Wizard de configuracao concluido',
      actorUserId: userId,
      changedFields: ['status', 'wizard_completed_at'],
      beforeSnapshot: { status: existing.status, wizard_completed_at: null },
      afterSnapshot: {
        status: 'active',
        wizard_completed_at: data.wizard_completed_at,
      },
    });

    return data;
  }
}
