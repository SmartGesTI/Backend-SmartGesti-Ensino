import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import {
  AcademicRecordSnapshot,
  AcademicRecordSnapshotWithRelations,
} from '../common/types';
import {
  GenerateSnapshotDto,
  FinalizeSnapshotDto,
  RevokeSnapshotDto,
} from './dto/create-snapshot.dto';

const PAYLOAD_SCHEMA_VERSION = 1;
const HASH_ALGO = 'sha256';
const HASH_ENCODING = 'hex';

@Injectable()
export class AcademicRecordSnapshotsService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
    private softDeleteService: SoftDeleteService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  // ============================================
  // Helpers
  // ============================================

  private calculateHash(payload: Record<string, unknown>): string {
    const serialized = JSON.stringify(payload, Object.keys(payload).sort());
    return createHash(HASH_ALGO).update(serialized).digest(HASH_ENCODING);
  }

  // ============================================
  // CRUD
  // ============================================

  async findAll(
    tenantId: string,
    options?: {
      studentId?: string;
      kind?: string;
      status?: string;
      academicYearId?: string;
      isFinal?: boolean;
    },
  ): Promise<AcademicRecordSnapshot[]> {
    let query = this.supabase
      .from('academic_record_snapshots')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (options?.studentId) {
      query = query.eq('student_id', options.studentId);
    }

    if (options?.kind) {
      query = query.eq('kind', options.kind);
    }

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.academicYearId) {
      query = query.eq('academic_year_id', options.academicYearId);
    }

    if (options?.isFinal !== undefined) {
      query = query.eq('is_final', options.isFinal);
    }

    const result = await query;

    if (result.error) {
      this.logger.error(
        `Failed to list snapshots: ${result.error.message}`,
        undefined,
        'AcademicRecordSnapshotsService',
      );
      throw new Error(`Failed to list snapshots: ${result.error.message}`);
    }

    return (result.data || []) as AcademicRecordSnapshot[];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<AcademicRecordSnapshotWithRelations | null> {
    const result = await this.supabase
      .from('academic_record_snapshots')
      .select(
        `
        *,
        students(*, persons(*)),
        academic_years(*)
      `,
      )
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (result.error) {
      if (result.error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get snapshot: ${result.error.message}`);
    }

    const data = result.data as AcademicRecordSnapshot & {
      students?: unknown;
      academic_years?: unknown;
    };

    return {
      ...data,
      student: data.students as AcademicRecordSnapshotWithRelations['student'],
      academic_year:
        data.academic_years as AcademicRecordSnapshotWithRelations['academic_year'],
    } as AcademicRecordSnapshotWithRelations;
  }

  async findByStudent(
    studentId: string,
    tenantId: string,
  ): Promise<AcademicRecordSnapshot[]> {
    return this.findAll(tenantId, { studentId });
  }

  // ============================================
  // Generate Snapshot
  // ============================================

  async generate(
    tenantId: string,
    dto: GenerateSnapshotDto,
    userId?: string,
  ): Promise<AcademicRecordSnapshot> {
    // Validar que kind=academic_year requer academic_year_id
    if (dto.kind === 'academic_year' && !dto.academic_year_id) {
      throw new BadRequestException(
        'academic_year_id é obrigatório para snapshots do tipo academic_year',
      );
    }

    // Buscar dados do aluno
    const payload = await this.aggregateStudentData(
      tenantId,
      dto.student_id,
      dto.school_id,
      dto.academic_year_id,
      {
        includeAssessments: dto.include_assessments ?? true,
        includeAttendance: dto.include_attendance ?? true,
        includeResults: dto.include_results ?? true,
      },
    );

    // Calcular hash
    const payloadHash = this.calculateHash(payload);

    // Buscar última versão para este aluno/kind
    const lastSnapshotResult = await this.supabase
      .from('academic_record_snapshots')
      .select('version')
      .eq('tenant_id', tenantId)
      .eq('student_id', dto.student_id)
      .eq('kind', dto.kind)
      .is('deleted_at', null)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    const lastSnapshot = lastSnapshotResult.data as { version: number } | null;
    const nextVersion = (lastSnapshot?.version || 0) + 1;

    const now = new Date().toISOString();

    const result = await this.supabase
      .from('academic_record_snapshots')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id ?? null,
        student_id: dto.student_id,
        kind: dto.kind,
        academic_year_id: dto.academic_year_id ?? null,
        as_of_at: now,
        version: nextVersion,
        is_final: false,
        status: 'active',
        payload,
        payload_schema_version: PAYLOAD_SCHEMA_VERSION,
        payload_hash: payloadHash,
        hash_algo: HASH_ALGO,
        hash_encoding: HASH_ENCODING,
        source_type: 'manual',
        notes: dto.notes ?? null,
        metadata: {},
        ai_context: dto.ai_context ?? {},
        ai_summary: dto.ai_summary ?? null,
        created_at: now,
        created_by: userId ?? null,
      })
      .select()
      .single();

    if (result.error) {
      this.logger.error(
        `Failed to generate snapshot: ${result.error.message}`,
        undefined,
        'AcademicRecordSnapshotsService',
      );
      throw new Error(`Failed to generate snapshot: ${result.error.message}`);
    }

    const snapshot = result.data as AcademicRecordSnapshot;
    this.logger.log('Snapshot generated', 'AcademicRecordSnapshotsService', {
      id: snapshot.id,
      studentId: dto.student_id,
      kind: dto.kind,
      version: nextVersion,
    });

    return snapshot;
  }

  private async aggregateStudentData(
    tenantId: string,
    studentId: string,
    schoolId?: string,
    academicYearId?: string,
    options: {
      includeAssessments: boolean;
      includeAttendance: boolean;
      includeResults: boolean;
    } = {
      includeAssessments: true,
      includeAttendance: true,
      includeResults: true,
    },
  ): Promise<Record<string, unknown>> {
    // Buscar dados básicos do aluno
    const studentResult = await this.supabase
      .from('students')
      .select('*, persons(*)')
      .eq('id', studentId)
      .is('deleted_at', null)
      .single();

    if (!studentResult.data) {
      throw new NotFoundException(`Aluno com id '${studentId}' não encontrado`);
    }

    const student = studentResult.data as {
      id: string;
      global_status: string;
      persons?: {
        full_name?: string;
        preferred_name?: string;
        birth_date?: string;
        sex?: string;
      };
    };

    // Buscar enrollments
    let enrollmentsQuery = this.supabase
      .from('enrollments')
      .select(
        `
        *,
        class_groups(*, grade_levels(*), shifts(*)),
        academic_years(*)
      `,
      )
      .eq('student_id', studentId)
      .is('deleted_at', null);

    if (schoolId) {
      enrollmentsQuery = enrollmentsQuery.eq('school_id', schoolId);
    }

    if (academicYearId) {
      enrollmentsQuery = enrollmentsQuery.eq(
        'academic_year_id',
        academicYearId,
      );
    }

    const enrollmentsResult = await enrollmentsQuery;
    const enrollments = (enrollmentsResult.data || []) as Array<{
      id: string;
      status: string;
      entry_date: string;
      exit_date: string | null;
      academic_years?: {
        id: string;
        name: string;
        start_date: string;
        end_date: string;
      };
      class_groups?: {
        id: string;
        name: string;
        grade_levels?: { name: string };
        shifts?: { name: string };
      };
    }>;

    const payload: Record<string, unknown> = {
      schema_version: PAYLOAD_SCHEMA_VERSION,
      generated_at: new Date().toISOString(),
      student: {
        id: student.id,
        person: {
          full_name: student.persons?.full_name,
          preferred_name: student.persons?.preferred_name,
          birth_date: student.persons?.birth_date,
          sex: student.persons?.sex,
        },
        global_status: student.global_status,
      },
      enrollments: enrollments.map((e) => ({
        id: e.id,
        status: e.status,
        entry_date: e.entry_date,
        exit_date: e.exit_date,
        academic_year: e.academic_years
          ? {
              id: e.academic_years.id,
              name: e.academic_years.name,
              start_date: e.academic_years.start_date,
              end_date: e.academic_years.end_date,
            }
          : null,
        class_group: e.class_groups
          ? {
              id: e.class_groups.id,
              name: e.class_groups.name,
              grade_level: e.class_groups.grade_levels?.name,
              shift: e.class_groups.shifts?.name,
            }
          : null,
      })),
    };

    // Incluir assessments/scores se solicitado
    if (options.includeAssessments && enrollments.length) {
      const enrollmentIds = enrollments.map((e) => e.id);

      const scoresResult = await this.supabase
        .from('assessment_scores')
        .select(
          `
          *,
          assessments(*, class_group_subjects(*, subjects(*)))
        `,
        )
        .in('enrollment_id', enrollmentIds)
        .is('deleted_at', null);

      const scores = (scoresResult.data || []) as Array<{
        id: string;
        score: number;
        status: string;
        assessments?: {
          id: string;
          name: string;
          assessment_type: string;
          max_score: number;
          weight: number;
          class_group_subjects?: {
            subjects?: { name: string };
          };
        };
      }>;

      payload.assessment_scores = scores.map((s) => ({
        id: s.id,
        score: s.score,
        status: s.status,
        assessment: s.assessments
          ? {
              id: s.assessments.id,
              name: s.assessments.name,
              type: s.assessments.assessment_type,
              max_score: s.assessments.max_score,
              weight: s.assessments.weight,
              subject: s.assessments.class_group_subjects?.subjects?.name,
            }
          : null,
      }));
    }

    // Incluir attendance se solicitado
    if (options.includeAttendance && enrollments.length) {
      const enrollmentIds = enrollments.map((e) => e.id);

      const recordsResult = await this.supabase
        .from('attendance_records')
        .select(
          `
          *,
          attendance_sessions(*)
        `,
        )
        .in('enrollment_id', enrollmentIds)
        .is('deleted_at', null);

      const records = (recordsResult.data || []) as Array<{
        id: string;
        status: string;
        minutes_present: number;
        attendance_sessions?: { session_date: string };
      }>;

      payload.attendance_records = records.map((r) => ({
        id: r.id,
        status: r.status,
        minutes_present: r.minutes_present,
        session_date: r.attendance_sessions?.session_date,
      }));
    }

    // Incluir results se solicitado
    if (options.includeResults && enrollments.length) {
      const enrollmentIds = enrollments.map((e) => e.id);

      const resultsResult = await this.supabase
        .from('student_subject_results')
        .select(
          `
          *,
          class_group_subjects(*, subjects(*)),
          grading_periods(*)
        `,
        )
        .in('enrollment_id', enrollmentIds)
        .is('deleted_at', null);

      const results = (resultsResult.data || []) as Array<{
        id: string;
        final_score: number;
        total_absences: number;
        result_status: string;
        is_locked: boolean;
        class_group_subjects?: {
          subjects?: { name: string };
        };
        grading_periods?: { name: string };
      }>;

      payload.subject_results = results.map((r) => ({
        id: r.id,
        final_score: r.final_score,
        total_absences: r.total_absences,
        result_status: r.result_status,
        is_locked: r.is_locked,
        subject: r.class_group_subjects?.subjects?.name,
        grading_period: r.grading_periods?.name,
      }));
    }

    return payload;
  }

  // ============================================
  // Actions
  // ============================================

  async finalize(
    id: string,
    tenantId: string,
    dto: FinalizeSnapshotDto,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userId: string,
  ): Promise<AcademicRecordSnapshot> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Snapshot com id '${id}' não encontrado`);
    }

    if (existing.is_final) {
      throw new BadRequestException('Este snapshot já está finalizado');
    }

    if (existing.status === 'revoked') {
      throw new BadRequestException(
        'Não é possível finalizar um snapshot revogado',
      );
    }

    // Superseder versões anteriores do mesmo tipo
    await this.supabase
      .from('academic_record_snapshots')
      .update({ status: 'superseded' })
      .eq('tenant_id', tenantId)
      .eq('student_id', existing.student_id)
      .eq('kind', existing.kind)
      .eq('status', 'active')
      .neq('id', id)
      .is('deleted_at', null);

    const result = await this.supabase
      .from('academic_record_snapshots')
      .update({
        is_final: true,
        notes: dto.notes ?? existing.notes,
      })
      .eq('id', id)
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to finalize snapshot: ${result.error.message}`);
    }

    this.logger.log('Snapshot finalized', 'AcademicRecordSnapshotsService', {
      id,
    });

    return result.data as AcademicRecordSnapshot;
  }

  async revoke(
    id: string,
    tenantId: string,
    dto: RevokeSnapshotDto,
    userId: string,
  ): Promise<AcademicRecordSnapshot> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Snapshot com id '${id}' não encontrado`);
    }

    if (existing.status === 'revoked') {
      throw new BadRequestException('Este snapshot já está revogado');
    }

    const now = new Date().toISOString();

    const result = await this.supabase
      .from('academic_record_snapshots')
      .update({
        status: 'revoked',
        revoked_at: now,
        revoked_by: userId,
        revoke_reason: dto.reason,
      })
      .eq('id', id)
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to revoke snapshot: ${result.error.message}`);
    }

    this.logger.log('Snapshot revoked', 'AcademicRecordSnapshotsService', {
      id,
      reason: dto.reason,
    });

    return result.data as AcademicRecordSnapshot;
  }

  async verify(
    id: string,
    tenantId: string,
  ): Promise<{ valid: boolean; computed_hash: string; stored_hash: string }> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Snapshot com id '${id}' não encontrado`);
    }

    const computedHash = this.calculateHash(existing.payload);
    const valid = computedHash === existing.payload_hash;

    if (!valid) {
      this.logger.warn(
        'Snapshot integrity check failed',
        'AcademicRecordSnapshotsService',
        {
          id,
          computedHash,
          storedHash: existing.payload_hash,
        },
      );
    }

    return {
      valid,
      computed_hash: computedHash,
      stored_hash: existing.payload_hash,
    };
  }

  // ============================================
  // Generate for Transfer
  // ============================================

  async generateForTransfer(
    tenantId: string,
    studentId: string,
    schoolId: string,
    transferCaseId: string,
    userId?: string,
  ): Promise<AcademicRecordSnapshot> {
    // Agregar todos os dados
    const payload = await this.aggregateStudentData(
      tenantId,
      studentId,
      schoolId,
      undefined,
      {
        includeAssessments: true,
        includeAttendance: true,
        includeResults: true,
      },
    );

    const payloadHash = this.calculateHash(payload);

    // Buscar última versão
    const lastSnapshotResult = await this.supabase
      .from('academic_record_snapshots')
      .select('version')
      .eq('tenant_id', tenantId)
      .eq('student_id', studentId)
      .eq('kind', 'transfer_packet')
      .is('deleted_at', null)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    const lastSnapshot = lastSnapshotResult.data as { version: number } | null;
    const nextVersion = (lastSnapshot?.version || 0) + 1;
    const now = new Date().toISOString();

    const result = await this.supabase
      .from('academic_record_snapshots')
      .insert({
        tenant_id: tenantId,
        school_id: schoolId,
        student_id: studentId,
        kind: 'transfer_packet',
        as_of_at: now,
        version: nextVersion,
        is_final: true,
        status: 'active',
        payload,
        payload_schema_version: PAYLOAD_SCHEMA_VERSION,
        payload_hash: payloadHash,
        hash_algo: HASH_ALGO,
        hash_encoding: HASH_ENCODING,
        source_type: 'transfer',
        source_transfer_case_id: transferCaseId,
        notes: 'Gerado automaticamente para transferência',
        metadata: {},
        ai_context: {},
        created_at: now,
        created_by: userId ?? null,
      })
      .select()
      .single();

    if (result.error) {
      throw new Error(
        `Failed to generate transfer snapshot: ${result.error.message}`,
      );
    }

    const snapshot = result.data as AcademicRecordSnapshot;
    this.logger.log(
      'Transfer snapshot generated',
      'AcademicRecordSnapshotsService',
      {
        id: snapshot.id,
        studentId,
        transferCaseId,
      },
    );

    return snapshot;
  }
}
