import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { MetricValue } from '../common/types';
import {
  CreateMetricValueDto,
  ComputeMetricValuesDto,
} from './dto/create-metric-value.dto';

@Injectable()
export class MetricValuesService {
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
      metricDefinitionId?: string;
      academicYearId?: string;
      gradingPeriodId?: string;
      targetKind?: string;
      studentId?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<MetricValue[]> {
    let query = this.supabase
      .from('metric_values')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (options?.schoolId) query = query.eq('school_id', options.schoolId);
    if (options?.metricDefinitionId)
      query = query.eq('metric_definition_id', options.metricDefinitionId);
    if (options?.academicYearId)
      query = query.eq('academic_year_id', options.academicYearId);
    if (options?.gradingPeriodId)
      query = query.eq('grading_period_id', options.gradingPeriodId);
    if (options?.targetKind)
      query = query.eq('target_kind', options.targetKind);
    if (options?.studentId) query = query.eq('student_id', options.studentId);
    if (options?.limit) query = query.limit(options.limit);
    if (options?.offset)
      query = query.range(
        options.offset,
        options.offset + (options.limit || 50) - 1,
      );

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to list metric values: ${error.message}`,
        undefined,
        'MetricValuesService',
      );
      throw new Error(`Failed to list metric values: ${error.message}`);
    }

    return (data || []) as MetricValue[];
  }

  async findOne(id: string, tenantId: string): Promise<MetricValue | null> {
    const { data, error } = await this.supabase
      .from('metric_values')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get metric value: ${error.message}`);
    }

    return data as MetricValue;
  }

  async create(
    tenantId: string,
    dto: CreateMetricValueDto,
    userId?: string,
  ): Promise<MetricValue> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('metric_values')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id ?? null,
        metric_definition_id: dto.metric_definition_id,
        academic_year_id: dto.academic_year_id,
        grading_period_id: dto.grading_period_id ?? null,
        as_of_date: dto.as_of_date ?? null,
        target_kind: dto.target_kind,
        student_id: dto.student_id ?? null,
        enrollment_id: dto.enrollment_id ?? null,
        class_group_id: dto.class_group_id ?? null,
        grade_level_id: dto.grade_level_id ?? null,
        subject_id: dto.subject_id ?? null,
        target_key: dto.target_key,
        period_key: dto.period_key ?? 'all_time',
        dimension_key: dto.dimension_key ?? '',
        value_numeric: dto.value_numeric ?? null,
        value_integer: dto.value_integer ?? null,
        value_text: dto.value_text ?? null,
        value_json: dto.value_json ?? {},
        sample_size: dto.sample_size ?? null,
        quality_status: dto.quality_status ?? 'ok',
        computed_at: now,
        computed_by: userId ?? null,
        computed_from: dto.computed_from ?? {},
        notes: dto.notes ?? null,
        metadata: dto.metadata ?? {},
        ai_context: dto.ai_context ?? {},
        created_at: now,
        updated_at: now,
        created_by: userId ?? null,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        `Failed to create metric value: ${error.message}`,
        undefined,
        'MetricValuesService',
      );
      throw new Error(`Failed to create metric value: ${error.message}`);
    }

    this.logger.log('Metric value created', 'MetricValuesService', {
      id: data.id,
    });
    return data as MetricValue;
  }

  async compute(
    tenantId: string,
    dto: ComputeMetricValuesDto,
    userId?: string,
  ): Promise<{ message: string; count: number }> {
    // TODO: Implementar lógica real de cálculo de métricas
    // Por enquanto, apenas registra a intenção
    this.logger.log('Compute metric values requested', 'MetricValuesService', {
      metricDefinitionId: dto.metric_definition_id,
      academicYearId: dto.academic_year_id,
    });

    return {
      message: 'Compute triggered (implementation pending)',
      count: 0,
    };
  }

  async recompute(
    id: string,
    tenantId: string,
    userId?: string,
  ): Promise<MetricValue> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Metric value com id '${id}' não encontrado`);
    }

    // TODO: Implementar lógica real de recálculo
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('metric_values')
      .update({
        computed_at: now,
        computed_by: userId ?? null,
        updated_at: now,
        updated_by: userId ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to recompute metric value: ${error.message}`);
    }

    this.logger.log('Metric value recomputed', 'MetricValuesService', { id });
    return data as MetricValue;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Metric value com id '${id}' não encontrado`);
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'metric_values',
      id,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete metric value: ${result.error}`);
    }

    this.logger.log('Metric value deleted', 'MetricValuesService', { id });
  }
}
