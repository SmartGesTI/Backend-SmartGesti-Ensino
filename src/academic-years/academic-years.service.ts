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
import { AcademicYear } from '../common/types';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';

@Injectable()
export class AcademicYearsService {
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
    status?: string,
  ): Promise<AcademicYear[]> {
    let query = this.supabase
      .from('academic_years')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('year', { ascending: false });

    if (schoolId) {
      query = query.eq('school_id', schoolId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const result = await query;

    if (result.error) {
      this.logger.error(
        `Failed to list academic years: ${result.error.message}`,
        undefined,
        'AcademicYearsService',
      );
      throw new Error(`Failed to list academic years: ${result.error.message}`);
    }

    return (result.data || []) as AcademicYear[];
  }

  async findOne(id: string, tenantId: string): Promise<AcademicYear | null> {
    const result = await this.supabase
      .from('academic_years')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (result.error) {
      if (result.error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get academic year: ${result.error.message}`);
    }

    return result.data as AcademicYear;
  }

  async findCurrent(
    tenantId: string,
    schoolId: string,
  ): Promise<AcademicYear | null> {
    const result = await this.supabase
      .from('academic_years')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .single();

    if (result.error) {
      if (result.error.code === 'PGRST116') {
        return null;
      }
      throw new Error(
        `Failed to get current academic year: ${result.error.message}`,
      );
    }

    return result.data as AcademicYear;
  }

  async create(
    tenantId: string,
    dto: CreateAcademicYearDto,
    userId?: string,
  ): Promise<AcademicYear> {
    // Verificar se escola pertence ao tenant
    const schoolResult = await this.supabase
      .from('schools')
      .select('id, tenant_id')
      .eq('id', dto.school_id)
      .single();

    const school = schoolResult.data as {
      id: string;
      tenant_id: string;
    } | null;
    if (!school || school.tenant_id !== tenantId) {
      throw new ForbiddenException('Escola não pertence a esta organização');
    }

    // Validar datas
    if (new Date(dto.end_date) < new Date(dto.start_date)) {
      throw new BadRequestException(
        'Data de término deve ser posterior à data de início',
      );
    }

    const result = await this.supabase
      .from('academic_years')
      .insert({
        tenant_id: tenantId,
        ...dto,
        status: dto.status ?? 'planning',
        ai_context: dto.ai_context ?? {},
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (result.error) {
      if (result.error.code === '23505') {
        throw new ConflictException(
          `Já existe um ano letivo ${dto.year} para esta escola`,
        );
      }
      this.logger.error(
        `Failed to create academic year: ${result.error.message}`,
        undefined,
        'AcademicYearsService',
      );
      throw new Error(
        `Failed to create academic year: ${result.error.message}`,
      );
    }

    const academicYear = result.data as AcademicYear;
    this.logger.log('Academic year created', 'AcademicYearsService', {
      id: academicYear.id,
      year: dto.year,
    });

    return academicYear;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateAcademicYearDto,
    userId?: string,
  ): Promise<AcademicYear> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Ano letivo com id '${id}' não encontrado`);
    }

    // Validar datas se ambas forem fornecidas
    const startDate = dto.start_date || existing.start_date;
    const endDate = dto.end_date || existing.end_date;
    if (new Date(endDate) < new Date(startDate)) {
      throw new BadRequestException(
        'Data de término deve ser posterior à data de início',
      );
    }

    const result = await this.supabase
      .from('academic_years')
      .update({
        ...dto,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (result.error) {
      throw new Error(
        `Failed to update academic year: ${result.error.message}`,
      );
    }

    return result.data as AcademicYear;
  }

  async close(
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<AcademicYear> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Ano letivo com id '${id}' não encontrado`);
    }

    if (existing.status === 'closed') {
      throw new BadRequestException('Este ano letivo já está encerrado');
    }

    const result = await this.supabase
      .from('academic_years')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        closed_by: userId,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to close academic year: ${result.error.message}`);
    }

    this.logger.log('Academic year closed', 'AcademicYearsService', {
      id,
      year: existing.year,
    });

    return result.data as AcademicYear;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Ano letivo com id '${id}' não encontrado`);
    }

    // Verificar se há turmas associadas
    const { count } = await this.supabase
      .from('class_groups')
      .select('id', { count: 'exact', head: true })
      .eq('academic_year_id', id)
      .is('deleted_at', null);

    if (count && count > 0) {
      throw new BadRequestException(
        'Não é possível remover um ano letivo com turmas associadas',
      );
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'academic_years',
      id,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete academic year: ${result.error}`);
    }

    this.logger.log('Academic year deleted', 'AcademicYearsService', { id });
  }
}
