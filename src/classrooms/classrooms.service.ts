import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { Classroom } from '../common/types';
import { CreateClassroomDto } from './dto/create-classroom.dto';
import { UpdateClassroomDto } from './dto/update-classroom.dto';

@Injectable()
export class ClassroomsService {
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
    schoolId?: string,
    activeOnly: boolean = false,
  ): Promise<Classroom[]> {
    let query = this.supabase
      .from('classrooms')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (schoolId) {
      query = query.eq('school_id', schoolId);
    }

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const result = await query;

    if (result.error) {
      this.logger.error(
        `Failed to list classrooms: ${result.error.message}`,
        undefined,
        'ClassroomsService',
      );
      throw new Error(`Failed to list classrooms: ${result.error.message}`);
    }

    return (result.data || []) as Classroom[];
  }

  async findOne(id: string, tenantId: string): Promise<Classroom | null> {
    const result = await this.supabase
      .from('classrooms')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (result.error) {
      if (result.error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get classroom: ${result.error.message}`);
    }

    return result.data as Classroom | null;
  }

  async create(
    tenantId: string,
    dto: CreateClassroomDto,
    userId?: string,
  ): Promise<Classroom> {
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

    const result = await this.supabase
      .from('classrooms')
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
        if (result.error.message.includes('name')) {
          throw new ConflictException(
            `Já existe uma sala com o nome '${dto.name}' nesta escola`,
          );
        }
        if (result.error.message.includes('code')) {
          throw new ConflictException(
            `Já existe uma sala com o código '${dto.code}' nesta escola`,
          );
        }
      }
      this.logger.error(
        `Failed to create classroom: ${result.error.message}`,
        undefined,
        'ClassroomsService',
      );
      throw new Error(`Failed to create classroom: ${result.error.message}`);
    }

    const classroom = result.data as Classroom;
    this.logger.log('Classroom created', 'ClassroomsService', {
      id: classroom.id,
      name: dto.name,
    });

    return classroom;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateClassroomDto,
    userId?: string,
  ): Promise<Classroom> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Sala com id '${id}' não encontrada`);
    }

    const result = await this.supabase
      .from('classrooms')
      .update({
        ...dto,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (result.error) {
      if (result.error.code === '23505') {
        if (result.error.message.includes('name')) {
          throw new ConflictException(
            `Já existe uma sala com o nome '${dto.name}' nesta escola`,
          );
        }
        if (result.error.message.includes('code')) {
          throw new ConflictException(
            `Já existe uma sala com o código '${dto.code}' nesta escola`,
          );
        }
      }
      throw new Error(`Failed to update classroom: ${result.error.message}`);
    }

    return result.data as Classroom;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Sala com id '${id}' não encontrada`);
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'classrooms',
      id,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete classroom: ${result.error}`);
    }

    this.logger.log('Classroom deleted', 'ClassroomsService', { id });
  }
}
