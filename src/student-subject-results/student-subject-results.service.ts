import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { StudentSubjectResult } from '../common/types';
import { CreateStudentSubjectResultDto } from './dto/create-student-subject-result.dto';
import { UpdateStudentSubjectResultDto } from './dto/update-student-subject-result.dto';

@Injectable()
export class StudentSubjectResultsService {
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
      academicYearId?: string;
      enrollmentId?: string;
      subjectId?: string;
      gradingPeriodId?: string;
      resultStatus?: string;
      lockedOnly?: boolean;
    },
  ): Promise<StudentSubjectResult[]> {
    let query = this.supabase
      .from('student_subject_results')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (options?.schoolId) {
      query = query.eq('school_id', options.schoolId);
    }

    if (options?.academicYearId) {
      query = query.eq('academic_year_id', options.academicYearId);
    }

    if (options?.enrollmentId) {
      query = query.eq('enrollment_id', options.enrollmentId);
    }

    if (options?.subjectId) {
      query = query.eq('subject_id', options.subjectId);
    }

    if (options?.gradingPeriodId) {
      query = query.eq('grading_period_id', options.gradingPeriodId);
    }

    if (options?.resultStatus) {
      query = query.eq('result_status', options.resultStatus);
    }

    if (options?.lockedOnly) {
      query = query.eq('locked', true);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to list student subject results: ${error.message}`,
        undefined,
        'StudentSubjectResultsService',
      );
      throw new Error(
        `Failed to list student subject results: ${error.message}`,
      );
    }

    return (data || []) as StudentSubjectResult[];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<StudentSubjectResult | null> {
    const { data, error } = await this.supabase
      .from('student_subject_results')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get student subject result: ${error.message}`);
    }

    return data as StudentSubjectResult;
  }

  async create(
    tenantId: string,
    dto: CreateStudentSubjectResultDto,
    userId?: string,
  ): Promise<StudentSubjectResult> {
    const { data, error } = await this.supabase
      .from('student_subject_results')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id,
        academic_year_id: dto.academic_year_id,
        enrollment_id: dto.enrollment_id,
        subject_id: dto.subject_id,
        grading_period_id: dto.grading_period_id ?? null,
        final_score: dto.final_score ?? null,
        final_concept: dto.final_concept ?? null,
        total_absences: dto.total_absences ?? null,
        result_status: dto.result_status ?? 'in_progress',
        locked: dto.locked ?? false,
        computed_from: dto.computed_from ?? {},
        notes: dto.notes ?? null,
        ai_context: dto.ai_context ?? {},
        ai_summary: dto.ai_summary ?? null,
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          'Já existe um resultado para este aluno nesta disciplina/período',
        );
      }
      this.logger.error(
        `Failed to create student subject result: ${error.message}`,
        undefined,
        'StudentSubjectResultsService',
      );
      throw new Error(
        `Failed to create student subject result: ${error.message}`,
      );
    }

    this.logger.log(
      'Student subject result created',
      'StudentSubjectResultsService',
      {
        id: data.id,
        enrollmentId: dto.enrollment_id,
        subjectId: dto.subject_id,
      },
    );

    return data as StudentSubjectResult;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateStudentSubjectResultDto,
    userId?: string,
  ): Promise<StudentSubjectResult> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Resultado com id '${id}' não encontrado`);
    }

    if (existing.locked) {
      throw new BadRequestException(
        'Este resultado está travado e não pode ser editado',
      );
    }

    const { data, error } = await this.supabase
      .from('student_subject_results')
      .update({
        ...dto,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(
        `Failed to update student subject result: ${error.message}`,
      );
    }

    this.logger.log(
      'Student subject result updated',
      'StudentSubjectResultsService',
      { id },
    );

    return data as StudentSubjectResult;
  }

  async compute(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<StudentSubjectResult> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Resultado com id '${id}' não encontrado`);
    }

    if (existing.locked) {
      throw new BadRequestException(
        'Este resultado está travado e não pode ser recalculado',
      );
    }

    // Buscar notas do aluno para esta disciplina
    const { data: scores, error: scoresError } = await this.supabase
      .from('assessment_scores')
      .select(
        `
        id,
        score,
        status,
        assessments!inner(
          id,
          weight,
          max_score,
          class_group_subject_id,
          class_group_subjects!inner(subject_id)
        )
      `,
      )
      .eq('enrollment_id', existing.enrollment_id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (scoresError) {
      throw new Error(`Failed to fetch scores: ${scoresError.message}`);
    }

    // Buscar faltas do aluno
    const { data: absences, error: absencesError } = await this.supabase
      .from('attendance_records')
      .select(
        `
        id,
        attendance_status,
        attendance_sessions!inner(
          id,
          class_group_subject_id,
          class_group_subjects!inner(subject_id)
        )
      `,
      )
      .eq('enrollment_id', existing.enrollment_id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (absencesError) {
      throw new Error(`Failed to fetch absences: ${absencesError.message}`);
    }

    // Calcular média ponderada
    let totalWeight = 0;
    let weightedSum = 0;
    const scoreDetails: Array<{
      assessmentId: string;
      score: number;
      weight: number;
    }> = [];

    for (const scoreRecord of scores || []) {
      const assessment = scoreRecord.assessments as unknown as Record<
        string,
        unknown
      >;
      const classGroupSubject =
        assessment?.class_group_subjects as unknown as Record<string, unknown>;

      if (
        classGroupSubject?.subject_id === existing.subject_id &&
        scoreRecord.score !== null
      ) {
        const weight = (assessment?.weight as number) || 1;
        const maxScore = (assessment?.max_score as number) || 10;
        const normalizedScore = (scoreRecord.score / maxScore) * 10;

        weightedSum += normalizedScore * weight;
        totalWeight += weight;

        scoreDetails.push({
          assessmentId: assessment?.id as string,
          score: scoreRecord.score,
          weight,
        });
      }
    }

    const finalScore =
      totalWeight > 0
        ? Math.round((weightedSum / totalWeight) * 100) / 100
        : null;

    // Contar faltas
    let totalAbsences = 0;
    for (const absenceRecord of absences || []) {
      const session = absenceRecord.attendance_sessions as unknown as Record<
        string,
        unknown
      >;
      const classGroupSubject =
        session?.class_group_subjects as unknown as Record<string, unknown>;

      if (classGroupSubject?.subject_id === existing.subject_id) {
        if (absenceRecord.attendance_status === 'absent') {
          totalAbsences++;
        }
      }
    }

    // Determinar status do resultado
    let resultStatus: string = 'in_progress';
    if (finalScore !== null) {
      if (finalScore >= 6) {
        resultStatus = 'approved';
      } else if (finalScore >= 4) {
        resultStatus = 'recovery';
      } else {
        resultStatus = 'reproved';
      }
    }

    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('student_subject_results')
      .update({
        final_score: finalScore,
        total_absences: totalAbsences,
        result_status: resultStatus,
        computed_at: now,
        computed_by: userId,
        computed_from: {
          scores: scoreDetails,
          total_absences: totalAbsences,
          computed_at: now,
        },
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(
        `Failed to compute student subject result: ${error.message}`,
      );
    }

    this.logger.log(
      'Student subject result computed',
      'StudentSubjectResultsService',
      {
        id,
        finalScore,
        totalAbsences,
        resultStatus,
      },
    );

    return data as StudentSubjectResult;
  }

  async lock(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<StudentSubjectResult> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Resultado com id '${id}' não encontrado`);
    }

    if (existing.locked) {
      throw new BadRequestException('Este resultado já está travado');
    }

    const { data, error } = await this.supabase
      .from('student_subject_results')
      .update({
        locked: true,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(
        `Failed to lock student subject result: ${error.message}`,
      );
    }

    this.logger.log(
      'Student subject result locked',
      'StudentSubjectResultsService',
      { id },
    );

    return data as StudentSubjectResult;
  }

  async unlock(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<StudentSubjectResult> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Resultado com id '${id}' não encontrado`);
    }

    if (!existing.locked) {
      throw new BadRequestException('Este resultado não está travado');
    }

    const { data, error } = await this.supabase
      .from('student_subject_results')
      .update({
        locked: false,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(
        `Failed to unlock student subject result: ${error.message}`,
      );
    }

    this.logger.log(
      'Student subject result unlocked',
      'StudentSubjectResultsService',
      { id },
    );

    return data as StudentSubjectResult;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Resultado com id '${id}' não encontrado`);
    }

    if (existing.locked) {
      throw new BadRequestException(
        'Não é possível excluir um resultado travado',
      );
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'student_subject_results',
      id,
      userId,
    );

    if (!result.success) {
      throw new Error(
        `Failed to delete student subject result: ${result.error}`,
      );
    }

    this.logger.log(
      'Student subject result deleted',
      'StudentSubjectResultsService',
      { id },
    );
  }
}
