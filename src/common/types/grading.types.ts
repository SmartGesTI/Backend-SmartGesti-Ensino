/**
 * Types de Avaliações e Notas - Sprint 2
 */

import { AuditFields, SoftDeleteFields, AIContextFields } from './base.types';

// ============================================
// Períodos de Nota
// ============================================

export type GradingPeriodType =
  | 'bimester'
  | 'trimester'
  | 'semester'
  | 'custom';

export interface GradingPeriod
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  school_id: string;
  academic_year_id: string;
  name: string;
  period_type: GradingPeriodType;
  order_index: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  closed_at: string | null;
  closed_by: string | null;
  metadata: Record<string, unknown>;
}

// ============================================
// Avaliações
// ============================================

export type AssessmentType =
  | 'exam'
  | 'assignment'
  | 'project'
  | 'quiz'
  | 'participation'
  | 'other';

export interface Assessment
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  school_id: string;
  academic_year_id: string;
  class_group_subject_id: string;
  grading_period_id: string | null;
  name: string;
  assessment_type: AssessmentType;
  weight: number;
  max_score: number;
  scheduled_on: string | null;
  due_on: string | null;
  is_published: boolean;
  description: string | null;
  settings: Record<string, unknown>;
}

// ============================================
// Notas por Aluno
// ============================================

export type AssessmentScoreStatus = 'graded' | 'missing' | 'exempt' | 'pending';

export interface AssessmentScore extends AuditFields, SoftDeleteFields {
  id: string;
  tenant_id: string;
  assessment_id: string;
  enrollment_id: string;
  score: number | null;
  status: AssessmentScoreStatus;
  attempt_number: number;
  submitted_at: string | null;
  graded_at: string | null;
  graded_by_staff_school_profile_id: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
}

// ============================================
// Tipos com Relacionamentos
// ============================================

export interface GradingPeriodWithStats extends GradingPeriod {
  assessments_count?: number;
  average_score?: number;
}

export interface AssessmentWithScores extends Assessment {
  scores?: AssessmentScore[];
  class_group_subject?: ClassGroupSubjectRef;
  grading_period?: GradingPeriod;
}

export interface AssessmentScoreWithDetails extends AssessmentScore {
  assessment?: Assessment;
  enrollment?: EnrollmentRef;
  graded_by?: StaffRef;
}

// Referências para evitar imports circulares
interface ClassGroupSubjectRef {
  id: string;
  subject_id: string;
  class_group_id: string;
}

interface EnrollmentRef {
  id: string;
  student_id: string;
  status: string;
}

interface StaffRef {
  id: string;
  role_title: string | null;
}
