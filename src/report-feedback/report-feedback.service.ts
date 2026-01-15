import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { ReportFeedback } from '../common/types';
import { CreateReportFeedbackDto } from './dto/create-report-feedback.dto';

@Injectable()
export class ReportFeedbackService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  async findAll(
    tenantId: string,
    options?: { reportRunId?: string; feedbackType?: string; limit?: number },
  ): Promise<ReportFeedback[]> {
    let query = this.supabase
      .from('report_feedback')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (options?.reportRunId)
      query = query.eq('report_run_id', options.reportRunId);
    if (options?.feedbackType)
      query = query.eq('feedback_type', options.feedbackType);
    if (options?.limit) query = query.limit(options.limit);
    const { data, error } = await query;
    if (error)
      throw new Error(`Failed to list report feedback: ${error.message}`);
    return (data || []) as ReportFeedback[];
  }

  async findOne(id: string, tenantId: string): Promise<ReportFeedback | null> {
    const { data, error } = await this.supabase
      .from('report_feedback')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get report feedback: ${error.message}`);
    }
    return data as ReportFeedback;
  }

  async create(
    tenantId: string,
    dto: CreateReportFeedbackDto,
    userId?: string,
  ): Promise<ReportFeedback> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('report_feedback')
      .insert({
        tenant_id: tenantId,
        report_run_id: dto.report_run_id,
        user_id: dto.user_id ?? userId ?? null,
        guardian_id: dto.guardian_id ?? null,
        feedback_type: dto.feedback_type,
        rating: dto.rating ?? null,
        comment: dto.comment ?? null,
        metadata: dto.metadata ?? {},
        created_at: now,
      })
      .select()
      .single();
    if (error)
      throw new Error(`Failed to create report feedback: ${error.message}`);
    this.logger.log('Report feedback created', 'ReportFeedbackService', {
      id: data.id,
      feedbackType: dto.feedback_type,
    });
    return data as ReportFeedback;
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing)
      throw new NotFoundException(
        `Report feedback com id '${id}' não encontrado`,
      );
    const { error } = await this.supabase
      .from('report_feedback')
      .delete()
      .eq('id', id);
    if (error)
      throw new Error(`Failed to delete report feedback: ${error.message}`);
  }
}
