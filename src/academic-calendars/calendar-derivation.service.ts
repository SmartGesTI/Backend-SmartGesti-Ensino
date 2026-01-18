/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type {
  AcademicCalendar,
  AcademicCalendarDay,
  AcademicCalendarEvent,
  CalendarEventType,
  CalendarDayKind,
  CalendarEventCategory,
} from '../common/types';

export type DayComputedSource = 'override_day' | 'event' | 'weekend' | 'default';

export interface DayEventSummary {
  id: string;
  title: string;
  color: string;
  category: CalendarEventCategory;
  visibility: 'internal' | 'guardian' | 'public';
  is_all_day: boolean;
}

export interface DayComputed {
  date: string;
  day_kind: CalendarDayKind;
  is_instructional: boolean;
  labels: string[];
  events: DayEventSummary[];
  source: DayComputedSource;
  has_override: boolean;
}

export interface DerivedDaysResponse {
  calendar: AcademicCalendar;
  days: DayComputed[];
  events: AcademicCalendarEvent[];
}

interface CalendarSettings {
  weekend_policy?: {
    saturday: 'instructional' | 'non_instructional' | 'special';
    sunday: 'instructional' | 'non_instructional' | 'special';
  };
  instruction_policy?: {
    default_day_kind: CalendarDayKind;
    affects_instruction_categories: CalendarEventCategory[];
  };
}

// Cores hex por categoria
const CATEGORY_COLORS: Record<CalendarEventCategory, string> = {
  holiday: '#fee2e2',
  recess: '#dbeafe',
  assessment: '#f3e8ff',
  meeting: '#dcfce7',
  academic: '#fef3c7',
  event: '#cffafe',
  other: '#f3f4f6',
};

@Injectable()
export class CalendarDerivationService {
  constructor(private supabase: SupabaseService) {}

  /**
   * Deriva os dias computados para um calendario em um range de datas
   */
  async deriveDays(
    calendar: AcademicCalendar,
    startDate: string,
    endDate: string,
  ): Promise<DerivedDaysResponse> {
    // Buscar overrides (dias com alteracao manual)
    const overrides = await this.getOverrides(calendar.id, startDate, endDate);

    // Buscar eventos do periodo
    const events = await this.getEventsInRange(calendar.id, startDate, endDate);

    // Buscar tipos de eventos para lookup
    const eventTypes = await this.getEventTypes(calendar.tenant_id);
    const eventTypesMap = new Map(eventTypes.map((t) => [t.id, t]));

    // Enriquecer eventos com tipos
    const enrichedEvents = events.map((e) => ({
      ...e,
      event_type: e.event_type_id ? eventTypesMap.get(e.event_type_id) : undefined,
    }));

    // Criar mapa de overrides por data
    const overridesMap = new Map(overrides.map((o) => [o.day_date, o]));

    // Criar mapa de eventos por data
    const eventsByDate = new Map<string, typeof enrichedEvents>();
    for (const event of enrichedEvents) {
      const dates = this.getDatesBetween(event.start_date, event.end_date);
      for (const date of dates) {
        if (!eventsByDate.has(date)) {
          eventsByDate.set(date, []);
        }
        eventsByDate.get(date)!.push(event);
      }
    }

    // Gerar dias derivados
    const dates = this.getDatesBetween(startDate, endDate);
    const settings = (calendar.settings as CalendarSettings) || {};
    const days: DayComputed[] = [];

    for (const dateStr of dates) {
      const computed = this.deriveDayKind(
        dateStr,
        settings,
        overridesMap.get(dateStr),
        eventsByDate.get(dateStr) || [],
      );
      days.push(computed);
    }

    return {
      calendar,
      days,
      events: enrichedEvents,
    };
  }

