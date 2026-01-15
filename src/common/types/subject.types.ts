/**
 * Types de Disciplinas - Sprint 2
 */

import { AuditFields, SoftDeleteFields, AIContextFields } from './base.types';

// ============================================
// Catálogo de Disciplinas
// ============================================

export type SubjectStage =
  | 'infantil'
  | 'fundamental'
  | 'medio'
  | 'superior'
  | 'outro';

export interface Subject
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  code: string | null;
  stage: SubjectStage;
  is_active: boolean;
  metadata: Record<string, unknown>;
}

// ============================================
// Disciplina por Turma (Pivô Central)
// ============================================

export interface ClassGroupSubject
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  school_id: string;
  academic_year_id: string;
  class_group_id: string;
  subject_id: string;
  primary_staff_school_profile_id: string | null;
  is_active: boolean;
  weekly_classes: number | null;
  metadata: Record<string, unknown>;
}

// ============================================
// Tipos com Relacionamentos
// ============================================

export interface SubjectWithCurriculum extends Subject {
  curriculum_subjects?: CurriculumSubjectRef[];
}

export interface ClassGroupSubjectWithRelations extends ClassGroupSubject {
  subject?: Subject;
  staff_profile?: StaffSchoolProfileRef;
  class_group?: ClassGroupRef;
}

// Referências para evitar imports circulares
interface CurriculumSubjectRef {
  id: string;
  curriculum_id: string;
  subject_id: string;
  is_mandatory: boolean;
  order_index: number;
}

interface StaffSchoolProfileRef {
  id: string;
  staff_member_id: string;
  role_title: string | null;
}

interface ClassGroupRef {
  id: string;
  code: string;
  name: string | null;
}
