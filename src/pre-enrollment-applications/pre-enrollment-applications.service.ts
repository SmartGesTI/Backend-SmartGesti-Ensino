import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { PreEnrollmentApplication } from '../common/types';
import {
  CreatePreEnrollmentApplicationDto,
  UpdatePreEnrollmentApplicationDto,
  ReviewApplicationDto,
} from './dto/create-pre-enrollment-application.dto';

@Injectable()
export class PreEnrollmentApplicationsService {
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
      householdId?: string;
      status?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<PreEnrollmentApplication[]> {
    let query = this.supabase
      .from('pre_enrollment_applications')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (options?.schoolId) {
      query = query.eq('school_id', options.schoolId);
    }

    if (options?.householdId) {
      query = query.eq('household_id', options.householdId);
    }

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 50) - 1,
      );
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to list pre-enrollment applications: ${error.message}`,
        undefined,
        'PreEnrollmentApplicationsService',
      );
      throw new Error(`Failed to list applications: ${error.message}`);
    }

    return (data || []) as PreEnrollmentApplication[];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<PreEnrollmentApplication | null> {
    const { data, error } = await this.supabase
      .from('pre_enrollment_applications')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get application: ${error.message}`);
    }

    return data as PreEnrollmentApplication;
  }

  async create(
    tenantId: string,
    dto: CreatePreEnrollmentApplicationDto,
    userId?: string,
  ): Promise<PreEnrollmentApplication> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('pre_enrollment_applications')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id,
        site_id: dto.site_id ?? null,
        household_id: dto.household_id,
        form_template_id: dto.form_template_id ?? null,
        form_template_version: dto.form_template_version ?? null,
        academic_year_id: dto.academic_year_id ?? null,
        desired_grade_level_id: dto.desired_grade_level_id ?? null,
        desired_shift_id: dto.desired_shift_id ?? null,
        status: dto.status ?? 'draft',
        applicant_notes: dto.applicant_notes ?? null,
        answers: dto.answers ?? {},
        tags: dto.tags ?? [],
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
        `Failed to create application: ${error.message}`,
        undefined,
        'PreEnrollmentApplicationsService',
      );
      throw new Error(`Failed to create application: ${error.message}`);
    }

    this.logger.log(
      'Pre-enrollment application created',
      'PreEnrollmentApplicationsService',
      {
        id: data.id,
        householdId: dto.household_id,
      },
    );

    return data as PreEnrollmentApplication;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdatePreEnrollmentApplicationDto,
    userId?: string,
  ): Promise<PreEnrollmentApplication> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Application com id '${id}' não encontrada`);
    }

    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('pre_enrollment_applications')
      .update({
        ...dto,
        updated_at: now,
        updated_by: userId ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update application: ${error.message}`);
    }

    this.logger.log(
      'Pre-enrollment application updated',
      'PreEnrollmentApplicationsService',
      {
        id,
      },
    );

    return data as PreEnrollmentApplication;
  }

  async submit(
    id: string,
    tenantId: string,
    userId?: string,
  ): Promise<PreEnrollmentApplication> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Application com id '${id}' não encontrada`);
    }

    if (existing.status !== 'draft') {
      throw new BadRequestException(
        'Apenas aplicações em rascunho podem ser submetidas',
      );
    }

    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('pre_enrollment_applications')
      .update({
        status: 'submitted',
        submitted_at: now,
        updated_at: now,
        updated_by: userId ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to submit application: ${error.message}`);
    }

    this.logger.log(
      'Pre-enrollment application submitted',
      'PreEnrollmentApplicationsService',
      {
        id,
      },
    );

    return data as PreEnrollmentApplication;
  }

  async review(
    id: string,
    tenantId: string,
    dto: ReviewApplicationDto,
    userId?: string,
  ): Promise<PreEnrollmentApplication> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Application com id '${id}' não encontrada`);
    }

    if (!['submitted', 'in_review'].includes(existing.status)) {
      throw new BadRequestException(
        'Apenas aplicações submetidas ou em revisão podem ser avaliadas',
      );
    }

    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('pre_enrollment_applications')
      .update({
        status: dto.decision,
        decision_reason: dto.reason ?? null,
        admin_notes: dto.admin_notes ?? existing.admin_notes,
        ai_score: dto.ai_score ?? existing.ai_score,
        ai_missing_fields: dto.ai_missing_fields ?? existing.ai_missing_fields,
        ai_flags: dto.ai_flags ?? existing.ai_flags,
        reviewed_at: now,
        reviewed_by: userId ?? null,
        updated_at: now,
        updated_by: userId ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to review application: ${error.message}`);
    }

    this.logger.log(
      'Pre-enrollment application reviewed',
      'PreEnrollmentApplicationsService',
      {
        id,
        decision: dto.decision,
      },
    );

    return data as PreEnrollmentApplication;
  }

  async updateStatus(
    id: string,
    tenantId: string,
    status: string,
    userId?: string,
  ): Promise<PreEnrollmentApplication> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Application com id '${id}' não encontrada`);
    }

    const validStatuses = [
      'draft',
      'submitted',
      'in_review',
      'needs_info',
      'approved',
      'rejected',
      'converted',
      'cancelled',
      'archived',
    ];

    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`Status '${status}' inválido`);
    }

    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('pre_enrollment_applications')
      .update({
        status,
        updated_at: now,
        updated_by: userId ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update application status: ${error.message}`);
    }

    this.logger.log(
      'Pre-enrollment application status updated',
      'PreEnrollmentApplicationsService',
      {
        id,
        status,
      },
    );

    return data as PreEnrollmentApplication;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Application com id '${id}' não encontrada`);
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'pre_enrollment_applications',
      id,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete application: ${result.error}`);
    }

    this.logger.log(
      'Pre-enrollment application deleted',
      'PreEnrollmentApplicationsService',
      {
        id,
      },
    );
  }
}
