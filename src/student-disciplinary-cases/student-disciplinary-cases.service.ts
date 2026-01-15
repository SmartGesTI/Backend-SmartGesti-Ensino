import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import {
  StudentDisciplinaryCase,
  StudentDisciplinaryAction,
} from '../common/types';
import {
  CreateDisciplinaryCaseDto,
  UpdateDisciplinaryCaseDto,
  CloseCaseDto,
  VoidCaseDto,
  LinkDocumentDto,
} from './dto/create-disciplinary-case.dto';
import {
  CreateDisciplinaryActionDto,
  UpdateDisciplinaryActionDto,
} from './dto/create-disciplinary-action.dto';

export interface DisciplinaryCaseWithRelations extends StudentDisciplinaryCase {
  student?: { id: string; person?: { full_name: string } };
  actions?: StudentDisciplinaryAction[];
  official_document?: { id: string; title: string };
}

@Injectable()
export class StudentDisciplinaryCasesService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
    private softDeleteService: SoftDeleteService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  // ============================================
  // CRUD Principal
  // ============================================

  async findAll(
    tenantId: string,
    options?: {
      schoolId?: string;
      studentId?: string;
      status?: string;
      caseType?: string;
      severity?: string;
    },
  ): Promise<StudentDisciplinaryCase[]> {
    let query = this.supabase
      .from('student_disciplinary_cases')
      .select('*, students(id, persons(full_name))')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('occurred_at', { ascending: false });

    if (options?.schoolId) {
      query = query.eq('school_id', options.schoolId);
    }

    if (options?.studentId) {
      query = query.eq('student_id', options.studentId);
    }

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.caseType) {
      query = query.eq('case_type', options.caseType);
    }

    if (options?.severity) {
      query = query.eq('severity', options.severity);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list cases: ${error.message}`);
    }

    return (data || []) as StudentDisciplinaryCase[];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<DisciplinaryCaseWithRelations | null> {
    const { data, error } = await this.supabase
      .from('student_disciplinary_cases')
      .select(
        `
        *,
        students(id, persons(full_name)),
        school_documents(id, title)
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
      throw new Error(`Failed to get case: ${error.message}`);
    }

    // Buscar acoes
    const { data: actions } = await this.supabase
      .from('student_disciplinary_actions')
      .select('*')
      .eq('case_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    return {
      ...data,
      student: (data as any).students,
      official_document: (data as any).school_documents,
      actions: actions || [],
    } as DisciplinaryCaseWithRelations;
  }

  async create(
    tenantId: string,
    dto: CreateDisciplinaryCaseDto,
    staffSchoolProfileId: string | null,
    userId?: string,
  ): Promise<StudentDisciplinaryCase> {
    const { data, error } = await this.supabase
      .from('student_disciplinary_cases')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id,
        student_id: dto.student_id,
        academic_year_id: dto.academic_year_id ?? null,
        enrollment_id: dto.enrollment_id ?? null,
        class_group_id: dto.class_group_id ?? null,
        reported_by_staff_school_profile_id: staffSchoolProfileId,
        case_type: dto.case_type,
        severity: dto.severity,
        occurred_at: dto.occurred_at,
        location: dto.location ?? null,
        title: dto.title ?? null,
        description: dto.description,
        immediate_actions: dto.immediate_actions ?? null,
        status: 'open',
        confidentiality: dto.confidentiality ?? 'internal',
        metadata: dto.metadata ?? {},
        ai_context: dto.ai_context ?? {},
        ai_summary: dto.ai_summary ?? null,
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create case: ${error.message}`);
    }

    this.logger.log(
      'Disciplinary case created',
      'StudentDisciplinaryCasesService',
      {
        id: data.id,
        studentId: dto.student_id,
        caseType: dto.case_type,
      },
    );

    return data as StudentDisciplinaryCase;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateDisciplinaryCaseDto,
    userId?: string,
  ): Promise<StudentDisciplinaryCase> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Caso nao encontrado`);
    }

    if (existing.status === 'closed' || existing.status === 'voided') {
      throw new BadRequestException(
        `Caso com status '${existing.status}' nao pode ser editado`,
      );
    }

    const { data, error } = await this.supabase
      .from('student_disciplinary_cases')
      .update({
        ...dto,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update case: ${error.message}`);
    }

    this.logger.log(
      'Disciplinary case updated',
      'StudentDisciplinaryCasesService',
      { id },
    );

    return data as StudentDisciplinaryCase;
  }

  async close(
    id: string,
    tenantId: string,
    staffSchoolProfileId: string | null,
    dto: CloseCaseDto,
    userId?: string,
  ): Promise<StudentDisciplinaryCase> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Caso nao encontrado`);
    }

    if (existing.status === 'closed') {
      throw new BadRequestException('Caso ja esta fechado');
    }

    if (existing.status === 'voided') {
      throw new BadRequestException('Caso anulado nao pode ser fechado');
    }

    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('student_disciplinary_cases')
      .update({
        status: 'closed',
        closed_at: now,
        closed_by_staff_school_profile_id: staffSchoolProfileId,
        metadata: {
          ...(existing.metadata || {}),
          closure_notes: dto.notes,
        },
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to close case: ${error.message}`);
    }

    this.logger.log(
      'Disciplinary case closed',
      'StudentDisciplinaryCasesService',
      { id },
    );

    return data as StudentDisciplinaryCase;
  }

  async void(
    id: string,
    tenantId: string,
    dto: VoidCaseDto,
    userId?: string,
  ): Promise<StudentDisciplinaryCase> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Caso nao encontrado`);
    }

    if (existing.status === 'voided') {
      throw new BadRequestException('Caso ja esta anulado');
    }

    const { data, error } = await this.supabase
      .from('student_disciplinary_cases')
      .update({
        status: 'voided',
        metadata: {
          ...(existing.metadata || {}),
          void_reason: dto.reason,
          voided_at: new Date().toISOString(),
        },
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to void case: ${error.message}`);
    }

    // Cancelar todas as acoes ativas
    await this.supabase
      .from('student_disciplinary_actions')
      .update({ status: 'cancelled' })
      .eq('case_id', id)
      .eq('status', 'active')
      .is('deleted_at', null);

    this.logger.log(
      'Disciplinary case voided',
      'StudentDisciplinaryCasesService',
      {
        id,
        reason: dto.reason,
      },
    );

    return data as StudentDisciplinaryCase;
  }

  async linkDocument(
    id: string,
    tenantId: string,
    dto: LinkDocumentDto,
    userId?: string,
  ): Promise<StudentDisciplinaryCase> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Caso nao encontrado`);
    }

    const { data, error } = await this.supabase
      .from('student_disciplinary_cases')
      .update({
        official_document_id: dto.document_id,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to link document: ${error.message}`);
    }

    this.logger.log(
      'Document linked to case',
      'StudentDisciplinaryCasesService',
      {
        caseId: id,
        documentId: dto.document_id,
      },
    );

    return data as StudentDisciplinaryCase;
  }

  async remove(id: string, tenantId: string, userId?: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Caso nao encontrado`);
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'student_disciplinary_cases',
      id,
      userId ?? '',
    );

    if (!result.success) {
      throw new Error(`Failed to delete case: ${result.error}`);
    }

    this.logger.log(
      'Disciplinary case deleted',
      'StudentDisciplinaryCasesService',
      { id },
    );
  }

  // ============================================
  // Acoes
  // ============================================

  async findActions(
    caseId: string,
    tenantId: string,
  ): Promise<StudentDisciplinaryAction[]> {
    const caseData = await this.findOne(caseId, tenantId);
    if (!caseData) {
      throw new NotFoundException(`Caso nao encontrado`);
    }

    const { data, error } = await this.supabase
      .from('student_disciplinary_actions')
      .select('*')
      .eq('case_id', caseId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to list actions: ${error.message}`);
    }

    return (data || []) as StudentDisciplinaryAction[];
  }

  async addAction(
    caseId: string,
    tenantId: string,
    staffSchoolProfileId: string | null,
    dto: CreateDisciplinaryActionDto,
    userId?: string,
  ): Promise<StudentDisciplinaryAction> {
    const caseData = await this.findOne(caseId, tenantId);
    if (!caseData) {
      throw new NotFoundException(`Caso nao encontrado`);
    }

    if (caseData.status === 'voided') {
      throw new BadRequestException(
        'Nao e possivel adicionar acoes a caso anulado',
      );
    }

    const { data, error } = await this.supabase
      .from('student_disciplinary_actions')
      .insert({
        tenant_id: tenantId,
        school_id: caseData.school_id,
        case_id: caseId,
        action_type: dto.action_type,
        effective_from: dto.effective_from ?? null,
        effective_to: dto.effective_to ?? null,
        duration_days: dto.duration_days ?? null,
        decision_notes: dto.decision_notes ?? null,
        decided_by_staff_school_profile_id: staffSchoolProfileId,
        document_id: dto.document_id ?? null,
        status: 'active',
        metadata: dto.metadata ?? {},
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add action: ${error.message}`);
    }

    this.logger.log('Action added to case', 'StudentDisciplinaryCasesService', {
      caseId,
      actionId: data.id,
      actionType: dto.action_type,
    });

    return data as StudentDisciplinaryAction;
  }

  async updateAction(
    caseId: string,
    actionId: string,
    tenantId: string,
    dto: UpdateDisciplinaryActionDto,
    userId?: string,
  ): Promise<StudentDisciplinaryAction> {
    const caseData = await this.findOne(caseId, tenantId);
    if (!caseData) {
      throw new NotFoundException(`Caso nao encontrado`);
    }

    const { data, error } = await this.supabase
      .from('student_disciplinary_actions')
      .update({
        ...dto,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', actionId)
      .eq('case_id', caseId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update action: ${error.message}`);
    }

    this.logger.log('Action updated', 'StudentDisciplinaryCasesService', {
      caseId,
      actionId,
    });

    return data as StudentDisciplinaryAction;
  }

  async completeAction(
    caseId: string,
    actionId: string,
    tenantId: string,
    userId?: string,
  ): Promise<StudentDisciplinaryAction> {
    const caseData = await this.findOne(caseId, tenantId);
    if (!caseData) {
      throw new NotFoundException(`Caso nao encontrado`);
    }

    const { data, error } = await this.supabase
      .from('student_disciplinary_actions')
      .update({
        status: 'completed',
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', actionId)
      .eq('case_id', caseId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to complete action: ${error.message}`);
    }

    this.logger.log('Action completed', 'StudentDisciplinaryCasesService', {
      caseId,
      actionId,
    });

    return data as StudentDisciplinaryAction;
  }

  async cancelAction(
    caseId: string,
    actionId: string,
    tenantId: string,
    userId?: string,
  ): Promise<StudentDisciplinaryAction> {
    const caseData = await this.findOne(caseId, tenantId);
    if (!caseData) {
      throw new NotFoundException(`Caso nao encontrado`);
    }

    const { data, error } = await this.supabase
      .from('student_disciplinary_actions')
      .update({
        status: 'cancelled',
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', actionId)
      .eq('case_id', caseId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to cancel action: ${error.message}`);
    }

    this.logger.log('Action cancelled', 'StudentDisciplinaryCasesService', {
      caseId,
      actionId,
    });

    return data as StudentDisciplinaryAction;
  }

  async removeAction(
    caseId: string,
    actionId: string,
    tenantId: string,
    userId?: string,
  ): Promise<void> {
    const caseData = await this.findOne(caseId, tenantId);
    if (!caseData) {
      throw new NotFoundException(`Caso nao encontrado`);
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'student_disciplinary_actions',
      actionId,
      userId ?? '',
    );

    if (!result.success) {
      throw new Error(`Failed to delete action: ${result.error}`);
    }

    this.logger.log('Action deleted', 'StudentDisciplinaryCasesService', {
      caseId,
      actionId,
    });
  }
}
