/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { CreateCalendarDayTypeDto } from './dto/create-calendar-day-type.dto';
import { UpdateCalendarDayTypeDto } from './dto/update-calendar-day-type.dto';
import type {
  CalendarDayType,
  CalendarDayTypeUsageSummary,
  DayTypeDisplayConfig,
} from '../common/types';

interface FindAllFilters {
  includeSystem?: boolean;
  includeShared?: boolean;
  includeDeleted?: boolean;
}

interface UsageCheckResult {
  canDelete: boolean;
  usedBySchools: string[];
  totalSchoolsUsing: number;
}

@Injectable()
export class CalendarDayTypesService {
  constructor(
    private supabase: SupabaseService,
    private softDeleteService: SoftDeleteService,
  ) {}

  /**
   * Lista tipos de dia visiveis para uma escola:
   * 1. Tipos do sistema (is_system_type=true)
   * 2. Tipos compartilhados no tenant (is_shared=true AND tenant_id=X)
   * 3. Tipos privados da escola (school_id=X)
   * 
   * Se schoolId for null, retorna apenas tipos do sistema
   */
  async findAll(
    tenantId: string,
    schoolId: string | null,
    filters: FindAllFilters = {},
  ): Promise<CalendarDayType[]> {
    const { includeSystem = true, includeShared = true, includeDeleted = false } = filters;

    // Construir query OR
    const orConditions: string[] = [];

    if (includeSystem) {
      orConditions.push('is_system_type.eq.true');
    }

    // Se nao tem schoolId, retorna apenas tipos do sistema
    if (!schoolId) {
      if (orConditions.length === 0) {
        return [];
      }
    } else {
      if (includeShared) {
        orConditions.push(`and(is_shared.eq.true,tenant_id.eq.${tenantId})`);
      }

      // Incluir tipos privados da escola
      orConditions.push(`school_id.eq.${schoolId}`);
    }

    let query = this.supabase
      .getClient()
      .from('calendar_day_types')
      .select('*')
      .or(orConditions.join(','));

    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }

