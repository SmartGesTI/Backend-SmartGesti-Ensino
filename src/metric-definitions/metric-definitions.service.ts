import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { MetricDefinition } from '../common/types';
import {
  CreateMetricDefinitionDto,
  UpdateMetricDefinitionDto,
} from './dto/create-metric-definition.dto';

@Injectable()
export class MetricDefinitionsService {
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
      metricKind?: string;
    },
  ): Promise<MetricDefinition[]> {
    let query = this.supabase
      .from('metric_definitions')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (options?.schoolId) {
      query = query.eq('school_id', options.schoolId);
    }

    if (options?.isActive !== undefined) {
      query = query.eq('is_active', options.isActive);
    }

    if (options?.metricKind) {
      query = query.eq('metric_kind', options.metricKind);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to list metric definitions: ${error.message}`,
        undefined,
        'MetricDefinitionsService',
      );
      throw new Error(`Failed to list metric definitions: ${error.message}`);
    }

    return (data || []) as MetricDefinition[];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<MetricDefinition | null> {
    const { data, error } = await this.supabase
      .from('metric_definitions')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get metric definition: ${error.message}`);
    }

    return data as MetricDefinition;
  }

  async findByKey(
    key: string,
    tenantId: string,
    schoolId?: string,
  ): Promise<MetricDefinition | null> {
    let query = this.supabase
      .from('metric_definitions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('key', key)
      .is('deleted_at', null);

    if (schoolId) {
      query = query.eq('school_id', schoolId);
    } else {
      query = query.is('school_id', null);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get metric definition: ${error.message}`);
    }

    return data as MetricDefinition;
  }

  async create(
    tenantId: string,
    dto: CreateMetricDefinitionDto,
    userId?: string,
  ): Promise<MetricDefinition> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('metric_definitions')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id ?? null,
        key: dto.key,
        name: dto.name,
        description: dto.description ?? null,
        metric_kind: dto.metric_kind ?? 'number',
        value_type: dto.value_type ?? 'numeric',
        unit: dto.unit ?? null,
        aggregation_default: dto.aggregation_default ?? 'mean',
        dimensions: dto.dimensions ?? {},
        source_tables: dto.source_tables ?? [],
        source_definition: dto.source_definition ?? {},
        visibility: dto.visibility ?? 'internal',
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
      if (error.code === '23505') {
        throw new ConflictException('Já existe uma métrica com esta chave');
      }
      this.logger.error(
        `Failed to create metric definition: ${error.message}`,
        undefined,
        'MetricDefinitionsService',
      );
      throw new Error(`Failed to create metric definition: ${error.message}`);
    }

    this.logger.log('Metric definition created', 'MetricDefinitionsService', {
      id: data.id,
      key: dto.key,
    });

    return data as MetricDefinition;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateMetricDefinitionDto,
    userId?: string,
  ): Promise<MetricDefinition> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `Metric definition com id '${id}' não encontrada`,
      );
    }

    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('metric_definitions')
      .update({
        ...dto,
        updated_at: now,
        updated_by: userId ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update metric definition: ${error.message}`);
    }

    this.logger.log('Metric definition updated', 'MetricDefinitionsService', {
      id,
    });

    return data as MetricDefinition;
  }

  async activate(
    id: string,
    tenantId: string,
    userId?: string,
  ): Promise<MetricDefinition> {
    return this.update(id, tenantId, { is_active: true }, userId);
  }

  async deactivate(
    id: string,
    tenantId: string,
    userId?: string,
  ): Promise<MetricDefinition> {
    return this.update(id, tenantId, { is_active: false }, userId);
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `Metric definition com id '${id}' não encontrada`,
      );
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'metric_definitions',
      id,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete metric definition: ${result.error}`);
    }

    this.logger.log('Metric definition deleted', 'MetricDefinitionsService', {
      id,
    });
  }
}
