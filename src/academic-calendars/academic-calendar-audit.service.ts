import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type {
  AcademicCalendarAudit,
  CalendarAuditEntityType,
  CalendarAuditAction,
  ActorType,
} from '../common/types';

interface CreateAuditParams {
  tenantId: string;
  schoolId: string;
  entityType: CalendarAuditEntityType;
  entityId: string;
  calendarId?: string;
  academicYearId?: string;
  dayDate?: string;
  startDate?: string;
  endDate?: string;
  action: CalendarAuditAction;
  summary: string;
  reason?: string;
  reasonCode?: string;
  actorType?: ActorType;
  actorUserId?: string;
  correlationId?: string;
  changedFields?: string[];
  beforeSnapshot?: Record<string, unknown>;
  afterSnapshot?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AcademicCalendarAuditService {
  constructor(private supabase: SupabaseService) {}

  /**
   * Registra um evento de auditoria no calendario academico
   */
  async log(params: CreateAuditParams): Promise<AcademicCalendarAudit> {
    const insertData = {
      tenant_id: params.tenantId,
      school_id: params.schoolId,
      entity_type: params.entityType,
      entity_id: params.entityId,
      calendar_id: params.calendarId || null,
      academic_year_id: params.academicYearId || null,
      day_date: params.dayDate || null,
      start_date: params.startDate || null,
      end_date: params.endDate || null,
      action: params.action,
      summary: params.summary,
      reason: params.reason || null,
      reason_code: params.reasonCode || null,
      actor_type: params.actorType || 'user',
      actor_user_id: params.actorUserId || null,
      correlation_id: params.correlationId || null,
      occurred_at: new Date().toISOString(),
      changed_fields: params.changedFields || [],
      before_snapshot: params.beforeSnapshot || {},
      after_snapshot: params.afterSnapshot || {},
      metadata: params.metadata || {},
      created_by: params.actorUserId || null,
    };

    const result = await this.supabase
      .getClient()
      .from('academic_calendar_audits')
      .insert(insertData)
      .select()
      .single();

    const { data, error } = result as {
      data: AcademicCalendarAudit | null;
      error: { message: string } | null;
    };

    if (error || !data) {
      // Log error but don't throw - audit should not break main flow
      console.error('Erro ao registrar auditoria:', error?.message);
      return insertData as AcademicCalendarAudit;
    }

    return data;
  }

  /**
   * Busca timeline de auditoria por calendario
   */
  async findByCalendar(calendarId: string): Promise<AcademicCalendarAudit[]> {
    const result = await this.supabase
      .getClient()
      .from('academic_calendar_audits')
      .select('*')
      .eq('calendar_id', calendarId)
      .is('deleted_at', null)
      .order('occurred_at', { ascending: false });

    const { data, error } = result as {
      data: AcademicCalendarAudit[] | null;
      error: { message: string } | null;
    };

    if (error) {
      throw new Error(`Erro ao buscar auditoria: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Busca auditorias por correlation_id (operacao em lote)
   */
  async findByCorrelation(
    correlationId: string,
  ): Promise<AcademicCalendarAudit[]> {
    const result = await this.supabase
      .getClient()
      .from('academic_calendar_audits')
      .select('*')
      .eq('correlation_id', correlationId)
      .is('deleted_at', null)
      .order('occurred_at', { ascending: true });

    const { data, error } = result as {
      data: AcademicCalendarAudit[] | null;
      error: { message: string } | null;
    };

    if (error) {
      throw new Error(
        `Erro ao buscar auditoria por correlacao: ${error.message}`,
      );
    }

    return data || [];
  }

  /**
   * Busca auditorias por entidade especifica
   */
  async findByEntity(
    entityType: CalendarAuditEntityType,
    entityId: string,
  ): Promise<AcademicCalendarAudit[]> {
    const result = await this.supabase
      .getClient()
      .from('academic_calendar_audits')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .is('deleted_at', null)
      .order('occurred_at', { ascending: false });

    const { data, error } = result as {
      data: AcademicCalendarAudit[] | null;
      error: { message: string } | null;
    };

    if (error) {
      throw new Error(
        `Erro ao buscar auditoria por entidade: ${error.message}`,
      );
    }

    return data || [];
  }

  /**
   * Gera um novo correlation_id para operacoes em lote
   */
  generateCorrelationId(): string {
    return crypto.randomUUID();
  }

  /**
   * Helper para calcular campos alterados
   */
  calculateChangedFields(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): string[] {
    const changedFields: string[] = [];
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of allKeys) {
      // Ignora campos de auditoria
      if (
        ['created_at', 'updated_at', 'created_by', 'updated_by'].includes(key)
      ) {
        continue;
      }

      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changedFields.push(key);
      }
    }

    return changedFields;
  }

  /**
   * Helper para criar snapshot lean (apenas campos relevantes)
   */
  createLeanSnapshot(
    entity: Record<string, unknown>,
    fieldsToInclude?: string[],
  ): Record<string, unknown> {
    // Campos que sempre removemos do snapshot
    const excludeFields = [
      'created_at',
      'updated_at',
      'created_by',
      'updated_by',
      'deleted_at',
      'deleted_by',
      'tenant_id',
    ];

    const snapshot: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(entity)) {
      if (excludeFields.includes(key)) continue;
      if (fieldsToInclude && !fieldsToInclude.includes(key)) continue;
      snapshot[key] = value;
    }

    return snapshot;
  }
}
