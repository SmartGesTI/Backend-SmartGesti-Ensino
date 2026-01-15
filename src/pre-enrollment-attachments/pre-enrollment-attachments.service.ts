import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { PreEnrollmentAttachment } from '../common/types';
import { CreatePreEnrollmentAttachmentDto } from './dto/create-pre-enrollment-attachment.dto';

@Injectable()
export class PreEnrollmentAttachmentsService {
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
      householdId?: string;
      applicationId?: string;
      personId?: string;
      category?: string;
    },
  ): Promise<PreEnrollmentAttachment[]> {
    let query = this.supabase
      .from('pre_enrollment_attachments')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('uploaded_at', { ascending: false });

    if (options?.schoolId) {
      query = query.eq('school_id', options.schoolId);
    }

    if (options?.householdId) {
      query = query.eq('household_id', options.householdId);
    }

    if (options?.applicationId) {
      query = query.eq('application_id', options.applicationId);
    }

    if (options?.personId) {
      query = query.eq('person_id', options.personId);
    }

    if (options?.category) {
      query = query.eq('category', options.category);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to list pre-enrollment attachments: ${error.message}`,
        undefined,
        'PreEnrollmentAttachmentsService',
      );
      throw new Error(`Failed to list attachments: ${error.message}`);
    }

    return (data || []) as PreEnrollmentAttachment[];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<PreEnrollmentAttachment | null> {
    const { data, error } = await this.supabase
      .from('pre_enrollment_attachments')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get attachment: ${error.message}`);
    }

    return data as PreEnrollmentAttachment;
  }

  async create(
    tenantId: string,
    dto: CreatePreEnrollmentAttachmentDto,
    userId?: string,
  ): Promise<PreEnrollmentAttachment> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('pre_enrollment_attachments')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id,
        household_id: dto.household_id,
        application_id: dto.application_id ?? null,
        person_id: dto.person_id ?? null,
        category: dto.category,
        file_path: dto.file_path,
        file_name: dto.file_name ?? null,
        mime_type: dto.mime_type ?? null,
        size_bytes: dto.size_bytes ?? null,
        checksum_sha256: dto.checksum_sha256 ?? null,
        uploaded_by_type: dto.uploaded_by_type ?? 'user',
        uploaded_by: userId ?? null,
        uploaded_at: now,
        metadata: dto.metadata ?? {},
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        `Failed to create attachment: ${error.message}`,
        undefined,
        'PreEnrollmentAttachmentsService',
      );
      throw new Error(`Failed to create attachment: ${error.message}`);
    }

    this.logger.log(
      'Pre-enrollment attachment created',
      'PreEnrollmentAttachmentsService',
      {
        id: data.id,
        category: dto.category,
      },
    );

    return data as PreEnrollmentAttachment;
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Attachment com id '${id}' não encontrado`);
    }

    const { error } = await this.supabase
      .from('pre_enrollment_attachments')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete attachment: ${error.message}`);
    }

    this.logger.log(
      'Pre-enrollment attachment deleted',
      'PreEnrollmentAttachmentsService',
      {
        id,
      },
    );
  }
}
