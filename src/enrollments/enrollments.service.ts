import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import {
  Enrollment,
  EnrollmentWithRelations,
  EnrollmentClassMembership,
  EnrollmentEvent,
  PaginatedResult,
} from '../common/types';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import {
  UpdateEnrollmentDto,
  AssignClassDto,
  LeaveSchoolDto,
} from './dto/update-enrollment.dto';

@Injectable()
export class EnrollmentsService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
    private softDeleteService: SoftDeleteService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  // ============================================
  // Helper: Criar evento de matrícula
  // ============================================
  private async createEvent(
    tenantId: string,
    enrollmentId: string,
    eventType: string,
    userId?: string,
    metadata: Record<string, unknown> = {},
    fromClassGroupId?: string,
    toClassGroupId?: string,
  ): Promise<void> {
    await this.supabase.from('enrollment_events').insert({
      tenant_id: tenantId,
      enrollment_id: enrollmentId,
      event_type: eventType,
      effective_at: new Date().toISOString(),
      actor_type: userId ? 'user' : 'system',
      actor_id: userId || null,
      from_class_group_id: fromClassGroupId || null,
      to_class_group_id: toClassGroupId || null,
      metadata,
      created_at: new Date().toISOString(),
    });
  }

  // ============================================
  // CRUD Operations
  // ============================================

  async findAll(
    tenantId: string,
    filters?: {
      schoolId?: string;
      academicYearId?: string;
      studentId?: string;
      status?: string;
    },
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResult<EnrollmentWithRelations>> {
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('enrollments')
      .select(
        `
        *,
        students!inner (
          *,
          persons!inner (*)
        ),
        academic_years (*)
      `,
        { count: 'exact' },
      )
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('enrolled_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (filters?.schoolId) {
      query = query.eq('school_id', filters.schoolId);
    }

    if (filters?.academicYearId) {
      query = query.eq('academic_year_id', filters.academicYearId);
    }

    if (filters?.studentId) {
      query = query.eq('student_id', filters.studentId);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error, count } = await query;

    if (error) {
      this.logger.error(
        `Failed to list enrollments: ${error.message}`,
        undefined,
        'EnrollmentsService',
      );
      throw new Error(`Failed to list enrollments: ${error.message}`);
    }

    const enrollments = (data || []).map((e: any) => ({
      ...e,
      student: {
        ...e.students,
        person: e.students.persons,
      },
      academic_year: e.academic_years,
    }));

    return {
      data: enrollments as EnrollmentWithRelations[],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<EnrollmentWithRelations | null> {
    const { data, error } = await this.supabase
      .from('enrollments')
      .select(
        `
        *,
        students!inner (
          *,
          persons!inner (*)
        ),
        academic_years (*)
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
      throw new Error(`Failed to get enrollment: ${error.message}`);
    }

    // Buscar memberships
    const { data: memberships } = await this.supabase
      .from('enrollment_class_memberships')
      .select(
        `
        *,
        class_groups (
          *,
          grade_levels (*),
          shifts (*)
        )
      `,
      )
      .eq('enrollment_id', id)
      .is('deleted_at', null)
      .order('valid_from', { ascending: false });

    return {
      ...data,
      student: {
        ...data.students,
        person: data.students.persons,
      },
      academic_year: data.academic_years,
      class_memberships: (memberships || []).map((m: any) => ({
        ...m,
        class_group: m.class_groups,
      })),
    } as EnrollmentWithRelations;
  }

  async create(
    tenantId: string,
    dto: CreateEnrollmentDto,
    userId?: string,
  ): Promise<EnrollmentWithRelations> {
    // Verificar se escola pertence ao tenant
    const { data: school } = await this.supabase
      .from('schools')
      .select('id, tenant_id')
      .eq('id', dto.school_id)
      .single();

    if (!school || school.tenant_id !== tenantId) {
      throw new ForbiddenException('Escola não pertence a esta organização');
    }

    // Verificar se ano letivo pertence à escola
    const { data: academicYear } = await this.supabase
      .from('academic_years')
      .select('id, school_id, status')
      .eq('id', dto.academic_year_id)
      .eq('school_id', dto.school_id)
      .is('deleted_at', null)
      .single();

    if (!academicYear) {
      throw new BadRequestException(
        'Ano letivo não encontrado para esta escola',
      );
    }

    if (academicYear.status === 'closed') {
      throw new BadRequestException(
        'Não é possível matricular em um ano letivo encerrado',
      );
    }

    // Verificar se aluno existe e tem perfil no tenant
    const { data: studentProfile } = await this.supabase
      .from('student_tenant_profiles')
      .select('student_id')
      .eq('student_id', dto.student_id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (!studentProfile) {
      throw new BadRequestException('Aluno não encontrado nesta organização');
    }

    // Verificar se aluno já tem matrícula neste ano/escola
    const { data: existingEnrollment } = await this.supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', dto.student_id)
      .eq('academic_year_id', dto.academic_year_id)
      .eq('school_id', dto.school_id)
      .is('deleted_at', null)
      .single();

    if (existingEnrollment) {
      throw new ConflictException(
        'Aluno já possui matrícula neste ano letivo para esta escola',
      );
    }

    // Criar matrícula
    const { data: enrollment, error } = await this.supabase
      .from('enrollments')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id,
        academic_year_id: dto.academic_year_id,
        student_id: dto.student_id,
        enrolled_at: dto.enrolled_at || new Date().toISOString().split('T')[0],
        status: 'active',
        notes: dto.notes,
        ai_context: dto.ai_context ?? {},
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        `Failed to create enrollment: ${error.message}`,
        undefined,
        'EnrollmentsService',
      );
      throw new Error(`Failed to create enrollment: ${error.message}`);
    }

    // Criar evento de criação
    await this.createEvent(tenantId, enrollment.id, 'created', userId, {
      school_id: dto.school_id,
      academic_year_id: dto.academic_year_id,
    });

    // Se turma foi informada, associar
    if (dto.class_group_id) {
      await this.assignClass(
        enrollment.id,
        tenantId,
        { class_group_id: dto.class_group_id },
        userId,
      );
    }

    this.logger.log('Enrollment created', 'EnrollmentsService', {
      id: enrollment.id,
      studentId: dto.student_id,
      academicYearId: dto.academic_year_id,
    });

    return (await this.findOne(enrollment.id, tenantId))!;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateEnrollmentDto,
    userId?: string,
  ): Promise<Enrollment> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Matrícula com id '${id}' não encontrada`);
    }

    const previousStatus = existing.status;

    const { data, error } = await this.supabase
      .from('enrollments')
      .update({
        ...dto,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update enrollment: ${error.message}`);
    }

    // Se status mudou, criar evento
    if (dto.status && dto.status !== previousStatus) {
      await this.createEvent(tenantId, id, 'status_changed', userId, {
        from_status: previousStatus,
        to_status: dto.status,
      });
    }

    return data as Enrollment;
  }

  async assignClass(
    id: string,
    tenantId: string,
    dto: AssignClassDto,
    userId?: string,
  ): Promise<EnrollmentClassMembership> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Matrícula com id '${id}' não encontrada`);
    }

    if (existing.status !== 'active') {
      throw new BadRequestException(
        'Não é possível atribuir turma a uma matrícula inativa',
      );
    }

    // Verificar se turma existe e pertence ao mesmo ano letivo
    const { data: classGroup } = await this.supabase
      .from('class_groups')
      .select('id, academic_year_id')
      .eq('id', dto.class_group_id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (!classGroup) {
      throw new BadRequestException('Turma não encontrada');
    }

    if (classGroup.academic_year_id !== existing.academic_year_id) {
      throw new BadRequestException(
        'Turma não pertence ao mesmo ano letivo da matrícula',
      );
    }

    const validFrom = dto.valid_from || new Date().toISOString().split('T')[0];

    // Encontrar turma atual ativa
    const currentMembership = existing.class_memberships?.find(
      (m) => !m.valid_to,
    );
    const fromClassGroupId = currentMembership?.class_group_id;

    // Fechar membership anterior se existir
    if (currentMembership) {
      await this.supabase
        .from('enrollment_class_memberships')
        .update({
          valid_to: validFrom,
        })
        .eq('id', currentMembership.id);

      // Criar evento de fechamento
      await this.createEvent(
        tenantId,
        id,
        'class_membership_closed',
        userId,
        { reason: dto.reason || 'Troca de turma' },
        fromClassGroupId,
        undefined,
      );
    }

    // Criar nova membership
    const { data, error } = await this.supabase
      .from('enrollment_class_memberships')
      .insert({
        tenant_id: tenantId,
        enrollment_id: id,
        class_group_id: dto.class_group_id,
        valid_from: validFrom,
        reason: dto.reason,
        created_at: new Date().toISOString(),
        created_by: userId || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to assign class: ${error.message}`);
    }

    // Criar evento de adição
    await this.createEvent(
      tenantId,
      id,
      'class_membership_added',
      userId,
      { reason: dto.reason },
      fromClassGroupId,
      dto.class_group_id,
    );

    this.logger.log('Class assigned to enrollment', 'EnrollmentsService', {
      enrollmentId: id,
      classGroupId: dto.class_group_id,
    });

    return data as EnrollmentClassMembership;
  }

  async leaveSchool(
    id: string,
    tenantId: string,
    dto: LeaveSchoolDto,
    userId?: string,
  ): Promise<Enrollment> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Matrícula com id '${id}' não encontrada`);
    }

    if (existing.status !== 'active') {
      throw new BadRequestException('Matrícula já foi encerrada');
    }

    const leftAt = dto.left_at || new Date().toISOString().split('T')[0];

    // Atualizar matrícula
    const { data, error } = await this.supabase
      .from('enrollments')
      .update({
        status: dto.reason,
        left_at: leftAt,
        notes: dto.notes
          ? `${existing.notes || ''}\n${dto.notes}`.trim()
          : existing.notes,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update enrollment: ${error.message}`);
    }

    // Fechar membership ativa
    await this.supabase
      .from('enrollment_class_memberships')
      .update({
        valid_to: leftAt,
      })
      .eq('enrollment_id', id)
      .is('valid_to', null)
      .is('deleted_at', null);

    // Criar evento
    await this.createEvent(tenantId, id, 'left_school', userId, {
      reason: dto.reason,
      left_at: leftAt,
      notes: dto.notes,
    });

    this.logger.log('Student left school', 'EnrollmentsService', {
      enrollmentId: id,
      reason: dto.reason,
    });

    return data as Enrollment;
  }

  async getEvents(id: string, tenantId: string): Promise<EnrollmentEvent[]> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Matrícula com id '${id}' não encontrada`);
    }

    const { data, error } = await this.supabase
      .from('enrollment_events')
      .select('*')
      .eq('enrollment_id', id)
      .order('effective_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get events: ${error.message}`);
    }

    return (data || []) as EnrollmentEvent[];
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Matrícula com id '${id}' não encontrada`);
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'enrollments',
      id,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete enrollment: ${result.error}`);
    }

    // Soft-delete memberships
    await this.supabase
      .from('enrollment_class_memberships')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('enrollment_id', id)
      .is('deleted_at', null);

    this.logger.log('Enrollment deleted', 'EnrollmentsService', { id });
  }
}
