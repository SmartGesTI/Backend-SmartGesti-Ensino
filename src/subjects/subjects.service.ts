import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { Subject } from '../common/types';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

@Injectable()
export class SubjectsService {
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
      activeOnly?: boolean;
      stage?: string;
    },
  ): Promise<Subject[]> {
    let query = this.supabase
      .from('subjects')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (options?.activeOnly) {
      query = query.eq('is_active', true);
    }

    if (options?.stage) {
      query = query.eq('stage', options.stage);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to list subjects: ${error.message}`,
        undefined,
        'SubjectsService',
      );
      throw new Error(`Failed to list subjects: ${error.message}`);
    }

    return (data || []) as Subject[];
  }

  async findOne(id: string, tenantId: string): Promise<Subject | null> {
    const { data, error } = await this.supabase
      .from('subjects')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get subject: ${error.message}`);
    }

    return data as Subject;
  }

  async findBySlug(slug: string, tenantId: string): Promise<Subject | null> {
    const { data, error } = await this.supabase
      .from('subjects')
      .select('*')
      .eq('slug', slug)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get subject by slug: ${error.message}`);
    }

    return data as Subject;
  }

  async create(
    tenantId: string,
    dto: CreateSubjectDto,
    userId?: string,
  ): Promise<Subject> {
    const { data, error } = await this.supabase
      .from('subjects')
      .insert({
        tenant_id: tenantId,
        name: dto.name,
        slug: dto.slug,
        code: dto.code ?? null,
        stage: dto.stage,
        is_active: dto.is_active ?? true,
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
          `Já existe uma disciplina com o slug '${dto.slug}' nesta organização`,
        );
      }
      this.logger.error(
        `Failed to create subject: ${error.message}`,
        undefined,
        'SubjectsService',
      );
      throw new Error(`Failed to create subject: ${error.message}`);
    }

    this.logger.log('Subject created', 'SubjectsService', {
      id: data.id,
      name: dto.name,
    });

    return data as Subject;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateSubjectDto,
    userId?: string,
  ): Promise<Subject> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Disciplina com id '${id}' não encontrada`);
    }

    const { data, error } = await this.supabase
      .from('subjects')
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
          'Já existe uma disciplina com este slug nesta organização',
        );
      }
      throw new Error(`Failed to update subject: ${error.message}`);
    }

    this.logger.log('Subject updated', 'SubjectsService', { id });

    return data as Subject;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Disciplina com id '${id}' não encontrada`);
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'subjects',
      id,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete subject: ${result.error}`);
    }

    this.logger.log('Subject deleted', 'SubjectsService', { id });
  }

  async restore(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<Subject> {
    const { data: existing } = await this.supabase
      .from('subjects')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .not('deleted_at', 'is', null)
      .single();

    if (!existing) {
      throw new NotFoundException(
        `Disciplina com id '${id}' não encontrada ou não está excluída`,
      );
    }

    const result = await this.softDeleteService.restore(
      this.supabase,
      'subjects',
      id,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to restore subject: ${result.error}`);
    }

    const restored = await this.findOne(id, tenantId);
    this.logger.log('Subject restored', 'SubjectsService', { id });

    return restored as Subject;
  }
}
