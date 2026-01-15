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
  ClassGroup,
  ClassGroupWithRelations,
  ClassGroupRoomAllocation,
} from '../common/types';
import { CreateClassGroupDto } from './dto/create-class-group.dto';
import {
  UpdateClassGroupDto,
  AllocateRoomDto,
} from './dto/update-class-group.dto';

@Injectable()
export class ClassGroupsService {
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
    filters?: {
      schoolId?: string;
      academicYearId?: string;
      gradeLevelId?: string;
      shiftId?: string;
      activeOnly?: boolean;
    },
  ): Promise<ClassGroupWithRelations[]> {
    let query = this.supabase
      .from('class_groups')
      .select(
        `
        *,
        academic_years (*),
        grade_levels (*),
        shifts (*)
      `,
      )
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('code', { ascending: true });

    if (filters?.schoolId) {
      query = query.eq('school_id', filters.schoolId);
    }

    if (filters?.academicYearId) {
      query = query.eq('academic_year_id', filters.academicYearId);
    }

    if (filters?.gradeLevelId) {
      query = query.eq('grade_level_id', filters.gradeLevelId);
    }

    if (filters?.shiftId) {
      query = query.eq('shift_id', filters.shiftId);
    }

    if (filters?.activeOnly) {
      query = query.eq('is_active', true);
    }

    const result = await query;

    if (result.error) {
      this.logger.error(
        `Failed to list class groups: ${result.error.message}`,
        undefined,
        'ClassGroupsService',
      );
      throw new Error(`Failed to list class groups: ${result.error.message}`);
    }

    return ((result.data || []) as unknown as ClassGroupWithRelations[]).map(
      (cg) => {
        const cgWithRelations = cg as ClassGroupWithRelations & {
          academic_years: unknown;
          grade_levels: unknown;
          shifts: unknown;
        };
        return {
          ...cgWithRelations,
          academic_year: cgWithRelations.academic_years,
          grade_level: cgWithRelations.grade_levels,
          shift: cgWithRelations.shifts,
        } as ClassGroupWithRelations;
      },
    );
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<ClassGroupWithRelations | null> {
    const result = await this.supabase
      .from('class_groups')
      .select(
        `
        *,
        academic_years (*),
        grade_levels (*),
        shifts (*)
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
      throw new Error(`Failed to get class group: ${result.error.message}`);
    }

    const classGroup = result.data as unknown as ClassGroupWithRelations & {
      academic_years: unknown;
      grade_levels: unknown;
      shifts: unknown;
    };

    // Buscar alocações de sala
    const allocationsResult = await this.supabase
      .from('class_group_room_allocations')
      .select('*')
      .eq('class_group_id', id)
      .is('deleted_at', null)
      .order('valid_from', { ascending: false });

    return {
      ...classGroup,
      academic_year: classGroup.academic_years,
      grade_level: classGroup.grade_levels,
      shift: classGroup.shifts,
      room_allocations: (allocationsResult.data ||
        []) as ClassGroupRoomAllocation[],
    } as ClassGroupWithRelations;
  }

  async create(
    tenantId: string,
    dto: CreateClassGroupDto,
    userId?: string,
  ): Promise<ClassGroup> {
    // Verificar se escola pertence ao tenant
    const schoolResult = await this.supabase
      .from('schools')
      .select('id, tenant_id')
      .eq('id', dto.school_id)
      .single();

    if (schoolResult.error) {
      throw new ForbiddenException('Escola não encontrada');
    }

    const school = schoolResult.data as { id: string; tenant_id: string };
    if (!school || school.tenant_id !== tenantId) {
      throw new ForbiddenException('Escola não pertence a esta organização');
    }

    // Verificar se ano letivo pertence à escola
    const academicYearResult = await this.supabase
      .from('academic_years')
      .select('id, school_id')
      .eq('id', dto.academic_year_id)
      .eq('school_id', dto.school_id)
      .is('deleted_at', null)
      .single();

    if (academicYearResult.error) {
      throw new BadRequestException(
        'Ano letivo não encontrado para esta escola',
      );
    }

    // Verificar se série pertence ao tenant
    const gradeLevelResult = await this.supabase
      .from('grade_levels')
      .select('id, tenant_id')
      .eq('id', dto.grade_level_id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (gradeLevelResult.error) {
      throw new BadRequestException('Série não encontrada nesta organização');
    }

    // Verificar se turno pertence ao tenant
    const shiftResult = await this.supabase
      .from('shifts')
      .select('id, tenant_id')
      .eq('id', dto.shift_id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (shiftResult.error) {
      throw new BadRequestException('Turno não encontrado nesta organização');
    }

    const result = await this.supabase
      .from('class_groups')
      .insert({
        tenant_id: tenantId,
        ...dto,
        is_active: dto.is_active ?? true,
        ai_context: dto.ai_context ?? {},
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (result.error) {
      if (result.error.code === '23505') {
        throw new ConflictException(
          `Já existe uma turma com o código '${dto.code}' para esta combinação de ano letivo, série e turno`,
        );
      }
      this.logger.error(
        `Failed to create class group: ${result.error.message}`,
        undefined,
        'ClassGroupsService',
      );
      throw new Error(`Failed to create class group: ${result.error.message}`);
    }

    const classGroup = result.data as ClassGroup;
    this.logger.log('Class group created', 'ClassGroupsService', {
      id: classGroup.id,
      code: dto.code,
    });

    return classGroup;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateClassGroupDto,
    userId?: string,
  ): Promise<ClassGroup> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Turma com id '${id}' não encontrada`);
    }

    const result = await this.supabase
      .from('class_groups')
      .update({
        ...dto,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (result.error) {
      if (result.error.code === '23505') {
        throw new ConflictException(
          `Já existe uma turma com o código '${dto.code}'`,
        );
      }
      throw new Error(`Failed to update class group: ${result.error.message}`);
    }

    return result.data as ClassGroup;
  }

  async allocateRoom(
    id: string,
    tenantId: string,
    dto: AllocateRoomDto,
    userId?: string,
  ): Promise<ClassGroupRoomAllocation> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Turma com id '${id}' não encontrada`);
    }

    // Verificar se sala existe e pertence ao tenant
    const classroomResult = await this.supabase
      .from('classrooms')
      .select('id, tenant_id, school_id')
      .eq('id', dto.classroom_id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (classroomResult.error) {
      throw new BadRequestException('Sala não encontrada nesta organização');
    }

    // Fechar alocação anterior se existir
    await this.supabase
      .from('class_group_room_allocations')
      .update({
        valid_to: dto.valid_from,
      })
      .eq('class_group_id', id)
      .is('valid_to', null)
      .is('deleted_at', null);

    // Criar nova alocação
    const result = await this.supabase
      .from('class_group_room_allocations')
      .insert({
        tenant_id: tenantId,
        class_group_id: id,
        classroom_id: dto.classroom_id,
        valid_from: dto.valid_from,
        valid_to: dto.valid_to || null,
        created_at: new Date().toISOString(),
        created_by: userId || null,
      })
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to allocate room: ${result.error.message}`);
    }

    this.logger.log('Room allocated to class group', 'ClassGroupsService', {
      classGroupId: id,
      classroomId: dto.classroom_id,
    });

    return result.data as ClassGroupRoomAllocation;
  }

  async getStudents(id: string, tenantId: string): Promise<any[]> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Turma com id '${id}' não encontrada`);
    }

    // Buscar memberships ativas da turma
    const result = await this.supabase
      .from('enrollment_class_memberships')
      .select(
        `
        *,
        enrollments!inner (
          *,
          students!inner (
            *,
            persons!inner (*)
          )
        )
      `,
      )
      .eq('class_group_id', id)
      .is('valid_to', null)
      .is('deleted_at', null);

    if (result.error) {
      throw new Error(`Failed to get students: ${result.error.message}`);
    }

    return (
      (result.data || []) as Array<{
        id: string;
        valid_from: string;
        enrollments: {
          students: {
            persons: unknown;
          };
        };
      }>
    ).map((m) => ({
      membership_id: m.id,
      valid_from: m.valid_from,
      enrollment: m.enrollments,
      student: m.enrollments.students,
      person: m.enrollments.students.persons,
    }));
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Turma com id '${id}' não encontrada`);
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'class_groups',
      id,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete class group: ${result.error}`);
    }

    // Soft-delete alocações de sala
    await this.supabase
      .from('class_group_room_allocations')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('class_group_id', id)
      .is('deleted_at', null);

    this.logger.log('Class group deleted', 'ClassGroupsService', { id });
  }
}
