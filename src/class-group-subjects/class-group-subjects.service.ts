import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { ClassGroupSubject } from '../common/types';
import { CreateClassGroupSubjectDto } from './dto/create-class-group-subject.dto';
import { UpdateClassGroupSubjectDto } from './dto/update-class-group-subject.dto';
import { AssignTeacherDto } from './dto/assign-teacher.dto';

@Injectable()
export class ClassGroupSubjectsService {
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
      classGroupId?: string;
      subjectId?: string;
      activeOnly?: boolean;
    },
  ): Promise<ClassGroupSubject[]> {
    let query = this.supabase
      .from('class_group_subjects')
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

    if (options?.classGroupId) {
      query = query.eq('class_group_id', options.classGroupId);
    }

    if (options?.subjectId) {
      query = query.eq('subject_id', options.subjectId);
    }

    if (options?.activeOnly) {
      query = query.eq('is_active', true);
    }

    const result = await query;

    if (result.error) {
      this.logger.error(
        `Failed to list class group subjects: ${result.error.message}`,
        undefined,
        'ClassGroupSubjectsService',
      );
      throw new Error(
        `Failed to list class group subjects: ${result.error.message}`,
      );
    }

    return (result.data || []) as ClassGroupSubject[];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<ClassGroupSubject | null> {
    const result = await this.supabase
      .from('class_group_subjects')
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
        `Failed to get class group subject: ${result.error.message}`,
      );
    }

    return result.data as ClassGroupSubject | null;
  }

  async findByClassGroupAndSubject(
    classGroupId: string,
    subjectId: string,
    tenantId: string,
  ): Promise<ClassGroupSubject | null> {
    const result = await this.supabase
      .from('class_group_subjects')
      .select('*')
      .eq('class_group_id', classGroupId)
      .eq('subject_id', subjectId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (result.error) {
      if (result.error.code === 'PGRST116') {
        return null;
      }
      throw new Error(
        `Failed to get class group subject: ${result.error.message}`,
      );
    }

    return result.data as ClassGroupSubject | null;
  }

  async create(
    tenantId: string,
    dto: CreateClassGroupSubjectDto,
    userId?: string,
  ): Promise<ClassGroupSubject> {
    const result = await this.supabase
      .from('class_group_subjects')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id,
        academic_year_id: dto.academic_year_id,
        class_group_id: dto.class_group_id,
        subject_id: dto.subject_id,
        primary_staff_school_profile_id:
          dto.primary_staff_school_profile_id ?? null,
        is_active: dto.is_active ?? true,
        weekly_classes: dto.weekly_classes ?? null,
        metadata: dto.metadata ?? {},
        ai_context: dto.ai_context ?? {},
        ai_summary: dto.ai_summary ?? null,
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (result.error) {
      if (result.error.code === '23505') {
        throw new ConflictException(
          'Esta disciplina já está vinculada a esta turma',
        );
      }
      this.logger.error(
        `Failed to create class group subject: ${result.error.message}`,
        undefined,
        'ClassGroupSubjectsService',
      );
      throw new Error(
        `Failed to create class group subject: ${result.error.message}`,
      );
    }

    const classGroupSubject = result.data as ClassGroupSubject;
    this.logger.log(
      'Class group subject created',
      'ClassGroupSubjectsService',
      {
        id: classGroupSubject.id,
        classGroupId: dto.class_group_id,
        subjectId: dto.subject_id,
      },
    );

    return classGroupSubject;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateClassGroupSubjectDto,
    userId?: string,
  ): Promise<ClassGroupSubject> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `Class group subject com id '${id}' não encontrado`,
      );
    }

    const result = await this.supabase
      .from('class_group_subjects')
      .update({
        ...dto,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (result.error) {
      throw new Error(
        `Failed to update class group subject: ${result.error.message}`,
      );
    }

    this.logger.log(
      'Class group subject updated',
      'ClassGroupSubjectsService',
      {
        id,
      },
    );

    return result.data as ClassGroupSubject;
  }

  async assignTeacher(
    id: string,
    tenantId: string,
    dto: AssignTeacherDto,
    userId?: string,
  ): Promise<ClassGroupSubject> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `Class group subject com id '${id}' não encontrado`,
      );
    }

    const result = await this.supabase
      .from('class_group_subjects')
      .update({
        primary_staff_school_profile_id:
          dto.primary_staff_school_profile_id ?? null,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to assign teacher: ${result.error.message}`);
    }

    this.logger.log(
      'Teacher assigned to class group subject',
      'ClassGroupSubjectsService',
      {
        id,
        teacherProfileId: dto.primary_staff_school_profile_id,
      },
    );

    return result.data as ClassGroupSubject;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `Class group subject com id '${id}' não encontrado`,
      );
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'class_group_subjects',
      id,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete class group subject: ${result.error}`);
    }

    this.logger.log(
      'Class group subject deleted',
      'ClassGroupSubjectsService',
      {
        id,
      },
    );
  }
}
