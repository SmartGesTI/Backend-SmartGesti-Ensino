import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { ReportTemplate } from '../common/types';
import {
  CreateReportTemplateDto,
  UpdateReportTemplateDto,
} from './dto/create-report-template.dto';

@Injectable()
export class ReportTemplatesService {
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
    options?: { schoolId?: string; isActive?: boolean; targetKind?: string },
  ): Promise<ReportTemplate[]> {
    let query = this.supabase
      .from('report_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('name', { ascending: true });
    if (options?.schoolId) query = query.eq('school_id', options.schoolId);
    if (options?.isActive !== undefined)
      query = query.eq('is_active', options.isActive);
    if (options?.targetKind)
      query = query.eq('target_kind', options.targetKind);
    const { data, error } = await query;
    if (error)
      throw new Error(`Failed to list report templates: ${error.message}`);
    return (data || []) as ReportTemplate[];
  }

  async findOne(id: string, tenantId: string): Promise<ReportTemplate | null> {
    const { data, error } = await this.supabase
      .from('report_templates')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get report template: ${error.message}`);
    }
    return data as ReportTemplate;
  }

  async create(
    tenantId: string,
    dto: CreateReportTemplateDto,
    userId?: string,
  ): Promise<ReportTemplate> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('report_templates')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id ?? null,
        key: dto.key,
        name: dto.name,
        description: dto.description ?? null,
        target_kind: dto.target_kind,
        output_format: dto.output_format ?? 'markdown',
        default_language: dto.default_language ?? 'pt-BR',
        sections: dto.sections ?? [],
        prompt: dto.prompt ?? {},
        data_requirements: dto.data_requirements ?? {},
        is_active: dto.is_active ?? true,
        metadata: dto.metadata ?? {},
        created_at: now,
        updated_at: now,
        created_by: userId ?? null,
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505')
        throw new ConflictException('Já existe um template com esta chave');
      throw new Error(`Failed to create report template: ${error.message}`);
    }
    this.logger.log('Report template created', 'ReportTemplatesService', {
      id: data.id,
      key: dto.key,
    });
    return data as ReportTemplate;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateReportTemplateDto,
    userId?: string,
  ): Promise<ReportTemplate> {
    const existing = await this.findOne(id, tenantId);
    if (!existing)
      throw new NotFoundException(
        `Report template com id '${id}' não encontrado`,
      );
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('report_templates')
      .update({ ...dto, updated_at: now, updated_by: userId ?? null })
      .eq('id', id)
      .select()
      .single();
    if (error)
      throw new Error(`Failed to update report template: ${error.message}`);
    return data as ReportTemplate;
  }

  async activate(
    id: string,
    tenantId: string,
    userId?: string,
  ): Promise<ReportTemplate> {
    return this.update(id, tenantId, { is_active: true }, userId);
  }
  async deactivate(
    id: string,
    tenantId: string,
    userId?: string,
  ): Promise<ReportTemplate> {
    return this.update(id, tenantId, { is_active: false }, userId);
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing)
      throw new NotFoundException(
        `Report template com id '${id}' não encontrado`,
      );
    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'report_templates',
      id,
      userId,
    );
    if (!result.success)
      throw new Error(`Failed to delete report template: ${result.error}`);
  }
}
