import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { LeaderboardDefinition } from '../common/types';
import {
  CreateLeaderboardDefinitionDto,
  UpdateLeaderboardDefinitionDto,
} from './dto/create-leaderboard-definition.dto';

@Injectable()
export class LeaderboardDefinitionsService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
    private softDeleteService: SoftDeleteService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  async findAll(
    tenantId: string,
    options?: {
      schoolId?: string;
      isActive?: boolean;
      scope?: string;
      academicYearId?: string;
    },
  ): Promise<LeaderboardDefinition[]> {
    let query = this.supabase
      .from('leaderboard_definitions')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('name', { ascending: true });
    if (options?.schoolId) query = query.eq('school_id', options.schoolId);
    if (options?.isActive !== undefined)
      query = query.eq('is_active', options.isActive);
    if (options?.scope) query = query.eq('scope', options.scope);
    if (options?.academicYearId)
      query = query.eq('academic_year_id', options.academicYearId);
    const { data, error } = await query;
    if (error)
      throw new Error(
        `Failed to list leaderboard definitions: ${error.message}`,
      );
    return (data || []) as LeaderboardDefinition[];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<LeaderboardDefinition | null> {
    const { data, error } = await this.supabase
      .from('leaderboard_definitions')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get leaderboard definition: ${error.message}`);
    }
    return data as LeaderboardDefinition;
  }

  async create(
    tenantId: string,
    dto: CreateLeaderboardDefinitionDto,
    userId?: string,
  ): Promise<LeaderboardDefinition> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('leaderboard_definitions')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id ?? null,
        key: dto.key,
        name: dto.name,
        description: dto.description ?? null,
        scope: dto.scope,
        grade_level_id: dto.grade_level_id ?? null,
        class_group_id: dto.class_group_id ?? null,
        academic_year_id: dto.academic_year_id,
        grading_period_id: dto.grading_period_id ?? null,
        metric_definition_id: dto.metric_definition_id,
        subject_id: dto.subject_id ?? null,
        sort_direction: dto.sort_direction ?? 'desc',
        top_n: dto.top_n ?? 50,
        min_cohort_size: dto.min_cohort_size ?? 8,
        is_active: dto.is_active ?? true,
        metadata: dto.metadata ?? {},
        created_at: now,
        created_by: userId ?? null,
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505')
        throw new ConflictException('Já existe um leaderboard com esta chave');
      throw new Error(
        `Failed to create leaderboard definition: ${error.message}`,
      );
    }
    this.logger.log(
      'Leaderboard definition created',
      'LeaderboardDefinitionsService',
      { id: data.id, key: dto.key },
    );
    return data as LeaderboardDefinition;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateLeaderboardDefinitionDto,
  ): Promise<LeaderboardDefinition> {
    const existing = await this.findOne(id, tenantId);
    if (!existing)
      throw new NotFoundException(
        `Leaderboard definition com id '${id}' não encontrada`,
      );
    const { data, error } = await this.supabase
      .from('leaderboard_definitions')
      .update({ ...dto })
      .eq('id', id)
      .select()
      .single();
    if (error)
      throw new Error(
        `Failed to update leaderboard definition: ${error.message}`,
      );
    return data as LeaderboardDefinition;
  }

  async activate(id: string, tenantId: string): Promise<LeaderboardDefinition> {
    return this.update(id, tenantId, { is_active: true });
  }
  async deactivate(
    id: string,
    tenantId: string,
  ): Promise<LeaderboardDefinition> {
    return this.update(id, tenantId, { is_active: false });
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing)
      throw new NotFoundException(
        `Leaderboard definition com id '${id}' não encontrada`,
      );
    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'leaderboard_definitions',
      id,
      userId,
    );
    if (!result.success)
      throw new Error(
        `Failed to delete leaderboard definition: ${result.error}`,
      );
  }
}
