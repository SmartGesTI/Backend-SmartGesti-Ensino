import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { InsightInstance } from '../common/types';
import {
  CreateInsightInstanceDto,
  DismissInsightDto,
} from './dto/create-insight-instance.dto';

@Injectable()
export class InsightInstancesService {
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
      insightDefinitionId?: string;
      status?: string;
      targetKind?: string;
      studentId?: string;
      academicYearId?: string;
      limit?: number;
    },
  ): Promise<InsightInstance[]> {
    let query = this.supabase
      .from('insight_instances')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('detected_at', { ascending: false });
    if (options?.schoolId) query = query.eq('school_id', options.schoolId);
    if (options?.insightDefinitionId)
      query = query.eq('insight_definition_id', options.insightDefinitionId);
    if (options?.status) query = query.eq('status', options.status);
    if (options?.targetKind)
      query = query.eq('target_kind', options.targetKind);
    if (options?.studentId) query = query.eq('student_id', options.studentId);
    if (options?.academicYearId)
      query = query.eq('academic_year_id', options.academicYearId);
    if (options?.limit) query = query.limit(options.limit);
    const { data, error } = await query;
    if (error)
      throw new Error(`Failed to list insight instances: ${error.message}`);
    return (data || []) as InsightInstance[];
  }

  async findOne(id: string, tenantId: string): Promise<InsightInstance | null> {
    const { data, error } = await this.supabase
      .from('insight_instances')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get insight instance: ${error.message}`);
    }
    return data as InsightInstance;
  }

  async create(
    tenantId: string,
    dto: CreateInsightInstanceDto,
    userId?: string,
  ): Promise<InsightInstance> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('insight_instances')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id ?? null,
        insight_definition_id: dto.insight_definition_id,
        status: 'open',
        target_kind: dto.target_kind,
        student_id: dto.student_id ?? null,
        enrollment_id: dto.enrollment_id ?? null,
        class_group_id: dto.class_group_id ?? null,
        grade_level_id: dto.grade_level_id ?? null,
        academic_year_id: dto.academic_year_id,
        grading_period_id: dto.grading_period_id ?? null,
        detected_at: now,
        title: dto.title ?? null,
        summary: dto.summary ?? null,
        details: dto.details ?? {},
        ai_generated: dto.ai_generated ?? true,
        ai_model: dto.ai_model ?? null,
        metadata: dto.metadata ?? {},
        ai_context: dto.ai_context ?? {},
        created_at: now,
        updated_at: now,
        created_by: userId ?? null,
      })
      .select()
      .single();
    if (error)
      throw new Error(`Failed to create insight instance: ${error.message}`);
    this.logger.log('Insight instance created', 'InsightInstancesService', {
      id: data.id,
    });
    return data as InsightInstance;
  }

  async approve(
    id: string,
    tenantId: string,
    userId?: string,
  ): Promise<InsightInstance> {
    const existing = await this.findOne(id, tenantId);
    if (!existing)
      throw new NotFoundException(
        `Insight instance com id '${id}' não encontrada`,
      );
    if (!['open', 'reviewing'].includes(existing.status))
      throw new BadRequestException(
        `Insight não pode ser aprovado no status '${existing.status}'`,
      );
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('insight_instances')
      .update({
        status: 'approved',
        approved_at: now,
        approved_by: userId ?? null,
        updated_at: now,
        updated_by: userId ?? null,
      })
      .eq('id', id)
      .select()
      .single();
    if (error)
      throw new Error(`Failed to approve insight instance: ${error.message}`);
    return data as InsightInstance;
  }

  async dismiss(
    id: string,
    tenantId: string,
    dto: DismissInsightDto,
    userId?: string,
  ): Promise<InsightInstance> {
    const existing = await this.findOne(id, tenantId);
    if (!existing)
      throw new NotFoundException(
        `Insight instance com id '${id}' não encontrada`,
      );
    if (!['open', 'reviewing'].includes(existing.status))
      throw new BadRequestException(
        `Insight não pode ser dispensado no status '${existing.status}'`,
      );
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('insight_instances')
      .update({
        status: 'dismissed',
        dismissed_at: now,
        dismissed_by: userId ?? null,
        dismiss_reason: dto.reason ?? null,
        updated_at: now,
        updated_by: userId ?? null,
      })
      .eq('id', id)
      .select()
      .single();
    if (error)
      throw new Error(`Failed to dismiss insight instance: ${error.message}`);
    return data as InsightInstance;
  }

  async resolve(
    id: string,
    tenantId: string,
    userId?: string,
  ): Promise<InsightInstance> {
    const existing = await this.findOne(id, tenantId);
    if (!existing)
      throw new NotFoundException(
        `Insight instance com id '${id}' não encontrada`,
      );
    if (!['approved', 'delivered'].includes(existing.status))
      throw new BadRequestException(
        `Insight não pode ser resolvido no status '${existing.status}'`,
      );
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('insight_instances')
      .update({
        status: 'resolved',
        resolved_at: now,
        resolved_by: userId ?? null,
        updated_at: now,
        updated_by: userId ?? null,
      })
      .eq('id', id)
      .select()
      .single();
    if (error)
      throw new Error(`Failed to resolve insight instance: ${error.message}`);
    return data as InsightInstance;
  }

  async deliver(
    id: string,
    tenantId: string,
    userId?: string,
  ): Promise<InsightInstance> {
    const existing = await this.findOne(id, tenantId);
    if (!existing)
      throw new NotFoundException(
        `Insight instance com id '${id}' não encontrada`,
      );
    if (existing.status !== 'approved')
      throw new BadRequestException(
        `Insight precisa estar aprovado para ser entregue`,
      );
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('insight_instances')
      .update({
        status: 'delivered',
        updated_at: now,
        updated_by: userId ?? null,
      })
      .eq('id', id)
      .select()
      .single();
    if (error)
      throw new Error(`Failed to deliver insight instance: ${error.message}`);
    return data as InsightInstance;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing)
      throw new NotFoundException(
        `Insight instance com id '${id}' não encontrada`,
      );
    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'insight_instances',
      id,
      userId,
    );
    if (!result.success)
      throw new Error(`Failed to delete insight instance: ${result.error}`);
  }
}
