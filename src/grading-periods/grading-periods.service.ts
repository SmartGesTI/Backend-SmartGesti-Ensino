import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { GradingPeriod } from '../common/types';
import { CreateGradingPeriodDto } from './dto/create-grading-period.dto';
import { UpdateGradingPeriodDto } from './dto/update-grading-period.dto';

@Injectable()
export class GradingPeriodsService {
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
      activeOnly?: boolean;
    },
  ): Promise<GradingPeriod[]> {
    let query = this.supabase
      .from('grading_periods')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('order_index', { ascending: true });

    if (options?.schoolId) {
      query = query.eq('school_id', options.schoolId);
    }

    if (options?.academicYearId) {
      query = query.eq('academic_year_id', options.academicYearId);
    }

    if (options?.activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to list grading periods: ${error.message}`,
        undefined,
        'GradingPeriodsService',
      );
      throw new Error(`Failed to list grading periods: ${error.message}`);
    }

    return (data || []) as GradingPeriod[];
  }

  async findOne(id: string, tenantId: string): Promise<GradingPeriod | null> {
    const { data, error } = await this.supabase
      .from('grading_periods')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get grading period: ${error.message}`);
    }

    return data as GradingPeriod;
  }

  async create(
    tenantId: string,
    dto: CreateGradingPeriodDto,
    userId?: string,
  ): Promise<GradingPeriod> {
    // Validar datas
    if (new Date(dto.end_date) < new Date(dto.start_date)) {
      throw new BadRequestException(
        'A data de término deve ser posterior à data de início',
      );
    }

    const { data, error } = await this.supabase
      .from('grading_periods')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id,
        academic_year_id: dto.academic_year_id,
        name: dto.name,
        period_type: dto.period_type,
        order_index: dto.order_index,
        start_date: dto.start_date,
        end_date: dto.end_date,
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
          `Já existe um período com índice ${dto.order_index} para este ano letivo`,
        );
      }
      this.logger.error(
        `Failed to create grading period: ${error.message}`,
        undefined,
        'GradingPeriodsService',
      );
      throw new Error(`Failed to create grading period: ${error.message}`);
    }

    this.logger.log('Grading period created', 'GradingPeriodsService', {
      id: data.id,
      name: dto.name,
    });

    return data as GradingPeriod;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateGradingPeriodDto,
    userId?: string,
  ): Promise<GradingPeriod> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `Período de nota com id '${id}' não encontrado`,
      );
    }

    // Se período já foi fechado, não permite edição
    if (existing.closed_at) {
      throw new BadRequestException(
        'Não é possível editar um período já fechado',
      );
    }

    // Validar datas se ambas forem fornecidas
    const startDate = dto.start_date || existing.start_date;
    const endDate = dto.end_date || existing.end_date;
    if (new Date(endDate) < new Date(startDate)) {
      throw new BadRequestException(
        'A data de término deve ser posterior à data de início',
      );
    }

    const { data, error } = await this.supabase
      .from('grading_periods')
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
          'Já existe um período com este índice para este ano letivo',
        );
      }
      throw new Error(`Failed to update grading period: ${error.message}`);
    }

    this.logger.log('Grading period updated', 'GradingPeriodsService', { id });

    return data as GradingPeriod;
  }

  async close(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<GradingPeriod> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `Período de nota com id '${id}' não encontrado`,
      );
    }

    if (existing.closed_at) {
      throw new BadRequestException('Este período já está fechado');
    }

    const { data, error } = await this.supabase
      .from('grading_periods')
      .update({
        closed_at: new Date().toISOString(),
        closed_by: userId,
        is_active: false,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to close grading period: ${error.message}`);
    }

    this.logger.log('Grading period closed', 'GradingPeriodsService', { id });

    return data as GradingPeriod;
  }

  async reopen(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<GradingPeriod> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `Período de nota com id '${id}' não encontrado`,
      );
    }

    if (!existing.closed_at) {
      throw new BadRequestException('Este período não está fechado');
    }

    const { data, error } = await this.supabase
      .from('grading_periods')
      .update({
        closed_at: null,
        closed_by: null,
        is_active: true,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to reopen grading period: ${error.message}`);
    }

    this.logger.log('Grading period reopened', 'GradingPeriodsService', { id });

    return data as GradingPeriod;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `Período de nota com id '${id}' não encontrado`,
      );
    }

    if (existing.closed_at) {
      throw new BadRequestException(
        'Não é possível excluir um período já fechado',
      );
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'grading_periods',
      id,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete grading period: ${result.error}`);
    }

    this.logger.log('Grading period deleted', 'GradingPeriodsService', { id });
  }
}
