import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { ReportRun } from '../common/types';
import {
  GenerateReportDto,
  UpdateReportRunStatusDto,
} from './dto/create-report-run.dto';

@Injectable()
export class ReportRunsService {
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
      reportTemplateVersionId?: string;
      status?: string;
      targetKind?: string;
      studentId?: string;
      academicYearId?: string;
      limit?: number;
    },
  ): Promise<ReportRun[]> {
    let query = this.supabase
      .from('report_runs')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (options?.schoolId) query = query.eq('school_id', options.schoolId);
    if (options?.reportTemplateVersionId)
      query = query.eq(
        'report_template_version_id',
        options.reportTemplateVersionId,
      );
    if (options?.status) query = query.eq('status', options.status);
    if (options?.targetKind)
      query = query.eq('target_kind', options.targetKind);
    if (options?.studentId) query = query.eq('student_id', options.studentId);
    if (options?.academicYearId)
      query = query.eq('academic_year_id', options.academicYearId);
    if (options?.limit) query = query.limit(options.limit);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to list report runs: ${error.message}`);
    return (data || []) as ReportRun[];
  }

  async findOne(id: string, tenantId: string): Promise<ReportRun | null> {
    const { data, error } = await this.supabase
      .from('report_runs')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get report run: ${error.message}`);
    }
    return data as ReportRun;
  }

  async generate(
    tenantId: string,
    dto: GenerateReportDto,
    userId?: string,
  ): Promise<ReportRun> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('report_runs')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id ?? null,
        report_template_version_id: dto.report_template_version_id,
        status: 'queued',
        target_kind: dto.target_kind,
        student_id: dto.student_id ?? null,
        enrollment_id: dto.enrollment_id ?? null,
        class_group_id: dto.class_group_id ?? null,
        grade_level_id: dto.grade_level_id ?? null,
        academic_year_id: dto.academic_year_id,
        grading_period_id: dto.grading_period_id ?? null,
        requested_by: userId ?? null,
        output_format: dto.output_format ?? 'markdown',
        report_data: {},
        metadata: dto.metadata ?? {},
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();
    if (error) throw new Error(`Failed to generate report: ${error.message}`);
    this.logger.log('Report run created', 'ReportRunsService', { id: data.id });
    // TODO: Trigger actual report generation job
    return data as ReportRun;
  }

  async updateStatus(
    id: string,
    tenantId: string,
    dto: UpdateReportRunStatusDto,
  ): Promise<ReportRun> {
    const existing = await this.findOne(id, tenantId);
    if (!existing)
      throw new NotFoundException(`Report run com id '${id}' não encontrado`);
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      status: dto.status,
      updated_at: now,
    };
    if (dto.status === 'running' && !existing.started_at)
      updateData.started_at = now;
    if (
      ['success', 'failed', 'cancelled'].includes(dto.status) &&
      !existing.finished_at
    )
      updateData.finished_at = now;
    if (dto.error_message) updateData.error_message = dto.error_message;
    if (dto.report_title) updateData.report_title = dto.report_title;
    if (dto.report_summary) updateData.report_summary = dto.report_summary;
    if (dto.report_data) updateData.report_data = dto.report_data;
    if (dto.rag_document_id) updateData.rag_document_id = dto.rag_document_id;
    if (dto.content_hash) updateData.content_hash = dto.content_hash;
    const { data, error } = await this.supabase
      .from('report_runs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error)
      throw new Error(`Failed to update report run status: ${error.message}`);
    return data as ReportRun;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing)
      throw new NotFoundException(`Report run com id '${id}' não encontrado`);
    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'report_runs',
      id,
      userId,
    );
    if (!result.success)
      throw new Error(`Failed to delete report run: ${result.error}`);
  }
}
