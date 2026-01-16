/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { CreateCalendarBlueprintDto } from './dto/create-calendar-blueprint.dto';
import { UpdateCalendarBlueprintDto } from './dto/update-calendar-blueprint.dto';
import { CreateBlueprintDayDto } from './dto/create-blueprint-day.dto';
import { UpdateBlueprintDayDto } from './dto/update-blueprint-day.dto';
import { CreateBlueprintEventDto } from './dto/create-blueprint-event.dto';
import { UpdateBlueprintEventDto } from './dto/update-blueprint-event.dto';
import type {
  CalendarBlueprint,
  CalendarBlueprintDay,
  CalendarBlueprintEvent,
  CalendarBlueprintWithDetails,
  CalendarStage,
  BlueprintStatus,
} from '../common/types';

interface FindAllFilters {
  year?: number;
  stage?: CalendarStage;
  status?: BlueprintStatus;
  isSystem?: boolean;
  jurisdictionCode?: string;
  includeDeleted?: boolean;
}

@Injectable()
export class CalendarBlueprintsService {
  constructor(
    private supabase: SupabaseService,
    private softDeleteService: SoftDeleteService,
  ) {}

  // ============================================
  // Blueprints
  // ============================================

  async findAll(
    tenantId: string,
    filters: FindAllFilters = {},
  ): Promise<CalendarBlueprint[]> {
    let query = this.supabase
      .getClient()
      .from('calendar_blueprints')
      .select('*')
      .or(`tenant_id.eq.${tenantId},is_system_blueprint.eq.true`);

    if (!filters.includeDeleted) {
      query = query.is('deleted_at', null);
    }

    if (filters.year) {
      query = query.eq('reference_year', filters.year);
    }

    if (filters.stage) {
      query = query.eq('stage', filters.stage);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.isSystem !== undefined) {
      query = query.eq('is_system_blueprint', filters.isSystem);
    }

    if (filters.jurisdictionCode) {
      query = query.eq('jurisdiction_code', filters.jurisdictionCode);
    }

    query = query
      .order('reference_year', { ascending: false })
      .order('is_system_blueprint', { ascending: false })
      .order('name');

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar blueprints: ${error.message}`);
    }

    return data || [];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<CalendarBlueprint | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('calendar_blueprints')
      .select('*')
      .eq('id', id)
      .or(`tenant_id.eq.${tenantId},is_system_blueprint.eq.true`)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erro ao buscar blueprint: ${error.message}`);
    }

    return data;
  }

  async findOneWithDetails(
    id: string,
    tenantId: string,
  ): Promise<CalendarBlueprintWithDetails | null> {
    const blueprint = await this.findOne(id, tenantId);
    if (!blueprint) return null;

    const [days, events] = await Promise.all([
      this.findDays(id),
      this.findEvents(id),
    ]);

    return {
      ...blueprint,
      days,
      events,
      days_count: days.length,
      events_count: events.length,
      instructional_days_count: days.filter((d) => d.is_instructional).length,
    };
  }

  async create(
    tenantId: string,
    dto: CreateCalendarBlueprintDto,
    userId?: string,
  ): Promise<CalendarBlueprint> {
    const isSystem = dto.is_system_blueprint ?? false;

    const insertData = {
      ...dto,
      tenant_id: isSystem ? null : tenantId,
      is_system_blueprint: isSystem,
      status: dto.status ?? 'draft',
      version: 1,
      created_by: userId,
      updated_by: userId,
    };

    const { data, error } = await this.supabase
      .getClient()
      .from('calendar_blueprints')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar blueprint: ${error.message}`);
    }

    return data;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateCalendarBlueprintDto,
    userId?: string,
  ): Promise<CalendarBlueprint> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Blueprint com id '${id}' não encontrado`);
    }

    if (existing.is_system_blueprint) {
      throw new ConflictException(
        'Blueprints do sistema não podem ser alterados',
      );
    }

    // Não permite alterar se já publicado
    if (existing.status === 'published' && dto.status !== 'archived') {
      throw new ConflictException(
        'Blueprints publicados não podem ser alterados. Arquive primeiro ou crie uma nova versão.',
      );
    }

    // Remove is_system_blueprint do DTO pois não pode ser alterado
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { is_system_blueprint: _, ...updateData } = dto;

    const { data, error } = await this.supabase
      .getClient()
      .from('calendar_blueprints')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar blueprint: ${error.message}`);
    }

    return data;
  }

  async publish(
    id: string,
    tenantId: string,
    userId?: string,
  ): Promise<CalendarBlueprint> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Blueprint com id '${id}' não encontrado`);
    }

    if (existing.status !== 'draft') {
      throw new BadRequestException(
        'Apenas blueprints em rascunho podem ser publicados',
      );
    }

    // Verifica se tem pelo menos alguns dias
    const days = await this.findDays(id);
    if (days.length === 0) {
      throw new BadRequestException(
        'Blueprint precisa ter ao menos um dia definido para ser publicado',
      );
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('calendar_blueprints')
      .update({
        status: 'published',
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao publicar blueprint: ${error.message}`);
    }

    return data;
  }

  async archive(
    id: string,
    tenantId: string,
    userId?: string,
  ): Promise<CalendarBlueprint> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Blueprint com id '${id}' não encontrado`);
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('calendar_blueprints')
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
      throw new Error(`Erro ao arquivar blueprint: ${error.message}`);
    }

    return data;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Blueprint com id '${id}' não encontrado`);
    }

    if (existing.is_system_blueprint) {
      throw new ConflictException(
        'Blueprints do sistema não podem ser removidos',
      );
    }

    await this.softDeleteService.softDelete(
      this.supabase.getClient(),
      'calendar_blueprints',
      id,
      userId,
    );
  }

  // ============================================
  // Blueprint Days
  // ============================================

  async findDays(blueprintId: string): Promise<CalendarBlueprintDay[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('calendar_blueprint_days')
      .select('*')
      .eq('blueprint_id', blueprintId)
      .is('deleted_at', null)
      .order('day_date');

    if (error) {
      throw new Error(`Erro ao buscar dias do blueprint: ${error.message}`);
    }

    return data || [];
  }

  async findDay(
    blueprintId: string,
    dayId: string,
  ): Promise<CalendarBlueprintDay | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('calendar_blueprint_days')
      .select('*')
      .eq('id', dayId)
      .eq('blueprint_id', blueprintId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erro ao buscar dia: ${error.message}`);
    }

    return data;
  }

  async createDay(
    blueprintId: string,
    tenantId: string,
    dto: CreateBlueprintDayDto,
    userId?: string,
  ): Promise<CalendarBlueprintDay> {
    const blueprint = await this.findOne(blueprintId, tenantId);
    if (!blueprint) {
      throw new NotFoundException(
        `Blueprint com id '${blueprintId}' não encontrado`,
      );
    }

    if (blueprint.status === 'published') {
      throw new ConflictException(
        'Não é possível adicionar dias a um blueprint publicado',
      );
    }

    const insertData = {
      ...dto,
      blueprint_id: blueprintId,
      day_kind: dto.day_kind ?? 'instructional',
      is_instructional: dto.is_instructional ?? true,
      created_by: userId,
      updated_by: userId,
    };

    const { data, error } = await this.supabase
      .getClient()
      .from('calendar_blueprint_days')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          `Já existe um dia para a data ${dto.day_date} neste blueprint`,
        );
      }
      throw new Error(`Erro ao criar dia: ${error.message}`);
    }

    return data;
  }

  async createDaysBulk(
    blueprintId: string,
    tenantId: string,
    days: CreateBlueprintDayDto[],
    userId?: string,
  ): Promise<CalendarBlueprintDay[]> {
    const blueprint = await this.findOne(blueprintId, tenantId);
    if (!blueprint) {
      throw new NotFoundException(
        `Blueprint com id '${blueprintId}' não encontrado`,
      );
    }

    if (blueprint.status === 'published') {
      throw new ConflictException(
        'Não é possível adicionar dias a um blueprint publicado',
      );
    }

    const insertData = days.map((dto) => ({
      ...dto,
      blueprint_id: blueprintId,
      day_kind: dto.day_kind ?? 'instructional',
      is_instructional: dto.is_instructional ?? true,
      created_by: userId,
      updated_by: userId,
    }));

    const { data, error } = await this.supabase
      .getClient()
      .from('calendar_blueprint_days')
      .insert(insertData)
      .select();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          'Algumas datas já existem neste blueprint. Verifique as datas duplicadas.',
        );
      }
      throw new Error(`Erro ao criar dias em lote: ${error.message}`);
    }

    return data || [];
  }

  async updateDay(
    blueprintId: string,
    dayId: string,
    tenantId: string,
    dto: UpdateBlueprintDayDto,
    userId?: string,
  ): Promise<CalendarBlueprintDay> {
    const blueprint = await this.findOne(blueprintId, tenantId);
    if (!blueprint) {
      throw new NotFoundException(
        `Blueprint com id '${blueprintId}' não encontrado`,
      );
    }

    if (blueprint.status === 'published') {
      throw new ConflictException(
        'Não é possível alterar dias de um blueprint publicado',
      );
    }

    const existing = await this.findDay(blueprintId, dayId);
    if (!existing) {
      throw new NotFoundException(`Dia com id '${dayId}' não encontrado`);
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('calendar_blueprint_days')
      .update({
        ...dto,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', dayId)
      .eq('blueprint_id', blueprintId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar dia: ${error.message}`);
    }

    return data;
  }

  async removeDay(
    blueprintId: string,
    dayId: string,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const blueprint = await this.findOne(blueprintId, tenantId);
    if (!blueprint) {
      throw new NotFoundException(
        `Blueprint com id '${blueprintId}' não encontrado`,
      );
    }

    if (blueprint.status === 'published') {
      throw new ConflictException(
        'Não é possível remover dias de um blueprint publicado',
      );
    }

    const existing = await this.findDay(blueprintId, dayId);
    if (!existing) {
      throw new NotFoundException(`Dia com id '${dayId}' não encontrado`);
    }

    await this.softDeleteService.softDelete(
      this.supabase.getClient(),
      'calendar_blueprint_days',
      dayId,
      userId,
    );
  }

  // ============================================
  // Blueprint Events
  // ============================================

  async findEvents(blueprintId: string): Promise<CalendarBlueprintEvent[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('calendar_blueprint_events')
      .select('*')
      .eq('blueprint_id', blueprintId)
      .is('deleted_at', null)
      .order('start_date')
      .order('title');

    if (error) {
      throw new Error(`Erro ao buscar eventos do blueprint: ${error.message}`);
    }

    return data || [];
  }

  async findEvent(
    blueprintId: string,
    eventId: string,
  ): Promise<CalendarBlueprintEvent | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('calendar_blueprint_events')
      .select('*')
      .eq('id', eventId)
      .eq('blueprint_id', blueprintId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erro ao buscar evento: ${error.message}`);
    }

    return data;
  }

  async createEvent(
    blueprintId: string,
    tenantId: string,
    dto: CreateBlueprintEventDto,
    userId?: string,
  ): Promise<CalendarBlueprintEvent> {
    const blueprint = await this.findOne(blueprintId, tenantId);
    if (!blueprint) {
      throw new NotFoundException(
        `Blueprint com id '${blueprintId}' não encontrado`,
      );
    }

    if (blueprint.status === 'published') {
      throw new ConflictException(
        'Não é possível adicionar eventos a um blueprint publicado',
      );
    }

    // Valida datas
    if (new Date(dto.end_date) < new Date(dto.start_date)) {
      throw new BadRequestException(
        'Data final não pode ser anterior à data inicial',
      );
    }

    const insertData = {
      ...dto,
      blueprint_id: blueprintId,
      is_all_day: dto.is_all_day ?? true,
      affects_instruction: dto.affects_instruction ?? false,
      visibility: dto.visibility ?? 'internal',
      created_by: userId,
      updated_by: userId,
    };

    const { data, error } = await this.supabase
      .getClient()
      .from('calendar_blueprint_events')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar evento: ${error.message}`);
    }

    return data;
  }

  async updateEvent(
    blueprintId: string,
    eventId: string,
    tenantId: string,
    dto: UpdateBlueprintEventDto,
    userId?: string,
  ): Promise<CalendarBlueprintEvent> {
    const blueprint = await this.findOne(blueprintId, tenantId);
    if (!blueprint) {
      throw new NotFoundException(
        `Blueprint com id '${blueprintId}' não encontrado`,
      );
    }

    if (blueprint.status === 'published') {
      throw new ConflictException(
        'Não é possível alterar eventos de um blueprint publicado',
      );
    }

    const existing = await this.findEvent(blueprintId, eventId);
    if (!existing) {
      throw new NotFoundException(`Evento com id '${eventId}' não encontrado`);
    }

    // Valida datas se ambas forem fornecidas
    const startDate = dto.start_date ?? existing.start_date;
    const endDate = dto.end_date ?? existing.end_date;
    if (new Date(endDate) < new Date(startDate)) {
      throw new BadRequestException(
        'Data final não pode ser anterior à data inicial',
      );
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('calendar_blueprint_events')
      .update({
        ...dto,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', eventId)
      .eq('blueprint_id', blueprintId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar evento: ${error.message}`);
    }

    return data;
  }

  async removeEvent(
    blueprintId: string,
    eventId: string,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const blueprint = await this.findOne(blueprintId, tenantId);
    if (!blueprint) {
      throw new NotFoundException(
        `Blueprint com id '${blueprintId}' não encontrado`,
      );
    }

    if (blueprint.status === 'published') {
      throw new ConflictException(
        'Não é possível remover eventos de um blueprint publicado',
      );
    }

    const existing = await this.findEvent(blueprintId, eventId);
    if (!existing) {
      throw new NotFoundException(`Evento com id '${eventId}' não encontrado`);
    }

    await this.softDeleteService.softDelete(
      this.supabase.getClient(),
      'calendar_blueprint_events',
      eventId,
      userId,
    );
  }
}
