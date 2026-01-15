import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import {
  TimelineEvent,
  TimelineSummary,
  TimelineFilters,
} from '../common/types';

@Injectable()
export class StudentTimelineService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Busca a linha do tempo completa do aluno agregando dados de múltiplas fontes
   */
  async getTimeline(
    studentId: string,
    tenantId: string,
    filters?: TimelineFilters,
  ): Promise<TimelineEvent[]> {
    // Verificar se aluno existe no tenant
    const { data: studentProfile } = await this.supabase
      .from('student_tenant_profiles')
      .select('student_id')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (!studentProfile) {
      throw new NotFoundException('Aluno não encontrado nesta organização');
    }

    // Buscar eventos de múltiplas fontes em paralelo
    const [enrollmentEvents, transferEvents, schoolProfiles] =
      await Promise.all([
        this.getEnrollmentEvents(studentId, tenantId, filters),
        this.getTransferEvents(studentId, tenantId, filters),
        this.getSchoolProfileEvents(studentId, tenantId, filters),
      ]);

    // Combinar e ordenar todos os eventos
    let allEvents = [...enrollmentEvents, ...transferEvents, ...schoolProfiles];

    // Ordenar por data (mais recente primeiro)
    allEvents.sort(
      (a, b) =>
        new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
    );

    // Aplicar limite se informado
    if (filters?.limit) {
      allEvents = allEvents.slice(0, filters.limit);
    }

    return allEvents;
  }

  /**
   * Busca resumo da timeline do aluno
   */
  async getTimelineSummary(
    studentId: string,
    tenantId: string,
  ): Promise<TimelineSummary> {
    const events = await this.getTimeline(studentId, tenantId);

    const byType: Record<string, number> = {};
    const bySchool: Record<string, number> = {};

    for (const event of events) {
      // Contar por tipo
      byType[event.event_type] = (byType[event.event_type] || 0) + 1;

      // Contar por escola
      if (event.school_id) {
        const schoolName = event.school_name || event.school_id;
        bySchool[schoolName] = (bySchool[schoolName] || 0) + 1;
      }
    }

    return {
      total_events: events.length,
      by_type: byType,
      by_school: bySchool,
      first_event_date:
        events.length > 0 ? events[events.length - 1].occurred_at : null,
      last_event_date: events.length > 0 ? events[0].occurred_at : null,
    };
  }

  /**
   * Busca eventos de enrollment (matrícula)
   */
  private async getEnrollmentEvents(
    studentId: string,
    tenantId: string,
    filters?: TimelineFilters,
  ): Promise<TimelineEvent[]> {
    // Primeiro, buscar as matrículas do aluno
    const { data: enrollments } = await this.supabase
      .from('enrollments')
      .select('id, school_id')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (!enrollments || enrollments.length === 0) {
      return [];
    }

    const enrollmentIds = enrollments.map((e) => e.id);

    // Buscar eventos dessas matrículas
    let query = this.supabase
      .from('enrollment_events')
      .select(
        `
        *,
        enrollments!inner (
          school_id,
          schools (name)
        )
      `,
      )
      .in('enrollment_id', enrollmentIds)
      .order('effective_at', { ascending: false });

    if (filters?.from_date) {
      query = query.gte('effective_at', filters.from_date);
    }

    if (filters?.to_date) {
      query = query.lte('effective_at', filters.to_date);
    }

    if (filters?.school_id) {
      query = query.eq('enrollments.school_id', filters.school_id);
    }

    if (filters?.event_types && filters.event_types.length > 0) {
      // Mapear tipos de timeline para tipos de enrollment_events
      const enrollmentEventTypes = filters.event_types
        .filter((t) =>
          [
            'enrollment_created',
            'enrollment_status_changed',
            'class_assigned',
            'class_changed',
            'transfer_requested',
            'transfer_completed',
          ].includes(t),
        )
        .map((t) => {
          switch (t) {
            case 'enrollment_created':
              return 'created';
            case 'enrollment_status_changed':
              return 'status_changed';
            case 'class_assigned':
            case 'class_changed':
              return 'class_membership_added';
            default:
              return t;
          }
        });

      if (enrollmentEventTypes.length > 0) {
        query = query.in('event_type', enrollmentEventTypes);
      }
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to get enrollment events: ${error.message}`,
        undefined,
        'StudentTimelineService',
      );
      return [];
    }

    // Mapear para TimelineEvent
    return (data || []).map((e: any) => this.mapEnrollmentEvent(e));
  }

  /**
   * Busca eventos de transferência
   */
  private async getTransferEvents(
    studentId: string,
    tenantId: string,
    filters?: TimelineFilters,
  ): Promise<TimelineEvent[]> {
    let query = this.supabase
      .from('transfer_cases')
      .select('*')
      .eq('student_id', studentId)
      .or(`from_tenant_id.eq.${tenantId},to_tenant_id.eq.${tenantId}`)
      .is('deleted_at', null)
      .order('requested_at', { ascending: false });

    if (filters?.from_date) {
      query = query.gte('requested_at', filters.from_date);
    }

    if (filters?.to_date) {
      query = query.lte('requested_at', filters.to_date);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to get transfer events: ${error.message}`,
        undefined,
        'StudentTimelineService',
      );
      return [];
    }

    // Mapear para TimelineEvents (pode gerar múltiplos eventos por transferência)
    const events: TimelineEvent[] = [];
    for (const transfer of data || []) {
      events.push(...this.mapTransferEvents(transfer, tenantId));
    }

    // Filtrar por tipos se informado
    if (filters?.event_types && filters.event_types.length > 0) {
      return events.filter((e) => filters.event_types!.includes(e.event_type));
    }

    return events;
  }

  /**
   * Busca eventos de perfil escolar (entrada/saída de escolas)
   */
  private async getSchoolProfileEvents(
    studentId: string,
    tenantId: string,
    filters?: TimelineFilters,
  ): Promise<TimelineEvent[]> {
    let query = this.supabase
      .from('student_school_profiles')
      .select(
        `
        *,
        schools (name)
      `,
      )
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (filters?.school_id) {
      query = query.eq('school_id', filters.school_id);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to get school profile events: ${error.message}`,
        undefined,
        'StudentTimelineService',
      );
      return [];
    }

    // Mapear para TimelineEvents
    const events: TimelineEvent[] = [];
    for (const profile of data || []) {
      events.push(...this.mapSchoolProfileEvents(profile, filters));
    }

    // Filtrar por tipos se informado
    if (filters?.event_types && filters.event_types.length > 0) {
      return events.filter((e) => filters.event_types!.includes(e.event_type));
    }

    return events;
  }

  // ============================================
  // Mappers
  // ============================================

  private mapEnrollmentEvent(event: any): TimelineEvent {
    const eventTypeMap: Record<string, string> = {
      created: 'enrollment_created',
      status_changed: 'enrollment_status_changed',
      class_membership_added: 'class_assigned',
      class_membership_closed: 'class_changed',
      transfer_requested: 'transfer_requested',
      transfer_completed: 'transfer_completed',
      left_school: 'school_left',
    };

    const descriptionMap: Record<string, string> = {
      created: 'Matrícula criada',
      status_changed: `Status alterado para ${event.metadata?.to_status || 'desconhecido'}`,
      class_membership_added: 'Turma atribuída',
      class_membership_closed: 'Mudança de turma',
      transfer_requested: 'Transferência solicitada',
      transfer_completed: 'Transferência concluída',
      left_school: 'Saída da escola',
    };

    return {
      id: event.id,
      event_type: eventTypeMap[event.event_type] || event.event_type,
      occurred_at: event.effective_at,
      actor_type: event.actor_type,
      actor_id: event.actor_id,
      description: descriptionMap[event.event_type] || event.event_type,
      school_id: event.enrollments?.school_id,
      school_name: event.enrollments?.schools?.name,
      metadata: event.metadata || {},
      source_table: 'enrollment_events',
      source_id: event.id,
    };
  }

  private mapTransferEvents(transfer: any, tenantId: string): TimelineEvent[] {
    const events: TimelineEvent[] = [];
    const isOutgoing = transfer.from_tenant_id === tenantId;

    // Evento de solicitação
    events.push({
      id: `${transfer.id}_requested`,
      event_type: 'transfer_requested',
      occurred_at: transfer.requested_at,
      actor_type: 'user',
      actor_id: transfer.created_by,
      description: isOutgoing
        ? 'Transferência solicitada (saída)'
        : 'Transferência recebida (entrada)',
      school_id: isOutgoing ? transfer.from_school_id : transfer.to_school_id,
      metadata: {
        transfer_id: transfer.id,
        from_tenant_id: transfer.from_tenant_id,
        to_tenant_id: transfer.to_tenant_id,
        direction: isOutgoing ? 'outgoing' : 'incoming',
      },
      source_table: 'transfer_cases',
      source_id: transfer.id,
    });

    // Evento de aprovação
    if (transfer.approved_at) {
      events.push({
        id: `${transfer.id}_approved`,
        event_type: 'transfer_approved',
        occurred_at: transfer.approved_at,
        actor_type: 'user',
        actor_id: null,
        description: 'Transferência aprovada',
        school_id: transfer.to_school_id,
        metadata: {
          transfer_id: transfer.id,
        },
        source_table: 'transfer_cases',
        source_id: transfer.id,
      });
    }

    // Evento de conclusão
    if (transfer.completed_at) {
      events.push({
        id: `${transfer.id}_completed`,
        event_type: 'transfer_completed',
        occurred_at: transfer.completed_at,
        actor_type: 'user',
        actor_id: null,
        description: 'Transferência concluída',
        school_id: transfer.to_school_id,
        metadata: {
          transfer_id: transfer.id,
          to_enrollment_id: transfer.to_enrollment_id,
        },
        source_table: 'transfer_cases',
        source_id: transfer.id,
      });
    }

    // Evento de rejeição
    if (transfer.status === 'rejected') {
      events.push({
        id: `${transfer.id}_rejected`,
        event_type: 'transfer_rejected',
        occurred_at: transfer.created_at,
        actor_type: 'user',
        actor_id: null,
        description: 'Transferência rejeitada',
        school_id: transfer.to_school_id,
        metadata: {
          transfer_id: transfer.id,
          reason: transfer.metadata?.rejection_reason,
        },
        source_table: 'transfer_cases',
        source_id: transfer.id,
      });
    }

    // Evento de cancelamento
    if (transfer.status === 'cancelled') {
      events.push({
        id: `${transfer.id}_cancelled`,
        event_type: 'transfer_cancelled',
        occurred_at: transfer.created_at,
        actor_type: 'user',
        actor_id: null,
        description: 'Transferência cancelada',
        metadata: {
          transfer_id: transfer.id,
          reason: transfer.metadata?.cancellation_reason,
        },
        source_table: 'transfer_cases',
        source_id: transfer.id,
      });
    }

    return events;
  }

  private mapSchoolProfileEvents(
    profile: any,
    filters?: TimelineFilters,
  ): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    // Evento de entrada na escola
    if (profile.entered_at) {
      const enteredAt = profile.entered_at;
      if (
        (!filters?.from_date || enteredAt >= filters.from_date) &&
        (!filters?.to_date || enteredAt <= filters.to_date)
      ) {
        events.push({
          id: `${profile.id}_entered`,
          event_type: 'school_entered',
          occurred_at: enteredAt,
          actor_type: 'system',
          actor_id: profile.created_by,
          description: `Entrada na escola ${profile.schools?.name || ''}`,
          school_id: profile.school_id,
          school_name: profile.schools?.name,
          metadata: {
            school_registration_code: profile.school_registration_code,
          },
          source_table: 'student_school_profiles',
          source_id: profile.id,
        });
      }
    }

    // Evento de saída da escola
    if (profile.left_at) {
      const leftAt = profile.left_at;
      if (
        (!filters?.from_date || leftAt >= filters.from_date) &&
        (!filters?.to_date || leftAt <= filters.to_date)
      ) {
        events.push({
          id: `${profile.id}_left`,
          event_type: 'school_left',
          occurred_at: leftAt,
          actor_type: 'system',
          actor_id: profile.updated_by,
          description: `Saída da escola ${profile.schools?.name || ''}`,
          school_id: profile.school_id,
          school_name: profile.schools?.name,
          metadata: {},
          source_table: 'student_school_profiles',
          source_id: profile.id,
        });
      }
    }

    return events;
  }
}
