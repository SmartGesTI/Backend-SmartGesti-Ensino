import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { CohortMetricStats } from '../common/types';
import {
  CreateCohortMetricStatsDto,
  ComputeCohortStatsDto,
} from './dto/create-cohort-metric-stats.dto';

@Injectable()
export class CohortMetricStatsService {
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
      cohortKind?: string;
      limit?: number;
    },
  ): Promise<CohortMetricStats[]> {
    let query = this.supabase
      .from('cohort_metric_stats')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (options?.schoolId) query = query.eq('school_id', options.schoolId);
    if (options?.metricDefinitionId)
      query = query.eq('metric_definition_id', options.metricDefinitionId);
    if (options?.academicYearId)
      query = query.eq('academic_year_id', options.academicYearId);
    if (options?.cohortKind)
      query = query.eq('cohort_kind', options.cohortKind);
    if (options?.limit) query = query.limit(options.limit);

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to list cohort metric stats: ${error.message}`,
        undefined,
        'CohortMetricStatsService',
      );
      throw new Error(`Failed to list cohort metric stats: ${error.message}`);
    }

    return (data || []) as CohortMetricStats[];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<CohortMetricStats | null> {
    const { data, error } = await this.supabase
      .from('cohort_metric_stats')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get cohort metric stats: ${error.message}`);
    }

    return data as CohortMetricStats;
  }

  async create(
    tenantId: string,
    dto: CreateCohortMetricStatsDto,
    userId?: string,
  ): Promise<CohortMetricStats> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('cohort_metric_stats')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id ?? null,
        metric_definition_id: dto.metric_definition_id,
        academic_year_id: dto.academic_year_id,
        grading_period_id: dto.grading_period_id ?? null,
        as_of_date: dto.as_of_date ?? null,
        cohort_kind: dto.cohort_kind,
        class_group_id: dto.class_group_id ?? null,
        grade_level_id: dto.grade_level_id ?? null,
        subject_id: dto.subject_id ?? null,
        cohort_key: dto.cohort_key,
        period_key: dto.period_key ?? 'all_time',
        dimension_key: dto.dimension_key ?? '',
        n: dto.n,
        mean: dto.mean ?? null,
        median: dto.median ?? null,
        stddev: dto.stddev ?? null,
        min: dto.min ?? null,
        max: dto.max ?? null,
        p10: dto.p10 ?? null,
        p25: dto.p25 ?? null,
        p50: dto.p50 ?? null,
        p75: dto.p75 ?? null,
        p90: dto.p90 ?? null,
        quality_status: dto.quality_status ?? 'ok',
        computed_at: now,
        computed_by: userId ?? null,
        computed_from: dto.computed_from ?? {},
        metadata: dto.metadata ?? {},
        created_at: now,
        updated_at: now,
        created_by: userId ?? null,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        `Failed to create cohort metric stats: ${error.message}`,
        undefined,
        'CohortMetricStatsService',
      );
      throw new Error(`Failed to create cohort metric stats: ${error.message}`);
    }

    this.logger.log('Cohort metric stats created', 'CohortMetricStatsService', {
      id: data.id,
    });
    return data as CohortMetricStats;
  }

  async compute(
    tenantId: string,
    dto: ComputeCohortStatsDto,
    userId?: string,
  ): Promise<{ message: string; count: number }> {
    this.logger.log(
      'Compute cohort stats requested',
      'CohortMetricStatsService',
      {
        metricDefinitionId: dto.metric_definition_id,
        academicYearId: dto.academic_year_id,
      },
    );

    return { message: 'Compute triggered (implementation pending)', count: 0 };
  }

  async recompute(
    id: string,
    tenantId: string,
    userId?: string,
  ): Promise<CohortMetricStats> {
    const existing = await this.findOne(id, tenantId);
    if (!existing)
      throw new NotFoundException(
        `Cohort metric stats com id '${id}' não encontrado`,
      );

    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('cohort_metric_stats')
      .update({
        computed_at: now,
        computed_by: userId ?? null,
        updated_at: now,
        updated_by: userId ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error)
      throw new Error(
        `Failed to recompute cohort metric stats: ${error.message}`,
      );

    this.logger.log(
      'Cohort metric stats recomputed',
      'CohortMetricStatsService',
      { id },
    );
    return data as CohortMetricStats;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing)
      throw new NotFoundException(
        `Cohort metric stats com id '${id}' não encontrado`,
      );

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'cohort_metric_stats',
      id,
      userId,
    );
    if (!result.success)
      throw new Error(`Failed to delete cohort metric stats: ${result.error}`);

    this.logger.log('Cohort metric stats deleted', 'CohortMetricStatsService', {
      id,
    });
  }
}