    query = query
      .order('is_system_type', { ascending: false })
      .order('order_index')
      .order('name');

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar tipos de dia: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Busca tipo de dia por ID
   */
  async findOne(
    id: string,
    tenantId: string,
    schoolId: string,
  ): Promise<CalendarDayType | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('calendar_day_types')
      .select('*')
      .eq('id', id)
      .or(
        `is_system_type.eq.true,and(is_shared.eq.true,tenant_id.eq.${tenantId}),school_id.eq.${schoolId}`,
      )
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erro ao buscar tipo de dia: ${error.message}`);
    }

    return data;
  }

  /**
   * Busca tipo de dia por slug
   */
  async findBySlug(
    slug: string,
    tenantId: string,
    schoolId: string,
  ): Promise<CalendarDayType | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('calendar_day_types')
      .select('*')
      .eq('slug', slug)
      .or(
        `is_system_type.eq.true,and(is_shared.eq.true,tenant_id.eq.${tenantId}),school_id.eq.${schoolId}`,
      )
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erro ao buscar tipo de dia por slug: ${error.message}`);
    }

    return data;
  }

  /**
   * Cria novo tipo de dia
   */
  async create(
    tenantId: string,
    schoolId: string,
    dto: CreateCalendarDayTypeDto,
    userId?: string,
  ): Promise<CalendarDayType> {
    // Verifica se ja existe com mesmo slug no escopo
    const existing = await this.findBySlug(dto.slug, tenantId, schoolId);
    if (existing) {
      throw new ConflictException(
        `Tipo de dia com slug '${dto.slug}' ja existe`,
      );
    }

    const isShared = dto.is_shared ?? false;

    const insertData = {
      slug: dto.slug,
      name: dto.name,
      description: dto.description,
      affects_instruction: dto.affects_instruction,
      is_system_type: false,
      is_shared: isShared,
      tenant_id: tenantId,
      // Se compartilhado, school_id = null; senao, school_id = schoolId
      school_id: isShared ? null : schoolId,
      created_by_school_id: schoolId,
      display_config: dto.display_config,
      order_index: dto.order_index ?? 0,
      is_visible_in_legend: dto.is_visible_in_legend ?? true,
      created_by: userId,
      updated_by: userId,
    };

    const { data, error } = await this.supabase
      .getClient()
      .from('calendar_day_types')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar tipo de dia: ${error.message}`);
    }

    return data;
  }

  /**
   * Atualiza tipo de dia
   * - Tipos do sistema: permite apenas alteracao de display_config
   * - Tipos de outra escola: bloquear
   * - Tipos compartilhados: apenas escola criadora pode editar
   */
  async update(
    id: string,
    tenantId: string,
    schoolId: string,
    dto: UpdateCalendarDayTypeDto,
    userId?: string,
  ): Promise<CalendarDayType> {
    const existing = await this.findOne(id, tenantId, schoolId);
    if (!existing) {
      throw new NotFoundException(`Tipo de dia com id '${id}' nao encontrado`);
    }

    // Tipos do sistema: apenas display_config pode ser alterado (customizacao visual)
    if (existing.is_system_type) {
      // Criar copia local customizada do tipo do sistema
      // Por enquanto, bloquear edicao de tipos do sistema
      throw new ForbiddenException(
        'Tipos de dia do sistema nao podem ser editados diretamente. Crie uma copia customizada.',
      );
    }

    // Verificar ownership
    if (existing.created_by_school_id !== schoolId) {
      throw new ForbiddenException(
        'Apenas a escola criadora pode editar este tipo de dia',
      );
    }

    // Mesclar display_config se fornecido parcialmente
    let updatedDisplayConfig = existing.display_config;
    if (dto.display_config) {
      updatedDisplayConfig = {
        ...existing.display_config,
        ...dto.display_config,
        border: dto.display_config.border
          ? { ...existing.display_config.border, ...dto.display_config.border }
          : existing.display_config.border,
      } as DayTypeDisplayConfig;
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('calendar_day_types')
      .update({
        name: dto.name ?? existing.name,
        description: dto.description ?? existing.description,
        affects_instruction: dto.affects_instruction ?? existing.affects_instruction,
        display_config: updatedDisplayConfig,
        order_index: dto.order_index ?? existing.order_index,
        is_visible_in_legend: dto.is_visible_in_legend ?? existing.is_visible_in_legend,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar tipo de dia: ${error.message}`);
    }

    return data;
  }

  /**
   * Compartilha ou descompartilha um tipo de dia
   */
  async share(
    id: string,
    tenantId: string,
    schoolId: string,
    isShared: boolean,
    userId?: string,
  ): Promise<CalendarDayType> {
    const existing = await this.findOne(id, tenantId, schoolId);
    if (!existing) {
      throw new NotFoundException(`Tipo de dia com id '${id}' nao encontrado`);
    }

    if (existing.is_system_type) {
      throw new ForbiddenException(
        'Tipos do sistema nao podem ser compartilhados',
      );
    }

    // Apenas escola criadora pode alterar compartilhamento
    if (existing.created_by_school_id !== schoolId) {
      throw new ForbiddenException(
        'Apenas a escola criadora pode alterar o compartilhamento',
      );
    }

    // Se descompartilhando, verificar se outras escolas estao usando
    if (!isShared && existing.is_shared) {
      const usage = await this.checkUsage(id, schoolId);
      if (!usage.canDelete) {
        throw new ConflictException(
          `Nao e possivel descompartilhar. Tipo em uso por: ${usage.usedBySchools.join(', ')}`,
        );
      }
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('calendar_day_types')
      .update({
        is_shared: isShared,
        // Se compartilhando, school_id = null; se descompartilhando, school_id = schoolId
        school_id: isShared ? null : schoolId,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao alterar compartilhamento: ${error.message}`);
    }

    return data;
  }

  /**
   * Verifica uso de um tipo de dia por outras escolas
   */
  async checkUsage(dayTypeId: string, schoolId: string): Promise<UsageCheckResult> {
    const { data, error } = await this.supabase
      .getClient()
      .from('v_calendar_day_type_usage_summary')
      .select('*')
      .eq('day_type_id', dayTypeId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Nao encontrado na view = nao e compartilhado ou nao tem uso
        return {
          canDelete: true,
          usedBySchools: [],
          totalSchoolsUsing: 0,
        };
      }
      throw new Error(`Erro ao verificar uso: ${error.message}`);
    }

    const summary = data as CalendarDayTypeUsageSummary;

    return {
      canDelete: summary.other_schools_using === 0,
      usedBySchools: summary.other_school_names || [],
      totalSchoolsUsing: summary.total_schools_using,
    };
  }

  /**
   * Remove tipo de dia (soft delete)
   */
  async remove(
    id: string,
    tenantId: string,
    schoolId: string,
    userId: string,
  ): Promise<void> {
    const existing = await this.findOne(id, tenantId, schoolId);
    if (!existing) {
      throw new NotFoundException(`Tipo de dia com id '${id}' nao encontrado`);
    }

    if (existing.is_system_type) {
      throw new ForbiddenException(
        'Tipos de dia do sistema nao podem ser removidos',
      );
    }

    // Verificar ownership
    if (existing.created_by_school_id !== schoolId) {
      throw new ForbiddenException(
        'Apenas a escola criadora pode remover este tipo de dia',
      );
    }

    // Verificar uso por outras escolas
    const usage = await this.checkUsage(id, schoolId);
    if (!usage.canDelete) {
      throw new ConflictException(
        `Nao e possivel remover. Tipo em uso por: ${usage.usedBySchools.join(', ')}`,
      );
    }

    await this.softDeleteService.softDelete(
      this.supabase.getClient(),
      'calendar_day_types',
      id,
      userId,
    );
  }
}
