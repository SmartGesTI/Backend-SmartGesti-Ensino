import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { SchoolDocumentTemplate } from '../common/types';
import {
  CreateSchoolDocumentTemplateDto,
  UpdateSchoolDocumentTemplateDto,
} from './dto/create-school-document-template.dto';

@Injectable()
export class SchoolDocumentTemplatesService {
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
      documentTypeId?: string;
      status?: string;
    },
  ): Promise<SchoolDocumentTemplate[]> {
    let query = this.supabase
      .from('school_document_templates')
      .select('*, school_document_types(id, name, slug)')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (options?.schoolId) {
      query = query.eq('school_id', options.schoolId);
    }

    if (options?.documentTypeId) {
      query = query.eq('document_type_id', options.documentTypeId);
    }

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list templates: ${error.message}`);
    }

    return (data || []) as SchoolDocumentTemplate[];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<SchoolDocumentTemplate | null> {
    const { data, error } = await this.supabase
      .from('school_document_templates')
      .select('*, school_document_types(id, name, slug, category)')
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

    return data as SchoolDocumentTemplate;
  }

  async create(
    tenantId: string,
    dto: CreateSchoolDocumentTemplateDto,
    userId?: string,
  ): Promise<SchoolDocumentTemplate> {
    // Verificar se document_type existe
    const { data: docType, error: typeError } = await this.supabase
      .from('school_document_types')
      .select('id')
      .eq('id', dto.document_type_id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (typeError || !docType) {
      throw new NotFoundException(
        `Tipo de documento com id '${dto.document_type_id}' nao encontrado`,
      );
    }

    const { data, error } = await this.supabase
      .from('school_document_templates')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id ?? null,
        document_type_id: dto.document_type_id,
        name: dto.name,
        language_code: dto.language_code ?? 'pt-BR',
        template_format: dto.template_format ?? 'html',
        template_content: dto.template_content ?? null,
        template_file_path: dto.template_file_path ?? null,
        variables_schema: dto.variables_schema ?? {},
        version: 1,
        status: 'draft',
        metadata: dto.metadata ?? {},
        ai_context: dto.ai_context ?? {},
        ai_summary: dto.ai_summary ?? null,
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create template: ${error.message}`);
    }

    this.logger.log('Template created', 'SchoolDocumentTemplatesService', {
      id: data.id,
      name: dto.name,
    });

    return data as SchoolDocumentTemplate;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateSchoolDocumentTemplateDto,
    userId?: string,
  ): Promise<SchoolDocumentTemplate> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Template com id '${id}' nao encontrado`);
    }

    if (existing.status === 'published') {
      throw new BadRequestException(
        'Nao e possivel editar um template publicado. Crie uma nova versao.',
      );
    }

    const { data, error } = await this.supabase
      .from('school_document_templates')
      .update({
        ...dto,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update template: ${error.message}`);
    }

    this.logger.log('Template updated', 'SchoolDocumentTemplatesService', {
      id,
    });

    return data as SchoolDocumentTemplate;
  }

  async publish(
    id: string,
    tenantId: string,
    userId?: string,
  ): Promise<SchoolDocumentTemplate> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Template com id '${id}' nao encontrado`);
    }

    if (existing.status === 'published') {
      throw new BadRequestException('Template ja esta publicado');
    }

    if (existing.status === 'archived') {
      throw new BadRequestException(
        'Nao e possivel publicar um template arquivado',
      );
    }

    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('school_document_templates')
      .update({
        status: 'published',
        published_at: now,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to publish template: ${error.message}`);
    }

    this.logger.log('Template published', 'SchoolDocumentTemplatesService', {
      id,
    });

    return data as SchoolDocumentTemplate;
  }

  async archive(
    id: string,
    tenantId: string,
    userId?: string,
  ): Promise<SchoolDocumentTemplate> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Template com id '${id}' nao encontrado`);
    }

    if (existing.status === 'archived') {
      throw new BadRequestException('Template ja esta arquivado');
    }

    const { data, error } = await this.supabase
      .from('school_document_templates')
      .update({
        status: 'archived',
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to archive template: ${error.message}`);
    }

    this.logger.log('Template archived', 'SchoolDocumentTemplatesService', {
      id,
    });

    return data as SchoolDocumentTemplate;
  }

  async remove(id: string, tenantId: string, userId?: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Template com id '${id}' nao encontrado`);
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'school_document_templates',
      id,
      userId ?? '',
    );

    if (!result.success) {
      throw new Error(`Failed to delete template: ${result.error}`);
    }

    this.logger.log('Template deleted', 'SchoolDocumentTemplatesService', {
      id,
    });
  }
}
