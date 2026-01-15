/**
 * Types de Currículo - Sprint 2
 */

import { AuditFields, SoftDeleteFields, AIContextFields } from './base.types';

// ============================================
// Currículo
// ============================================

export type CurriculumStatus = 'draft' | 'active' | 'archived';

export interface Curriculum
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  school_id: string;
  academic_year_id: string;
  grade_level_id: string;
  name: string;
  version: number;
  status: CurriculumStatus;
  description: string | null;
  metadata: Record<string, unknown>;
}

// ============================================
// Disciplinas do Currículo
// ============================================

export interface CurriculumSubject
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  curriculum_id: string;
  subject_id: string;
  is_mandatory: boolean;
  order_index: number;
  yearly_minutes: number | null;
  weekly_classes: number | null;
  rules: Record<string, unknown>;
  notes: string | null;
}

// ============================================
// Tipos com Relacionamentos
// ============================================

export interface CurriculumWithSubjects extends Curriculum {
  subjects?: CurriculumSubject[];
  grade_level?: GradeLevelRef;
  academic_year?: AcademicYearRef;
}

export interface CurriculumSubjectWithDetails extends CurriculumSubject {
  subject?: SubjectRef;
  curriculum?: Curriculum;
}

// Referências para evitar imports circulares
interface GradeLevelRef {
  id: string;
  name: string;
  slug: string;
  stage: string;
}

interface AcademicYearRef {
  id: string;
  year: number;
  status: string;
}

interface SubjectRef {
  id: string;
  name: string;
  slug: string;
  code: string | null;
}