  /**
   * Deriva o status de um dia especifico seguindo a hierarquia:
   * 1. Override do dia SEMPRE ganha
   * 2. Evento com affects_instruction definido
   * 3. Settings define categorias elegiveis
   * 4. Tipo (default_is_instructional) como fallback
   * 5. Weekend policy
   * 6. Default
   */
  private deriveDayKind(
    dateStr: string,
    settings: CalendarSettings,
    override: AcademicCalendarDay | undefined,
    events: Array<AcademicCalendarEvent & { event_type?: CalendarEventType }>,
  ): DayComputed {
    const date = new Date(dateStr + 'T12:00:00Z');
    const dayOfWeek = date.getUTCDay();
    const labels: string[] = [];

    // Preparar resumo de eventos
    const eventSummaries: DayEventSummary[] = events.map((e) => ({
      id: e.id,
      title: e.title,
      color: e.event_type?.category
        ? CATEGORY_COLORS[e.event_type.category as CalendarEventCategory]
        : CATEGORY_COLORS.other,
      category: (e.event_type?.category as CalendarEventCategory) || 'other',
      visibility: e.visibility,
      is_all_day: e.is_all_day,
    }));

    // 1. Override do dia SEMPRE ganha
    if (override) {
      if (override.label) labels.push(override.label);
      return {
        date: dateStr,
        day_kind: override.day_kind,
        is_instructional: override.is_instructional,
        labels,
        events: eventSummaries,
        source: 'override_day',
        has_override: true,
      };
    }

    // 2. Evento com affects_instruction explicitamente definido
    const forcingEvent = events.find(
      (e) => e.affects_instruction !== null && e.affects_instruction !== undefined,
    );
    if (forcingEvent) {
      const isInstructional = forcingEvent.affects_instruction === true;
      labels.push(forcingEvent.title);
      return {
        date: dateStr,
        day_kind: isInstructional ? 'instructional' : 'non_instructional',
        is_instructional: isInstructional,
        labels,
        events: eventSummaries,
        source: 'event',
        has_override: false,
      };
    }

    // 3. Settings define categorias elegiveis para afetar letividade
    const eligibleCategories =
      settings.instruction_policy?.affects_instruction_categories || [
        'holiday',
        'recess',
      ];

    const eligibleEvent = events.find(
      (e) =>
        e.event_type?.category &&
        eligibleCategories.includes(e.event_type.category as CalendarEventCategory),
    );

    if (eligibleEvent) {
      // 4. Tipo (default_is_instructional) como fallback
      const eventType = eligibleEvent.event_type;
      const isInstructional = eventType?.default_is_instructional ?? true;
      labels.push(eligibleEvent.title);
      return {
        date: dateStr,
        day_kind: isInstructional ? 'instructional' : 'non_instructional',
        is_instructional: isInstructional,
        labels,
        events: eventSummaries,
        source: 'event',
        has_override: false,
      };
    }

    // 5. Weekend policy
    const weekendPolicy = settings.weekend_policy || {
      saturday: 'non_instructional',
      sunday: 'non_instructional',
    };

    if (dayOfWeek === 0) {
      // Domingo
      const sundayKind = weekendPolicy.sunday || 'non_instructional';
      return {
        date: dateStr,
        day_kind: sundayKind,
        is_instructional: sundayKind === 'instructional',
        labels: sundayKind === 'non_instructional' ? ['Domingo'] : [],
        events: eventSummaries,
        source: 'weekend',
        has_override: false,
      };
    }

    if (dayOfWeek === 6) {
      // Sabado
      const saturdayKind = weekendPolicy.saturday || 'non_instructional';
      return {
        date: dateStr,
        day_kind: saturdayKind,
        is_instructional: saturdayKind === 'instructional',
        labels: saturdayKind === 'non_instructional' ? ['Sabado'] : [],
        events: eventSummaries,
        source: 'weekend',
        has_override: false,
      };
    }

    // 6. Default
    const defaultKind = settings.instruction_policy?.default_day_kind || 'instructional';
    return {
      date: dateStr,
      day_kind: defaultKind,
      is_instructional: defaultKind === 'instructional',
      labels,
      events: eventSummaries,
      source: 'default',
      has_override: false,
    };
  }

  /**
   * Busca overrides (dias com alteracao manual) em um range
   */
  private async getOverrides(
    calendarId: string,
    startDate: string,
    endDate: string,
  ): Promise<AcademicCalendarDay[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('academic_calendar_days')
      .select('*')
      .eq('calendar_id', calendarId)
      .gte('day_date', startDate)
      .lte('day_date', endDate)
      .is('deleted_at', null);

    if (error) {
      throw new Error(`Erro ao buscar overrides: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Busca eventos que se sobrepoem a um range
   */
  private async getEventsInRange(
    calendarId: string,
    startDate: string,
    endDate: string,
  ): Promise<AcademicCalendarEvent[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('academic_calendar_events')
      .select('*')
      .eq('calendar_id', calendarId)
      .lte('start_date', endDate)
      .gte('end_date', startDate)
      .is('deleted_at', null)
      .order('start_date');

    if (error) {
      throw new Error(`Erro ao buscar eventos: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Busca tipos de eventos do tenant
   */
  private async getEventTypes(tenantId: string): Promise<CalendarEventType[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('calendar_event_types')
      .select('*')
      .or(`tenant_id.eq.${tenantId},is_system_type.eq.true`)
      .is('deleted_at', null);

    if (error) {
      throw new Error(`Erro ao buscar tipos de eventos: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Retorna array de datas entre start e end (inclusive)
   */
  private getDatesBetween(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const current = new Date(startDate + 'T12:00:00Z');
    const end = new Date(endDate + 'T12:00:00Z');

    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return dates;
  }
}
