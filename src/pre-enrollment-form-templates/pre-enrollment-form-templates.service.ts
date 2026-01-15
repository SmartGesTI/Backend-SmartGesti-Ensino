import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { PreEnrollmentFormTemplate } from '../common/types';
import {
  CreatePreEnrollmentFormTemplateDto,
  UpdatePreEnrollmentFormTemplateDto,
} from './dto/create-pre-enrollment-form-template.dto';

@Injectable()
export class PreEnrollmentFormTemplatesService {
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
      status?: string;
      slug?: string;
    },
  ): Promise<PreEnrollmentFormTemplate[]> {
    let query = this.supabase
      .from('pre_enrollment_form_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (options?.schoolId) {
      query = query.eq('school_id', options.schoolId);
    }

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.slug) {
      query = query.eq('slug', options.slug);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to list pre-enrollment form templates: ${error.message}`,
        undefined,
        'PreEnrollmentFormTemplatesService',
      );
      throw new Error(`Failed to list templates: ${error.message}`);
    }

    return (data || []) as PreEnrollmentFormTemplate[];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<PreEnrollmentFormTemplate | null> {
    const { data, error } = await this.supabase
      .from('pre_enrollment_form_templates')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get template: ${error.message}`);
    }

    return data as PreEnrollmentFormTemplate;
  }

  async create(
    tenantId: string,
    dto: CreatePreEnrollmentFormTemplateDto,
    userId?: string,
  ): Promise<PreEnrollmentFormTemplate> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('pre_enrollment_form_templates')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id ?? null,
        slug: dto.slug,
        name: dto.name,
        version: dto.version ?? 1,
        status: dto.status ?? 'draft',
        schema: dto.schema ?? {},
        ui_schema: dto.ui_schema ?? {},
        required_documents: dto.required_documents ?? [],
        settings: dto.settings ?? {},
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
        throw new ConflictException(
          'Já existe um template com este slug e versão para este tenant/escola',
        );
      }
      this.logger.error(
        `Failed to create template: ${error.message}`,
        undefined,
        'PreEnrollmentFormTemplatesService',
      );
      throw new Error(`Failed to create template: ${error.message}`);
    }

    this.logger.log(
      'Pre-enrollment form template created',
      'PreEnrollmentFormTemplatesService',
      {
        id: data.id,
        slug: dto.slug,
      },
    );

    return data as PreEnrollmentFormTemplate;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdatePreEnrollmentFormTemplateDto,
    userId?: string,
  ): Promise<PreEnrollmentFormTemplate> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Template com id '${id}' não encontrado`);
    }

    if (existing.status === 'published' && dto.status !== 'archived') {
      throw new BadRequestException(
        'Templates publicados não podem ser editados. Crie uma nova versão.',
      );
    }

    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('pre_enrollment_form_templates')
      .update({
        ...dto,
        updated_at: now,
        updated_by: userId ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update template: ${error.message}`);
    }

    this.logger.log(
      'Pre-enrollment form template updated',
      'PreEnrollmentFormTemplatesService',
      {
        id,
      },
    );

    return data as PreEnrollmentFormTemplate;
  }

  async publish(
    id: string,
    tenantId: string,
    userId?: string,
  ): Promise<PreEnrollmentFormTemplate> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Template com id '${id}' não encontrado`);
    }

    if (existing.status === 'published') {
      throw new BadRequestException('Este template já está publicado');
    }

    if (existing.status === 'archived') {
      throw new BadRequestException(
        'Templates arquivados não podem ser publicados',
      );
    }

    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('pre_enrollment_form_templates')
      .update({
        status: 'published',
        published_at: now,
        updated_at: now,
        updated_by: userId ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to publish template: ${error.message}`);
    }

    this.logger.log(
      'Pre-enrollment form template published',
      'PreEnrollmentFormTemplatesService',
      {
        id,
      },
    );

    return data as PreEnrollmentFormTemplate;
  }

  async archive(
    id: string,
    tenantId: string,
    userId?: string,
  ): Promise<PreEnrollmentFormTemplate> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Template com id '${id}' não encontrado`);
    }

    if (existing.status === 'archived') {
      throw new BadRequestException('Este template já está arquivado');
    }

    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('pre_enrollment_form_templates')
      .update({
        status: 'archived',
        updated_at: now,
        updated_by: userId ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to archive template: ${error.message}`);
    }

    this.logger.log(
      'Pre-enrollment form template archived',
      'PreEnrollmentFormTemplatesService',
      {
        id,
      },
    );

    return data as PreEnrollmentFormTemplate;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Template com id '${id}' não encontrado`);
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'pre_enrollment_form_templates',
      id,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete template: ${result.error}`);
    }

    this.logger.log(
      'Pre-enrollment form template deleted',
      'PreEnrollmentFormTemplatesService',
      {
        id,
      },
    );
  }
}
