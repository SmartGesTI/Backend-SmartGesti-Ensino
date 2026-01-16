/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { CreateCalendarEventTypeDto } from './dto/create-calendar-event-type.dto';
import { UpdateCalendarEventTypeDto } from './dto/update-calendar-event-type.dto';
import type { CalendarEventType, CalendarEventCategory } from '../common/types';

interface FindAllFilters {
  category?: CalendarEventCategory;
  isSystem?: boolean;
  includeDeleted?: boolean;
}

@Injectable()
export class CalendarEventTypesService {
  constructor(
    private supabase: SupabaseService,
    private softDeleteService: SoftDeleteService,
  ) {}

  /**
   * Lista tipos de evento
   * - Tipos do sistema (is_system_type=true) são visíveis para todos
   * - Tipos do tenant são filtrados por tenant_id
   */
  async findAll(
    tenantId: string,
    filters: FindAllFilters = {},
  ): Promise<CalendarEventType[]> {
    let query = this.supabase
      .getClient()
      .from('calendar_event_types')
      .select('*')
      .or(`tenant_id.eq.${tenantId},is_system_type.eq.true`);

    if (!filters.includeDeleted) {
      query = query.is('deleted_at', null);
    }

    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    if (filters.isSystem !== undefined) {
      query = query.eq('is_system_type', filters.isSystem);
    }

    query = query
      .order('is_system_type', { ascending: false })
      .order('category')
      .order('name');

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar tipos de evento: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Busca tipo de evento por ID
   */
  async findOne(
    id: string,
    tenantId: string,
  ): Promise<CalendarEventType | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('calendar_event_types')
      .select('*')
      .eq('id', id)
      .or(`tenant_id.eq.${tenantId},is_system_type.eq.true`)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erro ao buscar tipo de evento: ${error.message}`);
    }

    return data;
  }

  /**
   * Busca tipo de evento por slug
   */
  async findBySlug(
    slug: string,
    tenantId: string,
  ): Promise<CalendarEventType | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('calendar_event_types')
      .select('*')
      .eq('slug', slug)
      .or(`tenant_id.eq.${tenantId},is_system_type.eq.true`)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(
        `Erro ao buscar tipo de evento por slug: ${error.message}`,
      );
    }

    return data;
  }

  /**
   * Cria novo tipo de evento
   */
  async create(
    tenantId: string,
    dto: CreateCalendarEventTypeDto,
    userId?: string,
  ): Promise<CalendarEventType> {
    // Verifica se já existe com mesmo slug
    const existing = await this.findBySlug(dto.slug, tenantId);
    if (existing) {
      throw new ConflictException(
        `Tipo de evento com slug '${dto.slug}' já existe`,
      );
    }

    // Tipos do sistema só podem ser criados sem tenant_id
    const isSystem = dto.is_system_type ?? false;

    const insertData = {
      ...dto,
      tenant_id: isSystem ? null : tenantId,
      is_system_type: isSystem,
      created_by: userId,
      updated_by: userId,
    };

    const { data, error } = await this.supabase
      .getClient()
      .from('calendar_event_types')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar tipo de evento: ${error.message}`);
    }

    return data;
  }

  /**
   * Atualiza tipo de evento
   * - Tipos do sistema não podem ser atualizados por tenants normais
   */
  async update(
    id: string,
    tenantId: string,
    dto: UpdateCalendarEventTypeDto,
    userId?: string,
  ): Promise<CalendarEventType> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `Tipo de evento com id '${id}' não encontrado`,
      );
    }

    // Tipos do sistema não podem ser editados (a menos que seja admin do sistema)
    if (existing.is_system_type) {
      throw new ConflictException(
        'Tipos de evento do sistema não podem ser alterados',
      );
    }

    // Verifica conflito de slug se estiver alterando
    if (dto.slug && dto.slug !== existing.slug) {
      const conflicting = await this.findBySlug(dto.slug, tenantId);
      if (conflicting && conflicting.id !== id) {
        throw new ConflictException(
          `Tipo de evento com slug '${dto.slug}' já existe`,
        );
      }
    }

    // Não permite mudar is_system_type
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { is_system_type: _, ...updateData } = dto;

    const { data, error } = await this.supabase
      .getClient()
      .from('calendar_event_types')
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
      throw new Error(`Erro ao atualizar tipo de evento: ${error.message}`);
    }

    return data;
  }

  /**
   * Remove tipo de evento (soft delete)
   */
  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `Tipo de evento com id '${id}' não encontrado`,
      );
    }

    if (existing.is_system_type) {
      throw new ConflictException(
        'Tipos de evento do sistema não podem ser removidos',
      );
    }

    await this.softDeleteService.softDelete(
      this.supabase.getClient(),
      'calendar_event_types',
      id,
      userId,
    );
  }

  /**
   * Restaura tipo de evento
   */
  async restore(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const restored = await this.softDeleteService.restore(
      this.supabase.getClient(),
      'calendar_event_types',
      id,
      userId,
    );

    if (!restored.success) {
      throw new NotFoundException(
        `Tipo de evento com id '${id}' não encontrado`,
      );
    }

    return restored;
  }
}
