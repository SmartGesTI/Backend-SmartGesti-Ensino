import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { Curriculum, CurriculumSubject } from '../common/types';
import { CreateCurriculumDto } from './dto/create-curriculum.dto';
import { UpdateCurriculumDto } from './dto/update-curriculum.dto';
import { CreateCurriculumSubjectDto } from './dto/create-curriculum-subject.dto';
import { UpdateCurriculumSubjectDto } from './dto/update-curriculum-subject.dto';

@Injectable()
export class CurriculumService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
    private softDeleteService: SoftDeleteService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  // ======================
  // Curriculum
  // ======================

  async findAll(
    tenantId: string,
    options?: {
      schoolId?: string;
      academicYearId?: string;
      gradeLevelId?: string;
      status?: string;
    },
  ): Promise<Curriculum[]> {
    let query = this.supabase
      .from('curriculum')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('version', { ascending: false });

    if (options?.schoolId) {
      query = query.eq('school_id', options.schoolId);
    }

    if (options?.academicYearId) {
      query = query.eq('academic_year_id', options.academicYearId);
    }

    if (options?.gradeLevelId) {
      query = query.eq('grade_level_id', options.gradeLevelId);
    }

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to list curriculum: ${error.message}`,
        undefined,
        'CurriculumService',
      );
      throw new Error(`Failed to list curriculum: ${error.message}`);
    }

    return (data || []) as Curriculum[];
  }

  async findOne(id: string, tenantId: string): Promise<Curriculum | null> {
    const { data, error } = await this.supabase
      .from('curriculum')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get curriculum: ${error.message}`);
    }

    return data as Curriculum;
  }

  async create(
    tenantId: string,
    dto: CreateCurriculumDto,
    userId?: string,
  ): Promise<Curriculum> {
    const { data, error } = await this.supabase
      .from('curriculum')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id,
        academic_year_id: dto.academic_year_id,
        grade_level_id: dto.grade_level_id,
        name: dto.name,
        version: dto.version ?? 1,
        status: dto.status ?? 'draft',
        description: dto.description ?? null,
        metadata: dto.metadata ?? {},
        ai_context: dto.ai_context ?? {},
        ai_summary: dto.ai_summary ?? null,
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          'Já existe um currículo com esta combinação de escola/ano/série/versão',
        );
      }
      this.logger.error(
        `Failed to create curriculum: ${error.message}`,
        undefined,
        'CurriculumService',
      );
      throw new Error(`Failed to create curriculum: ${error.message}`);
    }

    this.logger.log('Curriculum created', 'CurriculumService', {
      id: data.id,
      name: dto.name,
    });

    return data as Curriculum;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateCurriculumDto,
    userId?: string,
  ): Promise<Curriculum> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Currículo com id '${id}' não encontrado`);
    }

    // Não permite editar currículo arquivado
    if (existing.status === 'archived') {
      throw new BadRequestException(
        'Não é possível editar um currículo arquivado',
      );
    }

    const { data, error } = await this.supabase
      .from('curriculum')
      .update({
        ...dto,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          'Já existe um currículo com esta versão para esta combinação',
        );
      }
      throw new Error(`Failed to update curriculum: ${error.message}`);
    }

    this.logger.log('Curriculum updated', 'CurriculumService', { id });

    return data as Curriculum;
  }

  async activate(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<Curriculum> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Currículo com id '${id}' não encontrado`);
    }

    if (existing.status === 'archived') {
      throw new BadRequestException(
        'Não é possível ativar um currículo arquivado',
      );
    }

    const { data, error } = await this.supabase
      .from('curriculum')
      .update({
        status: 'active',
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to activate curriculum: ${error.message}`);
    }

    this.logger.log('Curriculum activated', 'CurriculumService', { id });

    return data as Curriculum;
  }

  async archive(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<Curriculum> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Currículo com id '${id}' não encontrado`);
    }

    const { data, error } = await this.supabase
      .from('curriculum')
      .update({
        status: 'archived',
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to archive curriculum: ${error.message}`);
    }

    this.logger.log('Curriculum archived', 'CurriculumService', { id });

    return data as Curriculum;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Currículo com id '${id}' não encontrado`);
    }

    if (existing.status === 'active') {
      throw new BadRequestException(
        'Não é possível excluir um currículo ativo. Arquive-o primeiro.',
      );
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'curriculum',
      id,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete curriculum: ${result.error}`);
    }

    this.logger.log('Curriculum deleted', 'CurriculumService', { id });
  }

  // ======================
  // Curriculum Subjects
  // ======================

  async findSubjects(
    curriculumId: string,
    tenantId: string,
  ): Promise<CurriculumSubject[]> {
    const { data, error } = await this.supabase
      .from('curriculum_subjects')
      .select('*, subjects(*)')
      .eq('curriculum_id', curriculumId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('order_index', { ascending: true });

    if (error) {
      throw new Error(`Failed to list curriculum subjects: ${error.message}`);
    }

    return (data || []) as CurriculumSubject[];
  }

  async findSubjectOne(
    curriculumSubjectId: string,
    tenantId: string,
  ): Promise<CurriculumSubject | null> {
    const { data, error } = await this.supabase
      .from('curriculum_subjects')
      .select('*, subjects(*)')
      .eq('id', curriculumSubjectId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get curriculum subject: ${error.message}`);
    }

    return data as CurriculumSubject;
  }

  async addSubject(
    curriculumId: string,
    tenantId: string,
    dto: CreateCurriculumSubjectDto,
    userId?: string,
  ): Promise<CurriculumSubject> {
    // Verificar se currículo existe
    const curriculum = await this.findOne(curriculumId, tenantId);
    if (!curriculum) {
      throw new NotFoundException(
        `Currículo com id '${curriculumId}' não encontrado`,
      );
    }

    if (curriculum.status === 'archived') {
      throw new BadRequestException(
        'Não é possível adicionar disciplinas a um currículo arquivado',
      );
    }

    // Determinar order_index se não fornecido
    let orderIndex = dto.order_index;
    if (!orderIndex) {
      const existing = await this.findSubjects(curriculumId, tenantId);
      orderIndex = existing.length + 1;
    }

    const { data, error } = await this.supabase
      .from('curriculum_subjects')
      .insert({
        tenant_id: tenantId,
        curriculum_id: curriculumId,
        subject_id: dto.subject_id,
        is_mandatory: dto.is_mandatory ?? true,
        order_index: orderIndex,
        yearly_minutes: dto.yearly_minutes ?? null,
        weekly_classes: dto.weekly_classes ?? null,
        rules: dto.rules ?? {},
        notes: dto.notes ?? null,
        ai_context: dto.ai_context ?? {},
        ai_summary: dto.ai_summary ?? null,
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException('Esta disciplina já está no currículo');
      }
      this.logger.error(
        `Failed to add curriculum subject: ${error.message}`,
        undefined,
        'CurriculumService',
      );
      throw new Error(`Failed to add curriculum subject: ${error.message}`);
    }

    this.logger.log('Curriculum subject added', 'CurriculumService', {
      curriculumId,
      subjectId: dto.subject_id,
    });

    return data as CurriculumSubject;
  }

  async updateSubject(
    curriculumSubjectId: string,
    tenantId: string,
    dto: UpdateCurriculumSubjectDto,
    userId?: string,
  ): Promise<CurriculumSubject> {
    const existing = await this.findSubjectOne(curriculumSubjectId, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `Curriculum subject com id '${curriculumSubjectId}' não encontrado`,
      );
    }

    const { data, error } = await this.supabase
      .from('curriculum_subjects')
      .update({
        ...dto,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', curriculumSubjectId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update curriculum subject: ${error.message}`);
    }

    this.logger.log('Curriculum subject updated', 'CurriculumService', {
      id: curriculumSubjectId,
    });

    return data as CurriculumSubject;
  }

  async removeSubject(
    curriculumSubjectId: string,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const existing = await this.findSubjectOne(curriculumSubjectId, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `Curriculum subject com id '${curriculumSubjectId}' não encontrado`,
      );
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'curriculum_subjects',
      curriculumSubjectId,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to remove curriculum subject: ${result.error}`);
    }

    this.logger.log('Curriculum subject removed', 'CurriculumService', {
      id: curriculumSubjectId,
    });
  }
}
