import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { SchoolDocumentType } from '../common/types';
import {
  CreateSchoolDocumentTypeDto,
  UpdateSchoolDocumentTypeDto,
} from './dto/create-school-document-type.dto';

@Injectable()
export class SchoolDocumentTypesService {
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
      category?: string;
      isActive?: boolean;
    },
  ): Promise<SchoolDocumentType[]> {
    let query = this.supabase
      .from('school_document_types')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (options?.schoolId) {
      query = query.eq('school_id', options.schoolId);
    }

    if (options?.category) {
      query = query.eq('category', options.category);
    }

    if (options?.isActive !== undefined) {
      query = query.eq('is_active', options.isActive);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list document types: ${error.message}`);
    }

    return (data || []) as SchoolDocumentType[];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<SchoolDocumentType | null> {
    const { data, error } = await this.supabase
      .from('school_document_types')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get document type: ${error.message}`);
    }

    return data as SchoolDocumentType;
  }

  async findBySlug(
    slug: string,
    tenantId: string,
    schoolId?: string,
  ): Promise<SchoolDocumentType | null> {
    let query = this.supabase
      .from('school_document_types')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('slug', slug)
      .is('deleted_at', null);

    if (schoolId) {
      query = query.eq('school_id', schoolId);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get document type by slug: ${error.message}`);
    }

    return data as SchoolDocumentType;
  }

  async create(
    tenantId: string,
    dto: CreateSchoolDocumentTypeDto,
    userId?: string,
  ): Promise<SchoolDocumentType> {
    // Verificar duplicidade de slug
    const existing = await this.findBySlug(dto.slug, tenantId, dto.school_id);
    if (existing) {
      throw new ConflictException(
        `Tipo de documento com slug '${dto.slug}' ja existe`,
      );
    }

    const { data, error } = await this.supabase
      .from('school_document_types')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id ?? null,
        slug: dto.slug,
        name: dto.name,
        category: dto.category,
        is_official_record: dto.is_official_record ?? false,
        requires_ack: dto.requires_ack ?? false,
        requires_signature: dto.requires_signature ?? false,
        signature_policy: dto.signature_policy ?? 'none',
        numbering_mode: dto.numbering_mode ?? 'none',
        default_prefix: dto.default_prefix ?? null,
        retention_years: dto.retention_years ?? null,
        is_active: dto.is_active ?? true,
        metadata: dto.metadata ?? {},
        ai_context: dto.ai_context ?? {},
        ai_summary: dto.ai_summary ?? null,
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create document type: ${error.message}`);
    }

    this.logger.log('Document type created', 'SchoolDocumentTypesService', {
      id: data.id,
      slug: dto.slug,
    });

    return data as SchoolDocumentType;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateSchoolDocumentTypeDto,
    userId?: string,
  ): Promise<SchoolDocumentType> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `Tipo de documento com id '${id}' nao encontrado`,
      );
    }

    const { data, error } = await this.supabase
      .from('school_document_types')
      .update({
        ...dto,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update document type: ${error.message}`);
    }

    this.logger.log('Document type updated', 'SchoolDocumentTypesService', {
      id,
    });

    return data as SchoolDocumentType;
  }

  async remove(id: string, tenantId: string, userId?: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `Tipo de documento com id '${id}' nao encontrado`,
      );
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'school_document_types',
      id,
      userId ?? '',
    );

    if (!result.success) {
      throw new Error(`Failed to delete document type: ${result.error}`);
    }

    this.logger.log('Document type deleted', 'SchoolDocumentTypesService', {
      id,
    });
  }
}
