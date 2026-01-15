import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import {
  CommunicationAttachment,
  CommunicationMessageAttachment,
} from '../common/types';
import {
  CreateAttachmentDto,
  AttachToMessageDto,
} from './dto/create-attachment.dto';

@Injectable()
export class CommunicationAttachmentsService {
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
    options?: { schoolId?: string },
  ): Promise<CommunicationAttachment[]> {
    let q = this.supabase
      .from('communication_attachments')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (options?.schoolId) q = q.eq('school_id', options.schoolId);
    const { data, error } = await q;
    if (error) throw new BadRequestException('Falha ao buscar attachments');
    return data || [];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<CommunicationAttachment> {
    const { data, error } = await this.supabase
      .from('communication_attachments')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();
    if (error || !data)
      throw new NotFoundException('Attachment nao encontrado');
    return data;
  }

  async upload(
    tenantId: string,
    schoolId: string | null,
    dto: CreateAttachmentDto,
    userId?: string,
  ): Promise<CommunicationAttachment> {
    const { data, error } = await this.supabase
      .from('communication_attachments')
      .insert({
        tenant_id: tenantId,
        school_id: schoolId,
        owner_user_id: userId || null,
        storage_bucket: dto.storage_bucket,
        storage_path: dto.storage_path,
        filename: dto.filename,
        mime_type: dto.mime_type || null,
        size_bytes: dto.size_bytes || null,
        classification: dto.classification || 'other',
        checksum_sha256: dto.checksum_sha256 || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) {
      this.logger.error(
        'Failed to register attachment',
        error.message,
        'CommunicationAttachmentsService',
      );
      throw new BadRequestException('Falha ao registrar attachment');
    }
    this.logger.log(
      'Attachment registered',
      'CommunicationAttachmentsService',
      { attachmentId: data.id },
    );
    return data;
  }

  async attachToMessage(
    id: string,
    tenantId: string,
    dto: AttachToMessageDto,
    userId?: string,
  ): Promise<CommunicationMessageAttachment> {
    const attachment = await this.findOne(id, tenantId);
    const { data: message, error: msgError } = await this.supabase
      .from('communication_messages')
      .select('id, school_id')
      .eq('id', dto.message_id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();
    if (msgError || !message)
      throw new NotFoundException('Mensagem nao encontrada');
    const { data, error } = await this.supabase
      .from('communication_message_attachments')
      .insert({
        tenant_id: tenantId,
        school_id: attachment.school_id,
        message_id: dto.message_id,
        attachment_id: id,
        display_order: dto.display_order || 0,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw new BadRequestException('Falha ao vincular attachment');
    return data;
  }

  async detachFromMessage(
    id: string,
    messageId: string,
    tenantId: string,
    userId?: string,
  ): Promise<void> {
    await this.findOne(id, tenantId);
    const { error } = await this.supabase
      .from('communication_message_attachments')
      .delete()
      .eq('attachment_id', id)
      .eq('message_id', messageId)
      .eq('tenant_id', tenantId);
    if (error) throw new BadRequestException('Falha ao desvincular attachment');
  }

  async findByMessage(
    messageId: string,
    tenantId: string,
  ): Promise<CommunicationAttachment[]> {
    const { data, error } = await this.supabase
      .from('communication_message_attachments')
      .select('attachment_id')
      .eq('message_id', messageId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('display_order', { ascending: true });
    if (error)
      throw new BadRequestException('Falha ao buscar attachments da mensagem');
    if (!data || data.length === 0) return [];
    const ids = data.map((d) => d.attachment_id);
    const { data: attachments } = await this.supabase
      .from('communication_attachments')
      .select('*')
      .in('id', ids)
      .is('deleted_at', null);
    return attachments || [];
  }

  async remove(id: string, tenantId: string, userId?: string): Promise<void> {
    await this.findOne(id, tenantId);
    await this.softDeleteService.softDelete(
      this.supabase,
      'communication_attachments',
      id,
      userId ?? '',
    );
    this.logger.log('Attachment deleted', 'CommunicationAttachmentsService', {
      attachmentId: id,
    });
  }
}
