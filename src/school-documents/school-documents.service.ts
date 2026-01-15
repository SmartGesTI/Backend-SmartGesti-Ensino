import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { SchoolDocument, SchoolDocumentFile } from '../common/types';
import {
  CreateSchoolDocumentDto,
  UpdateSchoolDocumentDto,
  IssueDocumentDto,
  CancelDocumentDto,
} from './dto/create-school-document.dto';
import { CreateDocumentFileDto } from './dto/create-document-file.dto';

const HASH_ALGO = 'sha256';

export interface SchoolDocumentWithRelations extends SchoolDocument {
  document_type?: { id: string; name: string; slug: string; category: string };
  template?: { id: string; name: string };
  student?: { id: string; person?: { full_name: string } };
  files?: SchoolDocumentFile[];
}

@Injectable()
export class SchoolDocumentsService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
    private softDeleteService: SoftDeleteService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  private calculateHash(payload: Record<string, unknown>): string {
    const serialized = JSON.stringify(payload, Object.keys(payload).sort());
    return createHash(HASH_ALGO).update(serialized).digest('hex');
  }

  // ============================================
  // CRUD Principal
  // ============================================

  async findAll(
    tenantId: string,
    options?: {
      schoolId?: string;
      documentTypeId?: string;
      studentId?: string;
      status?: string;
      visibility?: string;
    },
  ): Promise<SchoolDocument[]> {
    let query = this.supabase
      .from('school_documents')
      .select('*, school_document_types(id, name, slug)')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (options?.schoolId) {
      query = query.eq('school_id', options.schoolId);
    }

    if (options?.documentTypeId) {
      query = query.eq('document_type_id', options.documentTypeId);
    }

    if (options?.studentId) {
      query = query.eq('student_id', options.studentId);
    }

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.visibility) {
      query = query.eq('visibility', options.visibility);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list documents: ${error.message}`);
    }

    return (data || []) as SchoolDocument[];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<SchoolDocumentWithRelations | null> {
    const { data, error } = await this.supabase
      .from('school_documents')
      .select(
        `
        *,
        school_document_types(id, name, slug, category),
        school_document_templates(id, name),
        students(id, persons(full_name))
      `,
      )
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get document: ${error.message}`);
    }

    // Buscar arquivos
    const { data: files } = await this.supabase
      .from('school_document_files')
      .select('*')
      .eq('school_document_id', id)
      .is('deleted_at', null);

    return {
      ...data,
      document_type: (data as any).school_document_types,
      template: (data as any).school_document_templates,
      student: (data as any).students,
      files: files || [],
    } as SchoolDocumentWithRelations;
  }

  async create(
    tenantId: string,
    dto: CreateSchoolDocumentDto,
    userId?: string,
  ): Promise<SchoolDocument> {
    // Verificar se document_type existe
    const { data: docType } = await this.supabase
      .from('school_document_types')
      .select('id, is_official_record')
      .eq('id', dto.document_type_id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (!docType) {
      throw new NotFoundException(`Tipo de documento nao encontrado`);
    }

    const payloadHash = dto.payload ? this.calculateHash(dto.payload) : null;

    const { data, error } = await this.supabase
      .from('school_documents')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id,
        document_type_id: dto.document_type_id,
        academic_year_id: dto.academic_year_id ?? null,
        enrollment_id: dto.enrollment_id ?? null,
        student_id: dto.student_id ?? null,
        class_group_id: dto.class_group_id ?? null,
        title: dto.title,
        status: 'draft',
        document_date: dto.document_date,
        event_at: dto.event_at ?? null,
        due_at: dto.due_at ?? null,
        template_id: dto.template_id ?? null,
        payload: dto.payload ?? {},
        payload_hash: payloadHash,
        hash_algo: HASH_ALGO,
        is_official_record: docType.is_official_record,
        locked: false,
        visibility: dto.visibility ?? 'internal',
        metadata: dto.metadata ?? {},
        ai_context: dto.ai_context ?? {},
        ai_summary: dto.ai_summary ?? null,
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create document: ${error.message}`);
    }

    // Criar evento
    await this.createEvent(tenantId, dto.school_id, data.id, 'created', userId);

    this.logger.log('Document created', 'SchoolDocumentsService', {
      id: data.id,
      title: dto.title,
    });

    return data as SchoolDocument;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateSchoolDocumentDto,
    userId?: string,
  ): Promise<SchoolDocument> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Documento nao encontrado`);
    }

    if (existing.locked) {
      throw new BadRequestException('Documento bloqueado nao pode ser editado');
    }

    if (existing.status === 'issued' || existing.status === 'cancelled') {
      throw new BadRequestException(
        `Documento com status '${existing.status}' nao pode ser editado`,
      );
    }

    const payloadHash = dto.payload
      ? this.calculateHash(dto.payload)
      : existing.payload_hash;

    const { data, error } = await this.supabase
      .from('school_documents')
      .update({
        ...dto,
        payload_hash: payloadHash,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update document: ${error.message}`);
    }

    await this.createEvent(tenantId, existing.school_id, id, 'updated', userId);

    this.logger.log('Document updated', 'SchoolDocumentsService', { id });

    return data as SchoolDocument;
  }

  // ============================================
  // Acoes Especiais
  // ============================================

  async issue(
    id: string,
    tenantId: string,
    dto: IssueDocumentDto,
    userId?: string,
  ): Promise<SchoolDocument> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Documento nao encontrado`);
    }

    if (existing.status !== 'draft') {
      throw new BadRequestException(
        `Apenas documentos em rascunho podem ser emitidos`,
      );
    }

    // Gerar numero do documento
    const documentNumber = await this.generateDocumentNumber(
      tenantId,
      existing.school_id,
      existing.document_type_id,
      existing.academic_year_id,
      id,
    );

    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('school_documents')
      .update({
        status: 'issued',
        document_number: documentNumber,
        issued_by: userId,
        locked: true,
        locked_at: now,
        locked_by: userId,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to issue document: ${error.message}`);
    }

    await this.createEvent(tenantId, existing.school_id, id, 'issued', userId);

    this.logger.log('Document issued', 'SchoolDocumentsService', {
      id,
      documentNumber,
    });

    return data as SchoolDocument;
  }

  private async generateDocumentNumber(
    tenantId: string,
    schoolId: string,
    documentTypeId: string,
    academicYearId: string | null,
    documentId: string,
  ): Promise<string> {
    // Buscar tipo de documento para verificar modo de numeracao
    const { data: docType } = await this.supabase
      .from('school_document_types')
      .select('numbering_mode, default_prefix')
      .eq('id', documentTypeId)
      .single();

    if (!docType || docType.numbering_mode === 'none') {
      return null as any;
    }

    // Buscar ou criar contador
    let counterQuery = this.supabase
      .from('school_document_number_counters')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('document_type_id', documentTypeId)
      .is('deleted_at', null);

    if (
      docType.numbering_mode === 'per_school' ||
      docType.numbering_mode === 'per_school_year'
    ) {
      counterQuery = counterQuery.eq('school_id', schoolId);
    }

    if (docType.numbering_mode === 'per_school_year' && academicYearId) {
      counterQuery = counterQuery.eq('academic_year_id', academicYearId);
    }

    const { data: counter } = await counterQuery.single();

    let nextNumber: number;
    const now = new Date().toISOString();

    if (counter) {
      nextNumber = counter.next_number;

      // Atualizar contador
      await this.supabase
        .from('school_document_number_counters')
        .update({
          next_number: nextNumber + 1,
          last_issued_at: now,
          last_document_id: documentId,
          updated_at: now,
        })
        .eq('id', counter.id);
    } else {
      nextNumber = 1;

      // Criar contador
      await this.supabase.from('school_document_number_counters').insert({
        tenant_id: tenantId,
        school_id: schoolId,
        document_type_id: documentTypeId,
        academic_year_id: academicYearId,
        prefix: docType.default_prefix,
        next_number: 2,
        last_issued_at: now,
        last_document_id: documentId,
        updated_at: now,
      });
    }

    const prefix = docType.default_prefix || '';
    const year = new Date().getFullYear();
    const paddedNumber = String(nextNumber).padStart(4, '0');

    return `${prefix}${year}/${paddedNumber}`;
  }

  async lock(
    id: string,
    tenantId: string,
    userId?: string,
  ): Promise<SchoolDocument> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Documento nao encontrado`);
    }

    if (existing.locked) {
      throw new BadRequestException('Documento ja esta bloqueado');
    }

    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('school_documents')
      .update({
        locked: true,
        locked_at: now,
        locked_by: userId,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to lock document: ${error.message}`);
    }

    await this.createEvent(tenantId, existing.school_id, id, 'locked', userId);

    this.logger.log('Document locked', 'SchoolDocumentsService', { id });

    return data as SchoolDocument;
  }

  async cancel(
    id: string,
    tenantId: string,
    dto: CancelDocumentDto,
    userId?: string,
  ): Promise<SchoolDocument> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Documento nao encontrado`);
    }

    if (existing.status === 'cancelled') {
      throw new BadRequestException('Documento ja esta cancelado');
    }

    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('school_documents')
      .update({
        status: 'cancelled',
        cancelled_at: now,
        cancelled_by: userId,
        cancellation_reason: dto.reason,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to cancel document: ${error.message}`);
    }

    await this.createEvent(
      tenantId,
      existing.school_id,
      id,
      'cancelled',
      userId,
      { reason: dto.reason },
    );

    this.logger.log('Document cancelled', 'SchoolDocumentsService', {
      id,
      reason: dto.reason,
    });

    return data as SchoolDocument;
  }

  async archive(
    id: string,
    tenantId: string,
    userId?: string,
  ): Promise<SchoolDocument> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Documento nao encontrado`);
    }

    if (existing.status === 'archived') {
      throw new BadRequestException('Documento ja esta arquivado');
    }

    const { data, error } = await this.supabase
      .from('school_documents')
      .update({
        status: 'archived',
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to archive document: ${error.message}`);
    }

    await this.createEvent(
      tenantId,
      existing.school_id,
      id,
      'archived',
      userId,
    );

    this.logger.log('Document archived', 'SchoolDocumentsService', { id });

    return data as SchoolDocument;
  }

  async remove(id: string, tenantId: string, userId?: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Documento nao encontrado`);
    }

    if (existing.status === 'issued' && existing.is_official_record) {
      throw new BadRequestException(
        'Documentos oficiais emitidos nao podem ser removidos',
      );
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'school_documents',
      id,
      userId ?? '',
    );

    if (!result.success) {
      throw new Error(`Failed to delete document: ${result.error}`);
    }

    this.logger.log('Document deleted', 'SchoolDocumentsService', { id });
  }

  // ============================================
  // Arquivos
  // ============================================

  async findFiles(
    documentId: string,
    tenantId: string,
  ): Promise<SchoolDocumentFile[]> {
    const doc = await this.findOne(documentId, tenantId);
    if (!doc) {
      throw new NotFoundException(`Documento nao encontrado`);
    }

    const { data, error } = await this.supabase
      .from('school_document_files')
      .select('*')
      .eq('school_document_id', documentId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }

    return (data || []) as SchoolDocumentFile[];
  }

  async addFile(
    documentId: string,
    tenantId: string,
    dto: CreateDocumentFileDto,
    userId?: string,
  ): Promise<SchoolDocumentFile> {
    const doc = await this.findOne(documentId, tenantId);
    if (!doc) {
      throw new NotFoundException(`Documento nao encontrado`);
    }

    // Se is_primary, desmarcar outros
    if (dto.is_primary) {
      await this.supabase
        .from('school_document_files')
        .update({ is_primary: false })
        .eq('school_document_id', documentId)
        .is('deleted_at', null);
    }

    const { data, error } = await this.supabase
      .from('school_document_files')
      .insert({
        tenant_id: tenantId,
        school_document_id: documentId,
        file_kind: dto.file_kind,
        storage_bucket: dto.storage_bucket,
        storage_path: dto.storage_path,
        file_name: dto.file_name ?? null,
        mime_type: dto.mime_type ?? null,
        size_bytes: dto.size_bytes ?? null,
        checksum_sha256: dto.checksum_sha256 ?? null,
        is_primary: dto.is_primary ?? false,
        created_at: new Date().toISOString(),
        created_by: userId ?? null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add file: ${error.message}`);
    }

    await this.createEvent(
      tenantId,
      doc.school_id,
      documentId,
      'file_added',
      userId,
      {
        file_id: data.id,
        file_kind: dto.file_kind,
      },
    );

    this.logger.log('File added to document', 'SchoolDocumentsService', {
      documentId,
      fileId: data.id,
    });

    return data as SchoolDocumentFile;
  }

  async removeFile(
    documentId: string,
    fileId: string,
    tenantId: string,
    userId?: string,
  ): Promise<void> {
    const doc = await this.findOne(documentId, tenantId);
    if (!doc) {
      throw new NotFoundException(`Documento nao encontrado`);
    }

    if (doc.locked) {
      throw new BadRequestException(
        'Nao e possivel remover arquivos de documento bloqueado',
      );
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'school_document_files',
      fileId,
      userId ?? '',
    );

    if (!result.success) {
      throw new Error(`Failed to remove file: ${result.error}`);
    }

    this.logger.log('File removed from document', 'SchoolDocumentsService', {
      documentId,
      fileId,
    });
  }

  // ============================================
  // Destinatarios
  // ============================================

  async findRecipients(documentId: string, tenantId: string): Promise<any[]> {
    const doc = await this.findOne(documentId, tenantId);
    if (!doc) {
      throw new NotFoundException(`Documento nao encontrado`);
    }

    const { data, error } = await this.supabase
      .from('school_document_recipients')
      .select(
        '*, guardians(id, persons(full_name)), students(id, persons(full_name))',
      )
      .eq('school_document_id', documentId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to list recipients: ${error.message}`);
    }

    return data || [];
  }

  async addRecipient(
    documentId: string,
    tenantId: string,
    dto: any,
    userId?: string,
  ): Promise<any> {
    const doc = await this.findOne(documentId, tenantId);
    if (!doc) {
      throw new NotFoundException(`Documento nao encontrado`);
    }

    const { data, error } = await this.supabase
      .from('school_document_recipients')
      .insert({
        tenant_id: tenantId,
        school_document_id: documentId,
        recipient_type: dto.recipient_type,
        guardian_id: dto.guardian_id ?? null,
        student_id: dto.student_id ?? null,
        staff_school_profile_id: dto.staff_school_profile_id ?? null,
        user_id: dto.user_id ?? null,
        recipient_name: dto.recipient_name ?? null,
        recipient_email: dto.recipient_email ?? null,
        recipient_phone: dto.recipient_phone ?? null,
        delivery_channel: dto.delivery_channel ?? 'in_app',
        delivery_status: 'pending',
        consent_id: dto.consent_id ?? null,
        acknowledgement_required: dto.acknowledgement_required ?? false,
        ack_status: 'pending',
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add recipient: ${error.message}`);
    }

    await this.createEvent(
      tenantId,
      doc.school_id,
      documentId,
      'recipient_added',
      userId,
      {
        recipient_id: data.id,
        recipient_type: dto.recipient_type,
      },
    );

    this.logger.log('Recipient added', 'SchoolDocumentsService', {
      documentId,
      recipientId: data.id,
    });

    return data;
  }

  async updateRecipient(
    documentId: string,
    recipientId: string,
    tenantId: string,
    dto: any,
    userId?: string,
  ): Promise<any> {
    const doc = await this.findOne(documentId, tenantId);
    if (!doc) {
      throw new NotFoundException(`Documento nao encontrado`);
    }

    const { data, error } = await this.supabase
      .from('school_document_recipients')
      .update({
        ...dto,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', recipientId)
      .eq('school_document_id', documentId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update recipient: ${error.message}`);
    }

    await this.createEvent(
      tenantId,
      doc.school_id,
      documentId,
      'recipient_updated',
      userId,
      {
        recipient_id: recipientId,
      },
    );

    return data;
  }

  async removeRecipient(
    documentId: string,
    recipientId: string,
    tenantId: string,
    userId?: string,
  ): Promise<void> {
    const doc = await this.findOne(documentId, tenantId);
    if (!doc) {
      throw new NotFoundException(`Documento nao encontrado`);
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'school_document_recipients',
      recipientId,
      userId ?? '',
    );

    if (!result.success) {
      throw new Error(`Failed to remove recipient: ${result.error}`);
    }

    this.logger.log('Recipient removed', 'SchoolDocumentsService', {
      documentId,
      recipientId,
    });
  }

  async deliverToRecipient(
    documentId: string,
    recipientId: string,
    tenantId: string,
    dto: any,
    userId?: string,
  ): Promise<any> {
    const doc = await this.findOne(documentId, tenantId);
    if (!doc) {
      throw new NotFoundException(`Documento nao encontrado`);
    }

    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('school_document_recipients')
      .update({
        delivery_status: 'delivered',
        delivered_at: now,
        delivery_metadata: dto.delivery_metadata ?? {},
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', recipientId)
      .eq('school_document_id', documentId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to deliver to recipient: ${error.message}`);
    }

    await this.createEvent(
      tenantId,
      doc.school_id,
      documentId,
      'delivered',
      userId,
      {
        recipient_id: recipientId,
      },
    );

    this.logger.log(
      'Document delivered to recipient',
      'SchoolDocumentsService',
      {
        documentId,
        recipientId,
      },
    );

    return data;
  }

  async acknowledgeRecipient(
    documentId: string,
    recipientId: string,
    tenantId: string,
    dto: any,
    userId?: string,
    requestInfo?: { ip?: string; userAgent?: string },
  ): Promise<any> {
    const doc = await this.findOne(documentId, tenantId);
    if (!doc) {
      throw new NotFoundException(`Documento nao encontrado`);
    }

    // Buscar recipient
    const { data: recipient } = await this.supabase
      .from('school_document_recipients')
      .select('*')
      .eq('id', recipientId)
      .eq('school_document_id', documentId)
      .is('deleted_at', null)
      .single();

    if (!recipient) {
      throw new NotFoundException(`Destinatario nao encontrado`);
    }

    if (recipient.ack_status === 'acknowledged') {
      throw new BadRequestException('Destinatario ja deu ciencia');
    }

    const now = new Date().toISOString();

    // Atualizar recipient
    const { data, error } = await this.supabase
      .from('school_document_recipients')
      .update({
        ack_status: 'acknowledged',
        ack_at: now,
        ack_method: dto.ack_method,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', recipientId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to acknowledge: ${error.message}`);
    }

    // Criar registro de acknowledgement
    await this.supabase.from('school_document_acknowledgements').insert({
      tenant_id: tenantId,
      school_document_id: documentId,
      recipient_id: recipientId,
      acknowledged_at: now,
      ack_method: dto.ack_method,
      actor_type: userId ? 'user' : 'guardian',
      actor_user_id: userId ?? null,
      actor_guardian_id: recipient.guardian_id ?? null,
      ip_address: requestInfo?.ip ?? null,
      user_agent: requestInfo?.userAgent ?? null,
      evidence: dto.evidence ?? {},
      created_at: now,
    });

    await this.createEvent(
      tenantId,
      doc.school_id,
      documentId,
      'acknowledged',
      userId,
      {
        recipient_id: recipientId,
        ack_method: dto.ack_method,
      },
    );

    this.logger.log('Document acknowledged', 'SchoolDocumentsService', {
      documentId,
      recipientId,
    });

    return data;
  }

  // ============================================
  // Eventos
  // ============================================

  private async createEvent(
    tenantId: string,
    schoolId: string,
    documentId: string,
    eventType: string,
    userId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.supabase.from('school_document_events').insert({
      tenant_id: tenantId,
      school_id: schoolId,
      school_document_id: documentId,
      event_type: eventType,
      occurred_at: new Date().toISOString(),
      actor_type: userId ? 'user' : 'system',
      actor_id: userId ?? null,
      metadata: metadata ?? {},
    });
  }
}
