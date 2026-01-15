import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { AcademicRecordSnapshotsService } from '../academic-record-snapshots/academic-record-snapshots.service';
import { TransferCase, PaginatedResult } from '../common/types';
import { CreateTransferDto } from './dto/create-transfer.dto';
import {
  ApproveTransferDto,
  RejectTransferDto,
  CompleteTransferDto,
  CancelTransferDto,
} from './dto/update-transfer.dto';

export interface TransferWithRelations extends TransferCase {
  student?: {
    id: string;
    person?: {
      full_name: string;
      preferred_name?: string;
    };
  };
  from_school?: { id: string; name: string };
  to_school?: { id: string; name: string };
  from_tenant?: { id: string; name: string };
  to_tenant?: { id: string; name: string };
  from_enrollment?: { id: string; status: string };
  to_enrollment?: { id: string; status: string };
}

@Injectable()
export class TransfersService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
    private softDeleteService: SoftDeleteService,
    private snapshotsService: AcademicRecordSnapshotsService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  // ============================================
  // Helper: Criar evento de enrollment
  // ============================================
  private async createEnrollmentEvent(
    tenantId: string,
    enrollmentId: string,
    eventType: string,
    userId?: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    await this.supabase.from('enrollment_events').insert({
      tenant_id: tenantId,
      enrollment_id: enrollmentId,
      event_type: eventType,
      effective_at: new Date().toISOString(),
      actor_type: userId ? 'user' : 'system',
      actor_id: userId || null,
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
      status?: string;
      direction?: 'incoming' | 'outgoing';
      studentId?: string;
    },
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResult<TransferWithRelations>> {
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('transfer_cases')
      .select(
        `
        *,
        students!inner (
          id,
          persons!inner (full_name, preferred_name)
        )
      `,
        { count: 'exact' },
      )
      .is('deleted_at', null)
      .order('requested_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filtrar por direção (entrada ou saída do tenant)
    if (filters?.direction === 'incoming') {
      query = query.eq('to_tenant_id', tenantId);
    } else if (filters?.direction === 'outgoing') {
      query = query.eq('from_tenant_id', tenantId);
    } else {
      // Mostrar ambos: transferências de/para o tenant
      query = query.or(
        `from_tenant_id.eq.${tenantId},to_tenant_id.eq.${tenantId}`,
      );
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.studentId) {
      query = query.eq('student_id', filters.studentId);
    }

    const { data, error, count } = await query;

    if (error) {
      this.logger.error(
        `Failed to list transfers: ${error.message}`,
        undefined,
        'TransfersService',
      );
      throw new Error(`Failed to list transfers: ${error.message}`);
    }

    const transfers = (data || []).map((t: any) => ({
      ...t,
      student: {
        id: t.students.id,
        person: t.students.persons,
      },
    }));

    return {
      data: transfers as TransferWithRelations[],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<TransferWithRelations | null> {
    const { data, error } = await this.supabase
      .from('transfer_cases')
      .select(
        `
        *,
        students!inner (
          id,
          persons!inner (full_name, preferred_name)
        )
      `,
      )
      .eq('id', id)
      .or(`from_tenant_id.eq.${tenantId},to_tenant_id.eq.${tenantId}`)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get transfer: ${error.message}`);
    }

    // Buscar informações adicionais
    const [fromSchool, toSchool, fromEnrollment, toEnrollment] =
      await Promise.all([
        data.from_school_id
          ? this.supabase
              .from('schools')
              .select('id, name')
              .eq('id', data.from_school_id)
              .single()
          : null,
        data.to_school_id
          ? this.supabase
              .from('schools')
              .select('id, name')
              .eq('id', data.to_school_id)
              .single()
          : null,
        data.from_enrollment_id
          ? this.supabase
              .from('enrollments')
              .select('id, status')
              .eq('id', data.from_enrollment_id)
              .single()
          : null,
        data.to_enrollment_id
          ? this.supabase
              .from('enrollments')
              .select('id, status')
              .eq('id', data.to_enrollment_id)
              .single()
          : null,
      ]);

    return {
      ...data,
      student: {
        id: data.students.id,
        person: data.students.persons,
      },
      from_school: fromSchool?.data || undefined,
      to_school: toSchool?.data || undefined,
      from_enrollment: fromEnrollment?.data || undefined,
      to_enrollment: toEnrollment?.data || undefined,
    } as TransferWithRelations;
  }

  async create(
    tenantId: string,
    dto: CreateTransferDto,
    userId?: string,
  ): Promise<TransferWithRelations> {
    // Verificar se aluno existe e tem perfil no tenant
    const { data: studentProfile } = await this.supabase
      .from('student_tenant_profiles')
      .select('student_id, status')
      .eq('student_id', dto.student_id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (!studentProfile) {
      throw new BadRequestException('Aluno não encontrado nesta organização');
    }

    // Buscar matrícula ativa do aluno na escola de origem
    let fromEnrollmentId: string | null = null;
    if (dto.from_school_id) {
      const { data: enrollment } = await this.supabase
        .from('enrollments')
        .select('id')
        .eq('student_id', dto.student_id)
        .eq('school_id', dto.from_school_id)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('enrolled_at', { ascending: false })
        .limit(1)
        .single();

      if (!enrollment) {
        throw new BadRequestException(
          'Aluno não possui matrícula ativa na escola de origem',
        );
      }

      fromEnrollmentId = enrollment.id;
    }

    // Verificar se já existe transferência pendente para este aluno
    const { data: existingTransfer } = await this.supabase
      .from('transfer_cases')
      .select('id')
      .eq('student_id', dto.student_id)
      .in('status', ['requested', 'approved'])
      .is('deleted_at', null)
      .single();

    if (existingTransfer) {
      throw new ConflictException(
        'Já existe uma solicitação de transferência pendente para este aluno',
      );
    }

    // Verificar se tenant de destino existe
    const { data: toTenant } = await this.supabase
      .from('tenants')
      .select('id')
      .eq('id', dto.to_tenant_id)
      .single();

    if (!toTenant) {
      throw new BadRequestException('Tenant de destino não encontrado');
    }

    // Verificar se escola de destino pertence ao tenant de destino
    if (dto.to_school_id) {
      const { data: toSchool } = await this.supabase
        .from('schools')
        .select('id, tenant_id')
        .eq('id', dto.to_school_id)
        .single();

      if (!toSchool || toSchool.tenant_id !== dto.to_tenant_id) {
        throw new BadRequestException(
          'Escola de destino não pertence ao tenant de destino',
        );
      }
    }

    // Criar transferência
    const { data, error } = await this.supabase
      .from('transfer_cases')
      .insert({
        student_id: dto.student_id,
        from_tenant_id: tenantId,
        from_school_id: dto.from_school_id || null,
        to_tenant_id: dto.to_tenant_id,
        to_school_id: dto.to_school_id || null,
        from_enrollment_id: fromEnrollmentId,
        status: 'requested',
        requested_at: new Date().toISOString(),
        metadata: {
          ...dto.metadata,
          notes: dto.notes,
          to_academic_year_id: dto.to_academic_year_id,
        },
        created_at: new Date().toISOString(),
        created_by: userId || null,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        `Failed to create transfer: ${error.message}`,
        undefined,
        'TransfersService',
      );
      throw new Error(`Failed to create transfer: ${error.message}`);
    }

    // Criar evento na matrícula de origem
    if (fromEnrollmentId) {
      await this.createEnrollmentEvent(
        tenantId,
        fromEnrollmentId,
        'transfer_requested',
        userId,
        {
          transfer_id: data.id,
          to_tenant_id: dto.to_tenant_id,
          to_school_id: dto.to_school_id,
        },
      );
    }

    this.logger.log('Transfer request created', 'TransfersService', {
      id: data.id,
      studentId: dto.student_id,
      toTenantId: dto.to_tenant_id,
    });

    return (await this.findOne(data.id, tenantId))!;
  }

  async approve(
    id: string,
    tenantId: string,
    dto: ApproveTransferDto,
    userId?: string,
  ): Promise<TransferWithRelations> {
    const transfer = await this.findOne(id, tenantId);
    if (!transfer) {
      throw new NotFoundException(
        `Transferência com id '${id}' não encontrada`,
      );
    }

    // Apenas o tenant de destino pode aprovar
    if (transfer.to_tenant_id !== tenantId) {
      throw new ForbiddenException(
        'Apenas o tenant de destino pode aprovar a transferência',
      );
    }

    if (transfer.status !== 'requested') {
      throw new BadRequestException(
        `Não é possível aprovar uma transferência com status '${transfer.status}'`,
      );
    }

    const { data, error } = await this.supabase
      .from('transfer_cases')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        metadata: {
          ...transfer.metadata,
          approval_notes: dto.notes,
          ...dto.metadata,
        },
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to approve transfer: ${error.message}`);
    }

    this.logger.log('Transfer approved', 'TransfersService', { id });

    return (await this.findOne(id, tenantId))!;
  }

  async reject(
    id: string,
    tenantId: string,
    dto: RejectTransferDto,
    userId?: string,
  ): Promise<TransferWithRelations> {
    const transfer = await this.findOne(id, tenantId);
    if (!transfer) {
      throw new NotFoundException(
        `Transferência com id '${id}' não encontrada`,
      );
    }

    // Apenas o tenant de destino pode rejeitar
    if (transfer.to_tenant_id !== tenantId) {
      throw new ForbiddenException(
        'Apenas o tenant de destino pode rejeitar a transferência',
      );
    }

    if (transfer.status !== 'requested') {
      throw new BadRequestException(
        `Não é possível rejeitar uma transferência com status '${transfer.status}'`,
      );
    }

    const { data, error } = await this.supabase
      .from('transfer_cases')
      .update({
        status: 'rejected',
        metadata: {
          ...transfer.metadata,
          rejection_reason: dto.reason,
          ...dto.metadata,
        },
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to reject transfer: ${error.message}`);
    }

    this.logger.log('Transfer rejected', 'TransfersService', {
      id,
      reason: dto.reason,
    });

    return (await this.findOne(id, tenantId))!;
  }

  async complete(
    id: string,
    tenantId: string,
    dto: CompleteTransferDto,
    userId?: string,
  ): Promise<TransferWithRelations> {
    const transfer = await this.findOne(id, tenantId);
    if (!transfer) {
      throw new NotFoundException(
        `Transferência com id '${id}' não encontrada`,
      );
    }

    // Apenas o tenant de destino pode completar
    if (transfer.to_tenant_id !== tenantId) {
      throw new ForbiddenException(
        'Apenas o tenant de destino pode completar a transferência',
      );
    }

    if (transfer.status !== 'approved') {
      throw new BadRequestException(
        `Não é possível completar uma transferência com status '${transfer.status}'`,
      );
    }

    let toEnrollmentId: string | null = null;

    // Se escola de destino foi informada, criar matrícula
    if (transfer.to_school_id) {
      // Buscar ano letivo ativo ou usar o informado
      const academicYearId =
        (transfer.metadata as any)?.to_academic_year_id ||
        (
          await this.supabase
            .from('academic_years')
            .select('id')
            .eq('school_id', transfer.to_school_id)
            .eq('status', 'active')
            .is('deleted_at', null)
            .single()
        ).data?.id;

      if (academicYearId) {
        // Criar perfil na escola de destino se necessário
        const { data: existingProfile } = await this.supabase
          .from('student_school_profiles')
          .select('id')
          .eq('student_id', transfer.student_id)
          .eq('school_id', transfer.to_school_id)
          .is('deleted_at', null)
          .single();

        if (!existingProfile) {
          await this.supabase.from('student_school_profiles').insert({
            tenant_id: transfer.to_tenant_id,
            school_id: transfer.to_school_id,
            student_id: transfer.student_id,
            school_registration_code: dto.school_registration_code,
            status: 'active',
            entered_at: new Date().toISOString().split('T')[0],
            ai_context: {},
            ...this.softDeleteService.getCreateAuditData(userId),
          });
        }

        // Criar perfil no tenant de destino se necessário
        if (transfer.to_tenant_id !== transfer.from_tenant_id) {
          const { data: existingTenantProfile } = await this.supabase
            .from('student_tenant_profiles')
            .select('id')
            .eq('student_id', transfer.student_id)
            .eq('tenant_id', transfer.to_tenant_id)
            .is('deleted_at', null)
            .single();

          if (!existingTenantProfile) {
            await this.supabase.from('student_tenant_profiles').insert({
              tenant_id: transfer.to_tenant_id,
              student_id: transfer.student_id,
              status: 'active',
              notes: `Transferido de ${transfer.from_tenant_id}`,
              ai_context: {},
              ...this.softDeleteService.getCreateAuditData(userId),
            });
          }
        }

        // Criar matrícula no destino
        const { data: newEnrollment, error: enrollmentError } =
          await this.supabase
            .from('enrollments')
            .insert({
              tenant_id: transfer.to_tenant_id,
              school_id: transfer.to_school_id,
              academic_year_id: academicYearId,
              student_id: transfer.student_id,
              enrolled_at: new Date().toISOString().split('T')[0],
              status: 'active',
              notes: `Transferência de ${transfer.from_school_id || transfer.from_tenant_id}`,
              ai_context: { transfer_id: transfer.id },
              ...this.softDeleteService.getCreateAuditData(userId),
            })
            .select()
            .single();

        if (enrollmentError) {
          throw new Error(
            `Failed to create destination enrollment: ${enrollmentError.message}`,
          );
        }

        toEnrollmentId = newEnrollment.id;

        // Criar evento na nova matrícula
        await this.createEnrollmentEvent(
          transfer.to_tenant_id,
          newEnrollment.id,
          'created',
          userId,
          {
            transfer_id: transfer.id,
            from_tenant_id: transfer.from_tenant_id,
            from_school_id: transfer.from_school_id,
          },
        );

        // Atribuir turma se informada
        if (dto.to_class_group_id) {
          await this.supabase.from('enrollment_class_memberships').insert({
            tenant_id: transfer.to_tenant_id,
            enrollment_id: newEnrollment.id,
            class_group_id: dto.to_class_group_id,
            valid_from: new Date().toISOString().split('T')[0],
            reason: 'Transferência',
            created_at: new Date().toISOString(),
            created_by: userId || null,
          });

          await this.createEnrollmentEvent(
            transfer.to_tenant_id,
            newEnrollment.id,
            'class_membership_added',
            userId,
            {
              class_group_id: dto.to_class_group_id,
            },
          );
        }
      }
    }

    // Atualizar matrícula de origem para "transferred"
    if (transfer.from_enrollment_id) {
      await this.supabase
        .from('enrollments')
        .update({
          status: 'transferred',
          left_at: new Date().toISOString().split('T')[0],
          ...this.softDeleteService.getUpdateAuditData(userId),
        })
        .eq('id', transfer.from_enrollment_id);

      // Fechar membership ativa
      await this.supabase
        .from('enrollment_class_memberships')
        .update({
          valid_to: new Date().toISOString().split('T')[0],
        })
        .eq('enrollment_id', transfer.from_enrollment_id)
        .is('valid_to', null)
        .is('deleted_at', null);

      // Criar evento de conclusão na matrícula de origem
      await this.createEnrollmentEvent(
        transfer.from_tenant_id,
        transfer.from_enrollment_id,
        'transfer_completed',
        userId,
        {
          transfer_id: transfer.id,
          to_tenant_id: transfer.to_tenant_id,
          to_school_id: transfer.to_school_id,
          to_enrollment_id: toEnrollmentId,
        },
      );
    }

    // Gerar snapshot do historico academico para a transferencia
    let snapshotId: string | null = null;
    try {
      const snapshot = await this.snapshotsService.generateForTransfer(
        transfer.from_tenant_id,
        transfer.student_id,
        transfer.from_school_id!,
        transfer.id,
        userId,
      );
      snapshotId = snapshot.id;
      this.logger.log('Transfer snapshot generated', 'TransfersService', {
        transferId: id,
        snapshotId: snapshot.id,
      });
    } catch (snapshotError) {
      this.logger.warn(
        'Failed to generate transfer snapshot',
        'TransfersService',
        {
          transferId: id,
          error: (snapshotError as Error).message,
        },
      );
    }

    // Atualizar transferência
    const { data, error } = await this.supabase
      .from('transfer_cases')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        to_enrollment_id: toEnrollmentId,
        metadata: {
          ...transfer.metadata,
          completion_notes: dto.notes,
          snapshot_id: snapshotId,
          ...dto.metadata,
        },
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to complete transfer: ${error.message}`);
    }

    this.logger.log('Transfer completed', 'TransfersService', {
      id,
      toEnrollmentId,
      snapshotId,
    });

    return (await this.findOne(id, tenantId))!;
  }

  async cancel(
    id: string,
    tenantId: string,
    dto: CancelTransferDto,
    userId?: string,
  ): Promise<TransferWithRelations> {
    const transfer = await this.findOne(id, tenantId);
    if (!transfer) {
      throw new NotFoundException(
        `Transferência com id '${id}' não encontrada`,
      );
    }

    // Ambos os tenants podem cancelar
    if (
      transfer.from_tenant_id !== tenantId &&
      transfer.to_tenant_id !== tenantId
    ) {
      throw new ForbiddenException(
        'Você não tem permissão para cancelar esta transferência',
      );
    }

    if (!['requested', 'approved'].includes(transfer.status)) {
      throw new BadRequestException(
        `Não é possível cancelar uma transferência com status '${transfer.status}'`,
      );
    }

    const { data, error } = await this.supabase
      .from('transfer_cases')
      .update({
        status: 'cancelled',
        metadata: {
          ...transfer.metadata,
          cancellation_reason: dto.reason,
          cancelled_by_tenant: tenantId,
          ...dto.metadata,
        },
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to cancel transfer: ${error.message}`);
    }

    this.logger.log('Transfer cancelled', 'TransfersService', {
      id,
      reason: dto.reason,
    });

    return (await this.findOne(id, tenantId))!;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const transfer = await this.findOne(id, tenantId);
    if (!transfer) {
      throw new NotFoundException(
        `Transferência com id '${id}' não encontrada`,
      );
    }

    // Apenas o tenant de origem pode remover
    if (transfer.from_tenant_id !== tenantId) {
      throw new ForbiddenException(
        'Apenas o tenant de origem pode remover a transferência',
      );
    }

    // Não pode remover transferências completadas
    if (transfer.status === 'completed') {
      throw new BadRequestException(
        'Não é possível remover uma transferência concluída',
      );
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'transfer_cases',
      id,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete transfer: ${result.error}`);
    }

    this.logger.log('Transfer deleted', 'TransfersService', { id });
  }
}
