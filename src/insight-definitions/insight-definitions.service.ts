import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { InsightDefinition } from '../common/types';
import {
  CreateInsightDefinitionDto,
  UpdateInsightDefinitionDto,
} from './dto/create-insight-definition.dto';

@Injectable()
export class InsightDefinitionsService {
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
      category?: string;
      severity?: string;
    },
  ): Promise<InsightDefinition[]> {
    let query = this.supabase
      .from('insight_definitions')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('name', { ascending: true });
    if (options?.schoolId) query = query.eq('school_id', options.schoolId);
    if (options?.isActive !== undefined)
      query = query.eq('is_active', options.isActive);
    if (options?.category) query = query.eq('category', options.category);
    if (options?.severity) query = query.eq('severity', options.severity);
    const { data, error } = await query;
    if (error)
      throw new Error(`Failed to list insight definitions: ${error.message}`);
    return (data || []) as InsightDefinition[];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<InsightDefinition | null> {
    const { data, error } = await this.supabase
      .from('insight_definitions')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get insight definition: ${error.message}`);
    }
    return data as InsightDefinition;
  }

  async create(
    tenantId: string,
    dto: CreateInsightDefinitionDto,
    userId?: string,
  ): Promise<InsightDefinition> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('insight_definitions')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id ?? null,
        key: dto.key,
        name: dto.name,
        description: dto.description ?? null,
        category: dto.category ?? 'academic',
        severity: dto.severity ?? 'info',
        target_kind: dto.target_kind ?? 'student',
        metric_definition_id: dto.metric_definition_id ?? null,
        rule: dto.rule ?? {},
        recommended_actions: dto.recommended_actions ?? [],
        publish_policy: dto.publish_policy ?? 'internal_only',
        requires_consent: dto.requires_consent ?? true,
        consent_type: dto.consent_type ?? 'communication',
        min_cohort_size: dto.min_cohort_size ?? 8,
        is_active: dto.is_active ?? true,
        metadata: dto.metadata ?? {},
        ai_context: dto.ai_context ?? {},
        created_at: now,
        updated_at: now,
        created_by: userId ?? null,
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505')
        throw new ConflictException('Já existe um insight com esta chave');
      throw new Error(`Failed to create insight definition: ${error.message}`);
    }
    this.logger.log('Insight definition created', 'InsightDefinitionsService', {
      id: data.id,
      key: dto.key,
    });
    return data as InsightDefinition;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateInsightDefinitionDto,
    userId?: string,
  ): Promise<InsightDefinition> {
    const existing = await this.findOne(id, tenantId);
    if (!existing)
      throw new NotFoundException(
        `Insight definition com id '${id}' não encontrada`,
      );
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('insight_definitions')
      .update({ ...dto, updated_at: now, updated_by: userId ?? null })
      .eq('id', id)
      .select()
      .single();
    if (error)
      throw new Error(`Failed to update insight definition: ${error.message}`);
    return data as InsightDefinition;
  }

  async activate(
    id: string,
    tenantId: string,
    userId?: string,
  ): Promise<InsightDefinition> {
    return this.update(id, tenantId, { is_active: true }, userId);
  }
  async deactivate(
    id: string,
    tenantId: string,
    userId?: string,
  ): Promise<InsightDefinition> {
    return this.update(id, tenantId, { is_active: false }, userId);
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing)
      throw new NotFoundException(
        `Insight definition com id '${id}' não encontrada`,
      );
    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'insight_definitions',
      id,
      userId,
    );
    if (!result.success)
      throw new Error(`Failed to delete insight definition: ${result.error}`);
  }
}
