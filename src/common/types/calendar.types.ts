/**
 * Types de Calendário Escolar - Sprint 10
 */

import {
  AuditFields,
  SoftDeleteFields,
  AIContextFields,
  ActorType,
} from './base.types';

// ============================================
// Enums e Tipos Auxiliares
// ============================================

export type CalendarEventCategory =
  | 'academic'
  | 'holiday'
  | 'recess'
  | 'meeting'
  | 'event'
  | 'assessment'
  | 'other';

export type CalendarVisibility = 'internal' | 'guardian' | 'public';

export type CalendarDayKind = 'instructional' | 'non_instructional' | 'special';

export type CalendarStage =
  | 'infantil'
  | 'fundamental'
  | 'medio'
  | 'superior'
  | 'outro';

export type BlueprintStatus = 'draft' | 'published' | 'archived';

export type AcademicCalendarStatus = 'draft' | 'active' | 'locked' | 'archived';

export type CalendarScopeType =
  | 'school'
  | 'stage'
  | 'grade_level'
  | 'class_group';

// ============================================
// Tipos de Evento
// ============================================

export interface CalendarEventType extends AuditFields, SoftDeleteFields {
  id: string;
  tenant_id: string | null;
  slug: string;
  name: string;
  category: CalendarEventCategory;
  default_is_instructional: boolean;
  default_visibility: CalendarVisibility;
  is_system_type: boolean;
  description: string | null;
  metadata: Record<string, unknown>;
}

// ============================================
// Blueprints (Modelos de Calendário)
// ============================================

export interface CalendarBlueprint
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string | null;
  name: string;
  reference_year: number;
  jurisdiction_code: string | null;
  stage: CalendarStage;
  min_grade_order_index: number | null;
  max_grade_order_index: number | null;
  source_title: string | null;
  source_url: string | null;
  source_notes: string | null;
  status: BlueprintStatus;
  is_system_blueprint: boolean;
  version: number;
  metadata: Record<string, unknown>;
}

export interface CalendarBlueprintDay extends AuditFields, SoftDeleteFields {
  id: string;
  blueprint_id: string;
  day_date: string;
  day_kind: CalendarDayKind;
  is_instructional: boolean;
  label: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
}

export interface CalendarBlueprintEvent extends AuditFields, SoftDeleteFields {
  id: string;
  blueprint_id: string;
  event_type_id: string | null;
  title: string;
  start_date: string;
  end_date: string;
  is_all_day: boolean;
  affects_instruction: boolean;
  visibility: CalendarVisibility;
  grading_period_id: string | null;
  metadata: Record<string, unknown>;
}

// ============================================
// Calendários Acadêmicos (Efetivos)
// ============================================

export interface AcademicCalendar
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  school_id: string;
  academic_year_id: string;
  based_on_blueprint_id: string | null;
  name: string;
  scope_type: CalendarScopeType;
  stage: CalendarStage | null;
  grade_level_id: string | null;
  class_group_id: string | null;
  status: AcademicCalendarStatus;
  settings: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface AcademicCalendarDay extends AuditFields, SoftDeleteFields {
  id: string;
  calendar_id: string;
  day_date: string;
  day_kind: CalendarDayKind;
  is_instructional: boolean;
  source_blueprint_day_id: string | null;
  is_override: boolean;
  override_reason: string | null;
  label: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
}

export interface AcademicCalendarEvent extends AuditFields, SoftDeleteFields {
  id: string;
  calendar_id: string;
  event_type_id: string | null;
  title: string;
  start_date: string;
  end_date: string;
  is_all_day: boolean;
  affects_instruction: boolean;
  visibility: CalendarVisibility;
  grading_period_id: string | null;
  source_blueprint_event_id: string | null;
  is_override: boolean;
  override_reason: string | null;
  metadata: Record<string, unknown>;
}

// ============================================
// Auditoria Especializada
// ============================================

export type CalendarAuditEntityType =
  | 'academic_calendar'
  | 'academic_calendar_day'
  | 'academic_calendar_event'
  | 'calendar_blueprint'
  | 'calendar_blueprint_day'
  | 'calendar_blueprint_event';

export type CalendarAuditAction =
  // Calendário
  | 'calendar.created'
  | 'calendar.updated'
  | 'calendar.status_changed'
  // Dias
  | 'day.created'
  | 'day.updated'
  | 'day.deleted'
  // Eventos
  | 'event.created'
  | 'event.updated'
  | 'event.deleted'
  // Operações em lote
  | 'bulk.replicated_from_blueprint'
  | 'bulk.override_applied'
  | 'bulk.imported';

export interface AcademicCalendarAudit extends SoftDeleteFields {
  id: string;
  tenant_id: string;
  school_id: string;
  entity_type: CalendarAuditEntityType;
  entity_id: string;
  calendar_id: string | null;
  academic_year_id: string | null;
  day_date: string | null;
  start_date: string | null;
  end_date: string | null;
  action: CalendarAuditAction;
  summary: string;
  reason: string | null;
  reason_code: string | null;
  actor_type: ActorType;
  actor_user_id: string | null;
  correlation_id: string | null;
  occurred_at: string;
  changed_fields: string[];
  before_snapshot: Record<string, unknown>;
  after_snapshot: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
}

// ============================================
// Tipos com Relacionamentos
// ============================================

export interface CalendarBlueprintWithDetails extends CalendarBlueprint {
  days?: CalendarBlueprintDay[];
  events?: CalendarBlueprintEvent[];
  days_count?: number;
  events_count?: number;
  instructional_days_count?: number;
}

export interface AcademicCalendarWithDetails extends AcademicCalendar {
  days?: AcademicCalendarDay[];
  events?: AcademicCalendarEvent[];
  blueprint?: CalendarBlueprint;
  school?: SchoolRef;
  academic_year?: AcademicYearRef;
  days_count?: number;
  events_count?: number;
  instructional_days_count?: number;
}

export interface AcademicCalendarDayWithDetails extends AcademicCalendarDay {
  events?: AcademicCalendarEvent[];
  source_blueprint_day?: CalendarBlueprintDay;
}

export interface AcademicCalendarEventWithDetails extends AcademicCalendarEvent {
  event_type?: CalendarEventType;
  grading_period?: GradingPeriodRef;
  source_blueprint_event?: CalendarBlueprintEvent;
}

// Referências para evitar imports circulares
interface SchoolRef {
  id: string;
  name: string;
  slug: string | null;
}

interface AcademicYearRef {
  id: string;
  year: number;
  status: string;
}

interface GradingPeriodRef {
  id: string;
  name: string;
  period_type: string;
}
