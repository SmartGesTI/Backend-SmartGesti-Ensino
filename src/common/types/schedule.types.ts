/**
 * Types de Horários - Sprint 2
 */

import { AuditFields, SoftDeleteFields } from './base.types';

// ============================================
// Slots de Horário
// ============================================

export interface TimeSlot extends AuditFields, SoftDeleteFields {
  id: string;
  tenant_id: string;
  school_id: string;
  shift_id: string;
  label: string | null;
  slot_index: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

// ============================================
// Grade Semanal da Turma
// ============================================

export interface ClassGroupScheduleEntry extends SoftDeleteFields {
  id: string;
  tenant_id: string;
  school_id: string;
  class_group_id: string;
  day_of_week: number; // 1-7 (segunda a domingo)
  time_slot_id: string;
  class_group_subject_id: string;
  classroom_id: string | null;
  valid_from: string;
  valid_to: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
}

// ============================================
// Tipos com Relacionamentos
// ============================================

export interface TimeSlotWithShift extends TimeSlot {
  shift?: ShiftRef;
}

export interface ClassGroupScheduleEntryWithRelations extends ClassGroupScheduleEntry {
  time_slot?: TimeSlot;
  class_group_subject?: ClassGroupSubjectRef;
  classroom?: ClassroomRef;
}

// Referências para evitar imports circulares
interface ShiftRef {
  id: string;
  name: string;
  slug: string;
}

interface ClassGroupSubjectRef {
  id: string;
  subject_id: string;
  subject?: { name: string };
}

interface ClassroomRef {
  id: string;
  name: string;
  code: string | null;
}
