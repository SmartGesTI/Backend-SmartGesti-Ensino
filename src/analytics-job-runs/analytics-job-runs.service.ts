import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { AnalyticsJobRun } from '../common/types';
import {
  TriggerAnalyticsJobDto,
  UpdateJobStatusDto,
} from './dto/create-analytics-job-run.dto';

@Injectable()
export class AnalyticsJobRunsService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  async findAll(
    tenantId: string,
    options?: {
      schoolId?: string;
      jobType?: string;
      status?: string;
      limit?: number;
    },
  ): Promise<AnalyticsJobRun[]> {
    let query = this.supabase
      .from('analytics_job_runs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (options?.schoolId) query = query.eq('school_id', options.schoolId);
    if (options?.jobType) query = query.eq('job_type', options.jobType);
    if (options?.status) query = query.eq('status', options.status);
    if (options?.limit) query = query.limit(options.limit);

    const result = await query;

    if (result.error) {
      this.logger.error(
        `Failed to list analytics job runs: ${result.error.message}`,
        undefined,
        'AnalyticsJobRunsService',
      );
      throw new Error(
        `Failed to list analytics job runs: ${result.error.message}`,
      );
    }

    return (result.data || []) as AnalyticsJobRun[];
  }

  async findOne(id: string, tenantId: string): Promise<AnalyticsJobRun | null> {
    const result = await this.supabase
      .from('analytics_job_runs')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (result.error) {
      if (result.error.code === 'PGRST116') return null;
      throw new Error(
        `Failed to get analytics job run: ${result.error.message}`,
      );
    }

    return result.data as AnalyticsJobRun;
  }

  async trigger(
    tenantId: string,
    dto: TriggerAnalyticsJobDto,
    userId?: string,
  ): Promise<AnalyticsJobRun> {
    const now = new Date().toISOString();

    const result = await this.supabase
      .from('analytics_job_runs')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id ?? null,
        job_type: dto.job_type,
        status: 'queued',
        scheduled_for: dto.scheduled_for ?? null,
        academic_year_id: dto.academic_year_id ?? null,
        grading_period_id: dto.grading_period_id ?? null,
        scope: dto.scope ?? {},
        stats: {},
        triggered_by: userId ?? null,
        metadata: dto.metadata ?? {},
        created_at: now,
      })
      .select()
      .single();

    if (result.error) {
      this.logger.error(
        `Failed to trigger analytics job: ${result.error.message}`,
        undefined,
        'AnalyticsJobRunsService',
      );
      throw new Error(
        `Failed to trigger analytics job: ${result.error.message}`,
      );
    }

    const jobRun = result.data as AnalyticsJobRun;
    this.logger.log('Analytics job triggered', 'AnalyticsJobRunsService', {
      id: jobRun.id,
      jobType: dto.job_type,
    });
    return jobRun;
  }

  async updateStatus(
    id: string,
    tenantId: string,
    dto: UpdateJobStatusDto,
  ): Promise<AnalyticsJobRun> {
    const existing = await this.findOne(id, tenantId);
    if (!existing)
      throw new NotFoundException(
        `Analytics job run com id '${id}' não encontrado`,
      );

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { status: dto.status };

    if (dto.status === 'running' && !existing.started_at) {
      updateData.started_at = now;
    }

    if (
      ['success', 'failed', 'cancelled'].includes(dto.status) &&
      !existing.finished_at
    ) {
      updateData.finished_at = now;
    }

    if (dto.error_message) updateData.error_message = dto.error_message;
    if (dto.stats) updateData.stats = dto.stats;

    const result = await this.supabase
      .from('analytics_job_runs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (result.error)
      throw new Error(
        `Failed to update analytics job status: ${result.error.message}`,
      );

    this.logger.log('Analytics job status updated', 'AnalyticsJobRunsService', {
      id,
      status: dto.status,
    });
    return result.data as AnalyticsJobRun;
  }

  async cancel(id: string, tenantId: string): Promise<AnalyticsJobRun> {
    const existing = await this.findOne(id, tenantId);
    if (!existing)
      throw new NotFoundException(
        `Analytics job run com id '${id}' não encontrado`,
      );

    if (!['queued', 'running'].includes(existing.status)) {
      throw new BadRequestException(
        `Job não pode ser cancelado no status '${existing.status}'`,
      );
    }

    return this.updateStatus(id, tenantId, { status: 'cancelled' });
  }
}
