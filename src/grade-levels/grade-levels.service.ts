import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { GradeLevel } from '../common/types';
import { CreateGradeLevelDto } from './dto/create-grade-level.dto';
import { UpdateGradeLevelDto } from './dto/update-grade-level.dto';

@Injectable()
export class GradeLevelsService {
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
    activeOnly: boolean = false,
  ): Promise<GradeLevel[]> {
    let query = this.supabase
      .from('grade_levels')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('order_index', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to list grade levels: ${error.message}`,
        undefined,
        'GradeLevelsService',
      );
      throw new Error(`Failed to list grade levels: ${error.message}`);
    }

    return (data || []) as GradeLevel[];
  }

  async findOne(id: string, tenantId: string): Promise<GradeLevel | null> {
    const { data, error } = await this.supabase
      .from('grade_levels')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get grade level: ${error.message}`);
    }

    return data as GradeLevel;
  }

  async create(
    tenantId: string,
    dto: CreateGradeLevelDto,
    userId?: string,
  ): Promise<GradeLevel> {
    const { data, error } = await this.supabase
      .from('grade_levels')
      .insert({
        tenant_id: tenantId,
        ...dto,
        is_active: dto.is_active ?? true,
        ai_context: dto.ai_context ?? {},
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          `Já existe uma série com o slug '${dto.slug}' nesta organização`,
        );
      }
      this.logger.error(
        `Failed to create grade level: ${error.message}`,
        undefined,
        'GradeLevelsService',
      );
      throw new Error(`Failed to create grade level: ${error.message}`);
    }

    this.logger.log('Grade level created', 'GradeLevelsService', {
      id: data.id,
      name: dto.name,
    });

    return data as GradeLevel;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateGradeLevelDto,
    userId?: string,
  ): Promise<GradeLevel> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Série com id '${id}' não encontrada`);
    }

    const { data, error } = await this.supabase
      .from('grade_levels')
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
          'Já existe uma série com este slug nesta organização',
        );
      }
      throw new Error(`Failed to update grade level: ${error.message}`);
    }

    return data as GradeLevel;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Série com id '${id}' não encontrada`);
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'grade_levels',
      id,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete grade level: ${result.error}`);
    }

    this.logger.log('Grade level deleted', 'GradeLevelsService', { id });
  }
}
