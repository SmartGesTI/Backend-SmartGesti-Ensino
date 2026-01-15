import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { AttendanceSession, AttendanceRecord } from '../common/types';
import { CreateAttendanceSessionDto } from './dto/create-attendance-session.dto';
import { UpdateAttendanceSessionDto } from './dto/update-attendance-session.dto';
import {
  CreateAttendanceRecordDto,
  BulkRecordItemDto,
} from './dto/create-attendance-record.dto';
import { UpdateAttendanceRecordDto } from './dto/update-attendance-record.dto';

@Injectable()
export class AttendanceSessionsService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
    private softDeleteService: SoftDeleteService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  // ======================
  // Attendance Sessions
  // ======================

  async findAll(
    tenantId: string,
    options?: {
      schoolId?: string;
      academicYearId?: string;
      classGroupId?: string;
      classGroupSubjectId?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
    },
  ): Promise<AttendanceSession[]> {
    let query = this.supabase
      .from('attendance_sessions')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('occurred_on', { ascending: false });

    if (options?.schoolId) {
      query = query.eq('school_id', options.schoolId);
    }

    if (options?.academicYearId) {
      query = query.eq('academic_year_id', options.academicYearId);
    }

    if (options?.classGroupId) {
      query = query.eq('class_group_id', options.classGroupId);
    }

    if (options?.classGroupSubjectId) {
      query = query.eq('class_group_subject_id', options.classGroupSubjectId);
    }

    if (options?.startDate) {
      query = query.gte('occurred_on', options.startDate);
    }

    if (options?.endDate) {
      query = query.lte('occurred_on', options.endDate);
    }

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const result = await query;

    if (result.error) {
      this.logger.error(
        `Failed to list attendance sessions: ${result.error.message}`,
        undefined,
        'AttendanceSessionsService',
      );
      throw new Error(
        `Failed to list attendance sessions: ${result.error.message}`,
      );
    }

    return (result.data || []) as AttendanceSession[];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<AttendanceSession | null> {
    const result = await this.supabase
      .from('attendance_sessions')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (result.error) {
      if (result.error.code === 'PGRST116') {
        return null;
      }
      throw new Error(
        `Failed to get attendance session: ${result.error.message}`,
      );
    }

    return result.data as AttendanceSession;
  }

  async create(
    tenantId: string,
    dto: CreateAttendanceSessionDto,
    userId?: string,
  ): Promise<AttendanceSession> {
    const result = await this.supabase
      .from('attendance_sessions')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id,
        academic_year_id: dto.academic_year_id,
        class_group_id: dto.class_group_id,
        class_group_subject_id: dto.class_group_subject_id,
        occurred_on: dto.occurred_on,
        time_slot_id: dto.time_slot_id ?? null,
        conducted_by_staff_school_profile_id:
          dto.conducted_by_staff_school_profile_id ?? null,
        status: dto.status ?? 'open',
        notes: dto.notes ?? null,
        metadata: dto.metadata ?? {},
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (result.error) {
      this.logger.error(
        `Failed to create attendance session: ${result.error.message}`,
        undefined,
        'AttendanceSessionsService',
      );
      throw new Error(
        `Failed to create attendance session: ${result.error.message}`,
      );
    }

    const session = result.data as AttendanceSession;
    this.logger.log('Attendance session created', 'AttendanceSessionsService', {
      id: session.id,
      occurredOn: dto.occurred_on,
    });

    return session;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateAttendanceSessionDto,
    userId?: string,
  ): Promise<AttendanceSession> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `Sessão de chamada com id '${id}' não encontrada`,
      );
    }

    if (existing.status === 'closed') {
      throw new BadRequestException(
        'Não é possível editar uma chamada fechada',
      );
    }

    const result = await this.supabase
      .from('attendance_sessions')
      .update({
        ...dto,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (result.error) {
      throw new Error(
        `Failed to update attendance session: ${result.error.message}`,
      );
    }

    this.logger.log('Attendance session updated', 'AttendanceSessionsService', {
      id,
    });

    return result.data as AttendanceSession;
  }

  async close(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<AttendanceSession> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `Sessão de chamada com id '${id}' não encontrada`,
      );
    }

    if (existing.status === 'closed') {
      throw new BadRequestException('Esta chamada já está fechada');
    }

    if (existing.status === 'cancelled') {
      throw new BadRequestException(
        'Não é possível fechar uma chamada cancelada',
      );
    }

    const result = await this.supabase
      .from('attendance_sessions')
      .update({
        status: 'closed',
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (result.error) {
      throw new Error(
        `Failed to close attendance session: ${result.error.message}`,
      );
    }

    this.logger.log('Attendance session closed', 'AttendanceSessionsService', {
      id,
    });

    return result.data as AttendanceSession;
  }

  async reopen(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<AttendanceSession> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `Sessão de chamada com id '${id}' não encontrada`,
      );
    }

    if (existing.status !== 'closed') {
      throw new BadRequestException('Esta chamada não está fechada');
    }

    const result = await this.supabase
      .from('attendance_sessions')
      .update({
        status: 'open',
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (result.error) {
      throw new Error(
        `Failed to reopen attendance session: ${result.error.message}`,
      );
    }

    this.logger.log(
      'Attendance session reopened',
      'AttendanceSessionsService',
      { id },
    );

    return result.data as AttendanceSession;
  }

  async cancel(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<AttendanceSession> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `Sessão de chamada com id '${id}' não encontrada`,
      );
    }

    if (existing.status === 'cancelled') {
      throw new BadRequestException('Esta chamada já está cancelada');
    }

    const result = await this.supabase
      .from('attendance_sessions')
      .update({
        status: 'cancelled',
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (result.error) {
      throw new Error(
        `Failed to cancel attendance session: ${result.error.message}`,
      );
    }

    this.logger.log(
      'Attendance session cancelled',
      'AttendanceSessionsService',
      { id },
    );

    return result.data as AttendanceSession;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `Sessão de chamada com id '${id}' não encontrada`,
      );
    }

    if (existing.status === 'closed') {
      throw new BadRequestException(
        'Não é possível excluir uma chamada fechada',
      );
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'attendance_sessions',
      id,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete attendance session: ${result.error}`);
    }

    this.logger.log('Attendance session deleted', 'AttendanceSessionsService', {
      id,
    });
  }

  // ======================
  // Attendance Records
  // ======================

  async findRecords(
    sessionId: string,
    tenantId: string,
  ): Promise<AttendanceRecord[]> {
    const result = await this.supabase
      .from('attendance_records')
      .select('*')
      .eq('attendance_session_id', sessionId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (result.error) {
      throw new Error(
        `Failed to list attendance records: ${result.error.message}`,
      );
    }

    return (result.data || []) as AttendanceRecord[];
  }

  async findRecordOne(
    recordId: string,
    tenantId: string,
  ): Promise<AttendanceRecord | null> {
    const result = await this.supabase
      .from('attendance_records')
      .select('*')
      .eq('id', recordId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (result.error) {
      if (result.error.code === 'PGRST116') {
        return null;
      }
      throw new Error(
        `Failed to get attendance record: ${result.error.message}`,
      );
    }

    return result.data as AttendanceRecord;
  }

  async createRecord(
    sessionId: string,
    tenantId: string,
    dto: CreateAttendanceRecordDto,
    userId?: string,
  ): Promise<AttendanceRecord> {
    const session = await this.findOne(sessionId, tenantId);
    if (!session) {
      throw new NotFoundException(
        `Sessão de chamada com id '${sessionId}' não encontrada`,
      );
    }

    if (session.status === 'closed') {
      throw new BadRequestException(
        'Não é possível adicionar presenças a uma chamada fechada',
      );
    }

    const now = new Date().toISOString();

    const result = await this.supabase
      .from('attendance_records')
      .insert({
        tenant_id: tenantId,
        attendance_session_id: sessionId,
        enrollment_id: dto.enrollment_id,
        attendance_status: dto.attendance_status,
        minutes_late: dto.minutes_late ?? null,
        justification: dto.justification ?? null,
        recorded_at: now,
        recorded_by: userId ?? null,
        metadata: dto.metadata ?? {},
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (result.error) {
      if (result.error.code === '23505') {
        throw new ConflictException(
          'Já existe registro de presença para este aluno nesta chamada',
        );
      }
      this.logger.error(
        `Failed to create attendance record: ${result.error.message}`,
        undefined,
        'AttendanceSessionsService',
      );
      throw new Error(
        `Failed to create attendance record: ${result.error.message}`,
      );
    }

    this.logger.log('Attendance record created', 'AttendanceSessionsService', {
      sessionId,
      enrollmentId: dto.enrollment_id,
    });

    return result.data as AttendanceRecord;
  }

  async updateRecord(
    recordId: string,
    tenantId: string,
    dto: UpdateAttendanceRecordDto,
    userId?: string,
  ): Promise<AttendanceRecord> {
    const existing = await this.findRecordOne(recordId, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `Attendance record com id '${recordId}' não encontrado`,
      );
    }

    // Verificar se a sessão não está fechada
    const session = await this.findOne(
      existing.attendance_session_id,
      tenantId,
    );
    if (session && session.status === 'closed') {
      throw new BadRequestException(
        'Não é possível editar presenças de uma chamada fechada',
      );
    }

    const result = await this.supabase
      .from('attendance_records')
      .update({
        ...dto,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordId)
      .select()
      .single();

    if (result.error) {
      throw new Error(
        `Failed to update attendance record: ${result.error.message}`,
      );
    }

    this.logger.log('Attendance record updated', 'AttendanceSessionsService', {
      id: recordId,
    });

    return result.data as AttendanceRecord;
  }

  async createRecordsBulk(
    sessionId: string,
    tenantId: string,
    records: BulkRecordItemDto[],
    userId?: string,
  ): Promise<AttendanceRecord[]> {
    const session = await this.findOne(sessionId, tenantId);
    if (!session) {
      throw new NotFoundException(
        `Sessão de chamada com id '${sessionId}' não encontrada`,
      );
    }

    if (session.status === 'closed') {
      throw new BadRequestException(
        'Não é possível adicionar presenças a uma chamada fechada',
      );
    }

    const now = new Date().toISOString();
    const insertData = records.map((record) => ({
      tenant_id: tenantId,
      attendance_session_id: sessionId,
      enrollment_id: record.enrollment_id,
      attendance_status: record.attendance_status,
      minutes_late: record.minutes_late ?? null,
      justification: record.justification ?? null,
      recorded_at: now,
      recorded_by: userId ?? null,
      metadata: {},
      created_at: now,
      updated_at: now,
    }));

    const result = await this.supabase
      .from('attendance_records')
      .upsert(insertData, {
        onConflict: 'attendance_session_id,enrollment_id',
        ignoreDuplicates: false,
      })
      .select();

    if (result.error) {
      this.logger.error(
        `Failed to bulk create attendance records: ${result.error.message}`,
        undefined,
        'AttendanceSessionsService',
      );
      throw new Error(
        `Failed to bulk create attendance records: ${result.error.message}`,
      );
    }

    this.logger.log(
      'Attendance records created in bulk',
      'AttendanceSessionsService',
      {
        sessionId,
        count: records.length,
      },
    );

    return (result.data || []) as AttendanceRecord[];
  }

  async removeRecord(
    recordId: string,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const existing = await this.findRecordOne(recordId, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `Attendance record com id '${recordId}' não encontrado`,
      );
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'attendance_records',
      recordId,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete attendance record: ${result.error}`);
    }

    this.logger.log('Attendance record deleted', 'AttendanceSessionsService', {
      id: recordId,
    });
  }
}
