import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { AcademicYear } from '../common/types';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { AcademicCalendarsService } from '../academic-calendars/academic-calendars.service';

@Injectable()
export class AcademicYearsService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
    private softDeleteService: SoftDeleteService,
    @Inject(forwardRef(() => AcademicCalendarsService))
    private calendarsService: AcademicCalendarsService,
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

  /**
   * Encontra ou cria o Academic Year apropriado para criação de calendário
   * - Se escola não tem calendário ativo: retorna/cria ano atual
   * - Se escola tem calendário ativo: retorna/cria ano seguinte
   */
  async findOrCreateForCalendar(
    tenantId: string,
    schoolId: string,
    userId?: string,
  ): Promise<AcademicYear> {
    // 1. Buscar calendários ativos da escola
    const activeCalendars = await this.calendarsService.findAll(tenantId, {
      schoolId,
      status: 'active',
    });

    let targetYear: number;

    if (activeCalendars.length === 0) {
      // Não há calendário ativo: usar ano atual
      targetYear = new Date().getFullYear();
      this.logger.log(
        `No active calendar found, using current year: ${targetYear}`,
        'AcademicYearsService',
      );
    } else {
      // Há calendário ativo: buscar o academic year do calendário mais recente
      const mostRecentCalendar = activeCalendars.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )[0];

      // Buscar o academic year do calendário
      const calendarAcademicYear = await this.findOne(
        mostRecentCalendar.academic_year_id,
        tenantId,
      );

      if (!calendarAcademicYear) {
        // Se não encontrar, usar ano atual como fallback
        targetYear = new Date().getFullYear();
        this.logger.warn(
          `Academic year ${mostRecentCalendar.academic_year_id} not found, using current year`,
          'AcademicYearsService',
        );
      } else {
        // Usar ano seguinte
        targetYear = calendarAcademicYear.year + 1;
        this.logger.log(
          `Active calendar found for year ${calendarAcademicYear.year}, using next year: ${targetYear}`,
          'AcademicYearsService',
        );
      }
    }

    // 2. Buscar academic year do ano alvo
    const existingYear = await this.supabase
      .from('academic_years')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('school_id', schoolId)
      .eq('year', targetYear)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingYear.error && existingYear.error.code !== 'PGRST116') {
      throw new Error(
        `Failed to check existing academic year: ${existingYear.error.message}`,
      );
    }

    if (existingYear.data) {
      // Ano já existe, retornar
      this.logger.log(
        `Academic year ${targetYear} already exists`,
        'AcademicYearsService',
      );
      return existingYear.data as AcademicYear;
    }

    // 3. Criar academic year do ano alvo
    const startDate = new Date(targetYear, 0, 1).toISOString().split('T')[0]; // 01/01
    const endDate = new Date(targetYear, 11, 31).toISOString().split('T')[0]; // 31/12

    const createDto: CreateAcademicYearDto = {
      school_id: schoolId,
      year: targetYear,
      start_date: startDate,
      end_date: endDate,
      status: 'planning',
    };

    this.logger.log(
      `Creating academic year ${targetYear} for calendar`,
      'AcademicYearsService',
    );

    return this.create(tenantId, createDto, userId);
  }
}
