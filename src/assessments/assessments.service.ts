import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { Assessment, AssessmentScore } from '../common/types';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import {
  CreateAssessmentScoreDto,
  BulkScoreItemDto,
} from './dto/create-assessment-score.dto';
import { UpdateAssessmentScoreDto } from './dto/update-assessment-score.dto';

@Injectable()
export class AssessmentsService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
    private softDeleteService: SoftDeleteService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  // ======================
  // Assessments
  // ======================

  async findAll(
    tenantId: string,
    options?: {
      schoolId?: string;
      academicYearId?: string;
      classGroupSubjectId?: string;
      gradingPeriodId?: string;
      publishedOnly?: boolean;
    },
  ): Promise<Assessment[]> {
    let query = this.supabase
      .from('assessments')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('scheduled_on', { ascending: true, nullsFirst: false });

    if (options?.schoolId) {
      query = query.eq('school_id', options.schoolId);
    }

    if (options?.academicYearId) {
      query = query.eq('academic_year_id', options.academicYearId);
    }

    if (options?.classGroupSubjectId) {
      query = query.eq('class_group_subject_id', options.classGroupSubjectId);
    }

    if (options?.gradingPeriodId) {
      query = query.eq('grading_period_id', options.gradingPeriodId);
    }

    if (options?.publishedOnly) {
      query = query.eq('is_published', true);
    }

    const result = await query;

    if (result.error) {
      this.logger.error(
        `Failed to list assessments: ${result.error.message}`,
        undefined,
        'AssessmentsService',
      );
      throw new Error(
        `Failed to list assessments: ${result.error.message}`,
      );
    }

    return (result.data || []) as Assessment[];
  }

  async findOne(id: string, tenantId: string): Promise<Assessment | null> {
    const result = await this.supabase
      .from('assessments')
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
        `Failed to get assessment: ${result.error.message}`,
      );
    }

    return result.data as Assessment;
  }

  async create(
    tenantId: string,
    dto: CreateAssessmentDto,
    userId?: string,
  ): Promise<Assessment> {
    const result = await this.supabase
      .from('assessments')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id,
        academic_year_id: dto.academic_year_id,
        class_group_subject_id: dto.class_group_subject_id,
        grading_period_id: dto.grading_period_id ?? null,
        name: dto.name,
        assessment_type: dto.assessment_type,
        weight: dto.weight ?? 1,
        max_score: dto.max_score ?? 10,
        scheduled_on: dto.scheduled_on ?? null,
        due_on: dto.due_on ?? null,
        is_published: dto.is_published ?? false,
        description: dto.description ?? null,
        settings: dto.settings ?? {},
        ai_context: dto.ai_context ?? {},
        ai_summary: dto.ai_summary ?? null,
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (result.error) {
      this.logger.error(
        `Failed to create assessment: ${result.error.message}`,
        undefined,
        'AssessmentsService',
      );
      throw new Error(
        `Failed to create assessment: ${result.error.message}`,
      );
    }

    const assessment = result.data as Assessment;
    this.logger.log('Assessment created', 'AssessmentsService', {
      id: assessment.id,
      name: dto.name,
    });

    return assessment;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateAssessmentDto,
    userId?: string,
  ): Promise<Assessment> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Avaliação com id '${id}' não encontrada`);
    }

    const result = await this.supabase
      .from('assessments')
      .update({
        ...dto,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (result.error) {
      throw new Error(
        `Failed to update assessment: ${result.error.message}`,
      );
    }

    this.logger.log('Assessment updated', 'AssessmentsService', { id });

    return result.data as Assessment;
  }

  async publish(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<Assessment> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Avaliação com id '${id}' não encontrada`);
    }

    if (existing.is_published) {
      throw new BadRequestException('Esta avaliação já está publicada');
    }

    const result = await this.supabase
      .from('assessments')
      .update({
        is_published: true,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (result.error) {
      throw new Error(
        `Failed to publish assessment: ${result.error.message}`,
      );
    }

    this.logger.log('Assessment published', 'AssessmentsService', { id });

    return result.data as Assessment;
  }

  async unpublish(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<Assessment> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Avaliação com id '${id}' não encontrada`);
    }

    if (!existing.is_published) {
      throw new BadRequestException('Esta avaliação não está publicada');
    }

    const result = await this.supabase
      .from('assessments')
      .update({
        is_published: false,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (result.error) {
      throw new Error(
        `Failed to unpublish assessment: ${result.error.message}`,
      );
    }

    this.logger.log('Assessment unpublished', 'AssessmentsService', { id });

    return result.data as Assessment;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Avaliação com id '${id}' não encontrada`);
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'assessments',
      id,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete assessment: ${result.error}`);
    }

    this.logger.log('Assessment deleted', 'AssessmentsService', { id });
  }

  // ======================
  // Assessment Scores
  // ======================

  async findScores(
    assessmentId: string,
    tenantId: string,
  ): Promise<AssessmentScore[]> {
    const result = await this.supabase
      .from('assessment_scores')
      .select('*')
      .eq('assessment_id', assessmentId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (result.error) {
      throw new Error(
        `Failed to list assessment scores: ${result.error.message}`,
      );
    }

    return (result.data || []) as AssessmentScore[];
  }

  async findScoreOne(
    scoreId: string,
    tenantId: string,
  ): Promise<AssessmentScore | null> {
    const result = await this.supabase
      .from('assessment_scores')
      .select('*')
      .eq('id', scoreId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (result.error) {
      if (result.error.code === 'PGRST116') {
        return null;
      }
      throw new Error(
        `Failed to get assessment score: ${result.error.message}`,
      );
    }

    return result.data as AssessmentScore;
  }

  async createScore(
    assessmentId: string,
    tenantId: string,
    dto: CreateAssessmentScoreDto,
    userId?: string,
  ): Promise<AssessmentScore> {
    const assessment = await this.findOne(assessmentId, tenantId);
    if (!assessment) {
      throw new NotFoundException(
        `Avaliação com id '${assessmentId}' não encontrada`,
      );
    }

    // Validar score contra max_score
    if (dto.score !== undefined && dto.score > assessment.max_score) {
      throw new BadRequestException(
        `A nota não pode ser maior que ${assessment.max_score}`,
      );
    }

    const result = await this.supabase
      .from('assessment_scores')
      .insert({
        tenant_id: tenantId,
        assessment_id: assessmentId,
        enrollment_id: dto.enrollment_id,
        score: dto.score ?? null,
        status: dto.status ?? (dto.score !== undefined ? 'graded' : 'pending'),
        attempt_number: dto.attempt_number ?? 1,
        submitted_at: dto.submitted_at ?? null,
        graded_at:
          dto.graded_at ??
          (dto.score !== undefined ? new Date().toISOString() : null),
        graded_by_staff_school_profile_id:
          dto.graded_by_staff_school_profile_id ?? null,
        notes: dto.notes ?? null,
        metadata: dto.metadata ?? {},
        created_by: userId ?? null,
        updated_by: userId ?? null,
      })
      .select()
      .single();

    if (result.error) {
      if (result.error.code === '23505') {
        throw new ConflictException(
          'Já existe uma nota para este aluno nesta avaliação',
        );
      }
      this.logger.error(
        `Failed to create assessment score: ${result.error.message}`,
        undefined,
        'AssessmentsService',
      );
      throw new Error(
        `Failed to create assessment score: ${result.error.message}`,
      );
    }

    this.logger.log('Assessment score created', 'AssessmentsService', {
      assessmentId,
      enrollmentId: dto.enrollment_id,
    });

    return result.data as AssessmentScore;
  }

  async updateScore(
    scoreId: string,
    tenantId: string,
    dto: UpdateAssessmentScoreDto,
    userId?: string,
  ): Promise<AssessmentScore> {
    const existing = await this.findScoreOne(scoreId, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `Assessment score com id '${scoreId}' não encontrada`,
      );
    }

    // Se está atualizando a nota, validar contra max_score
    if (dto.score !== undefined) {
      const assessment = await this.findOne(existing.assessment_id, tenantId);
      if (assessment && dto.score > assessment.max_score) {
        throw new BadRequestException(
          `A nota não pode ser maior que ${assessment.max_score}`,
        );
      }
    }

    const updateData: Record<string, unknown> = { ...dto };

    // Se a nota foi definida e status não foi especificado, marcar como graded
    if (dto.score !== undefined && !dto.status) {
      updateData.status = 'graded';
      updateData.graded_at = new Date().toISOString();
    }

    const result = await this.supabase
      .from('assessment_scores')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
        updated_by: userId ?? null,
      })
      .eq('id', scoreId)
      .select()
      .single();

    if (result.error) {
      throw new Error(
        `Failed to update assessment score: ${result.error.message}`,
      );
    }

    this.logger.log('Assessment score updated', 'AssessmentsService', {
      id: scoreId,
    });

    return result.data as AssessmentScore;
  }

  async createScoresBulk(
    assessmentId: string,
    tenantId: string,
    scores: BulkScoreItemDto[],
    userId?: string,
  ): Promise<AssessmentScore[]> {
    const assessment = await this.findOne(assessmentId, tenantId);
    if (!assessment) {
      throw new NotFoundException(
        `Avaliação com id '${assessmentId}' não encontrada`,
      );
    }

    // Validar todas as notas
    for (const score of scores) {
      if (score.score !== undefined && score.score > assessment.max_score) {
        throw new BadRequestException(
          `A nota para enrollment ${score.enrollment_id} não pode ser maior que ${assessment.max_score}`,
        );
      }
    }

    const now = new Date().toISOString();
    const insertData = scores.map((score) => ({
      tenant_id: tenantId,
      assessment_id: assessmentId,
      enrollment_id: score.enrollment_id,
      score: score.score ?? null,
      status:
        score.status ?? (score.score !== undefined ? 'graded' : 'pending'),
      attempt_number: 1,
      graded_at: score.score !== undefined ? now : null,
      notes: score.notes ?? null,
      metadata: {},
      created_at: now,
      updated_at: now,
      created_by: userId ?? null,
      updated_by: userId ?? null,
    }));

    const result = await this.supabase
      .from('assessment_scores')
      .upsert(insertData, {
        onConflict: 'assessment_id,enrollment_id,attempt_number',
        ignoreDuplicates: false,
      })
      .select();

    if (result.error) {
      this.logger.error(
        `Failed to bulk create assessment scores: ${result.error.message}`,
        undefined,
        'AssessmentsService',
      );
      throw new Error(
        `Failed to bulk create assessment scores: ${result.error.message}`,
      );
    }

    this.logger.log('Assessment scores created in bulk', 'AssessmentsService', {
      assessmentId,
      count: scores.length,
    });

    return (result.data || []) as AssessmentScore[];
  }

  async removeScore(
    scoreId: string,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const existing = await this.findScoreOne(scoreId, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `Assessment score com id '${scoreId}' não encontrada`,
      );
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'assessment_scores',
      scoreId,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete assessment score: ${result.error}`);
    }

    this.logger.log('Assessment score deleted', 'AssessmentsService', {
      id: scoreId,
    });
  }
}
