/**
 * Types de Frequência e Resultados - Sprint 2
 */

import { AuditFields, SoftDeleteFields, AIContextFields } from './base.types';

// ============================================
// Sessões de Chamada
// ============================================

export type AttendanceSessionStatus = 'open' | 'closed' | 'cancelled';

export interface AttendanceSession extends AuditFields, SoftDeleteFields {
  id: string;
  tenant_id: string;
  school_id: string;
  academic_year_id: string;
  class_group_id: string;
  class_group_subject_id: string;
  occurred_on: string;
  time_slot_id: string | null;
  conducted_by_staff_school_profile_id: string | null;
  status: AttendanceSessionStatus;
  notes: string | null;
  metadata: Record<string, unknown>;
}

// ============================================
// Presença por Aluno
// ============================================

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceRecord extends SoftDeleteFields {
  id: string;
  tenant_id: string;
  attendance_session_id: string;
  enrollment_id: string;
  attendance_status: AttendanceStatus;
  minutes_late: number | null;
  justification: string | null;
  recorded_at: string;
  recorded_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ============================================
// Resultados por Disciplina (Histórico)
// ============================================

export type StudentSubjectResultStatus =
  | 'in_progress'
  | 'approved'
  | 'reproved'
  | 'recovery'
  | 'exempt';

export interface StudentSubjectResult
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  school_id: string;
  academic_year_id: string;
  enrollment_id: string;
  subject_id: string;
  grading_period_id: string | null;
  final_score: number | null;
  final_concept: string | null;
  total_absences: number | null;
  result_status: StudentSubjectResultStatus;
  locked: boolean;
  computed_at: string | null;
  computed_by: string | null;
  computed_from: Record<string, unknown>;
  notes: string | null;
}

// ============================================
// Tipos com Relacionamentos
// ============================================

export interface AttendanceSessionWithRecords extends AttendanceSession {
  records?: AttendanceRecord[];
  class_group_subject?: ClassGroupSubjectRef;
  time_slot?: TimeSlotRef;
  conducted_by?: StaffRef;
}

export interface AttendanceRecordWithDetails extends AttendanceRecord {
  session?: AttendanceSession;
  enrollment?: EnrollmentRef;
}

export interface StudentSubjectResultWithDetails extends StudentSubjectResult {
  subject?: SubjectRef;
  enrollment?: EnrollmentRef;
  grading_period?: GradingPeriodRef;
}

// Referências para evitar imports circulares
interface ClassGroupSubjectRef {
  id: string;
  subject_id: string;
}

interface TimeSlotRef {
  id: string;
  label: string | null;
  start_time: string;
  end_time: string;
}

interface StaffRef {
  id: string;
  role_title: string | null;
}

interface EnrollmentRef {
  id: string;
  student_id: string;
  status: string;
}

interface SubjectRef {
  id: string;
  name: string;
  slug: string;
}

interface GradingPeriodRef {
  id: string;
  name: string;
  period_type: string;
}
