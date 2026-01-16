import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import {
  AcademicStructureSummaryResponse,
  AcademicStructureCounts,
  AcademicStructureAlerts,
} from './dto/academic-structure-summary.dto';

@Injectable()
export class AcademicStructureService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Busca o resumo agregado da estrutura acadêmica
   * Usa COUNT para otimizar performance
   */
  async getSummary(
    tenantId: string,
    schoolId: string,
    academicYearId?: string,
  ): Promise<AcademicStructureSummaryResponse> {
    // Se não foi passado ano letivo, buscar o ano atual da escola
    let effectiveYearId = academicYearId;

    if (!effectiveYearId) {
      const currentYear = await this.getCurrentAcademicYear(tenantId, schoolId);
      effectiveYearId = currentYear?.id;
    }

    // Buscar contadores em paralelo
    const [classGroupsCount, gradeLevelsCount, shiftsCount, classroomsCount] =
      await Promise.all([
        this.countClassGroups(tenantId, schoolId, effectiveYearId),
        this.countGradeLevels(tenantId),
        this.countShifts(tenantId),
        this.countClassrooms(tenantId, schoolId),
      ]);

    // Buscar alertas
    const alerts = this.getAlerts(tenantId, schoolId, effectiveYearId);

    const counts: AcademicStructureCounts = {
      classGroups: classGroupsCount,
      gradeLevels: gradeLevelsCount,
      shifts: shiftsCount,
      classrooms: classroomsCount,
    };

    return {
      counts,
      alerts,
    };
  }

  /**
   * Busca o ano letivo atual da escola
   */
  private async getCurrentAcademicYear(
    tenantId: string,
    schoolId: string,
  ): Promise<{ id: string } | null> {
    const result = await this.supabase
      .from('academic_years')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('year', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (result.error) {
      this.logger.error(
        `Failed to get current academic year: ${result.error.message}`,
        undefined,
        'AcademicStructureService',
      );
      return null;
    }

    return result.data as { id: string } | null;
  }

  /**
   * Conta turmas (class_groups)
   */
  private async countClassGroups(
    tenantId: string,
    schoolId: string,
    academicYearId?: string,
  ): Promise<number> {
    let query = this.supabase
      .from('class_groups')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('school_id', schoolId)
      .is('deleted_at', null);

    if (academicYearId) {
      query = query.eq('academic_year_id', academicYearId);
    }

    const result = await query;

    if (result.error) {
      this.logger.error(
        `Failed to count class groups: ${result.error.message}`,
        undefined,
        'AcademicStructureService',
      );
      return 0;
    }

    return result.count || 0;
  }

  /**
   * Conta séries (grade_levels)
   * Séries são por tenant, não por escola
   */
  private async countGradeLevels(tenantId: string): Promise<number> {
    const result = await this.supabase
      .from('grade_levels')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .is('deleted_at', null);

    if (result.error) {
      this.logger.error(
        `Failed to count grade levels: ${result.error.message}`,
        undefined,
        'AcademicStructureService',
      );
      return 0;
    }

    return result.count || 0;
  }

  /**
   * Conta turnos (shifts)
   * Turnos são por tenant, não por escola
   */
  private async countShifts(tenantId: string): Promise<number> {
    const result = await this.supabase
      .from('shifts')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .is('deleted_at', null);

    if (result.error) {
      this.logger.error(
        `Failed to count shifts: ${result.error.message}`,
        undefined,
        'AcademicStructureService',
      );
      return 0;
    }

    return result.count || 0;
  }

  /**
   * Conta salas (classrooms)
   */
  private async countClassrooms(
    tenantId: string,
    schoolId: string,
  ): Promise<number> {
    const result = await this.supabase
      .from('classrooms')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .is('deleted_at', null);

    if (result.error) {
      this.logger.error(
        `Failed to count classrooms: ${result.error.message}`,
        undefined,
        'AcademicStructureService',
      );
      return 0;
    }

    return result.count || 0;
  }

  /**
   * Calcula alertas da estrutura acadêmica
   * TODO: Implementar quando o sistema de alocação estiver completo
   */
  private getAlerts(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    tenantId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    schoolId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    academicYearId?: string,
  ): AcademicStructureAlerts {
    // Por agora, retorna zeros
    // Para turmas sem sala, seria necessário:
    // 1. Buscar todas as turmas do ano
    // 2. Verificar quais têm alocação vigente (valid_from <= hoje, valid_to IS NULL ou >= hoje)

    // Para salas com capacidade excedida:
    // 1. Buscar turmas com alocação vigente
    // 2. Comparar turma.max_students com classroom.capacity

    return {
      classGroupsWithoutRoom: 0,
      roomsOverCapacity: 0,
    };
  }
}
