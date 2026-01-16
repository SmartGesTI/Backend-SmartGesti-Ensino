import { IsOptional, IsUUID } from 'class-validator';

/**
 * Query params para buscar o resumo da estrutura acadêmica
 */
export class AcademicStructureSummaryQueryDto {
  @IsUUID()
  school_id: string;

  @IsOptional()
  @IsUUID()
  academic_year_id?: string;
}

/**
 * Contadores da estrutura acadêmica
 */
export interface AcademicStructureCounts {
  classGroups: number;
  gradeLevels: number;
  shifts: number;
  classrooms: number;
}

/**
 * Alertas da estrutura acadêmica
 */
export interface AcademicStructureAlerts {
  classGroupsWithoutRoom: number;
  roomsOverCapacity: number;
}

/**
 * Resposta do endpoint de resumo
 */
export interface AcademicStructureSummaryResponse {
  counts: AcademicStructureCounts;
  alerts: AcademicStructureAlerts;
}
