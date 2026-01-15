/**
 * Types da Pré-Matrícula - Sprint 8
 * Interfaces para as 10 tabelas do módulo de pré-matrícula
 */

import {
  AuditFields,
  SoftDeleteFields,
  AIContextFields,
} from './academic.types';

// ============================================
// Status Types
// ============================================

export type PreEnrollmentFormTemplateStatus =
  | 'draft'
  | 'published'
  | 'archived';

export type PreEnrollmentHouseholdStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'needs_info'
  | 'approved'
  | 'rejected'
  | 'converted'
  | 'cancelled'
  | 'archived';

export type PreEnrollmentApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'needs_info'
  | 'approved'
  | 'rejected'
  | 'converted'
  | 'cancelled'
  | 'archived';

export type PreEnrollmentPersonRole = 'guardian' | 'student' | 'other';

export type PreEnrollmentPersonSex = 'male' | 'female' | 'other' | 'unknown';

export type PreEnrollmentRelationshipType =
  | 'pai'
  | 'mae'
  | 'responsavel_legal'
  | 'avo'
  | 'avoa'
  | 'tio'
  | 'tia'
  | 'outro';

export type PreEnrollmentAttachmentCategory =
  | 'birth_certificate'
  | 'id_document'
  | 'cpf'
  | 'proof_of_address'
  | 'photo'
  | 'vaccination_card'
  | 'medical_report'
  | 'other';

export type PreEnrollmentAttachmentUploadedByType =
  | 'public'
  | 'user'
  | 'system';

export type PreEnrollmentConsentType =
  | 'lgpd_data_processing'
  | 'terms_of_service'
  | 'privacy_policy'
  | 'communication_opt_in';

export type PreEnrollmentReviewType =
  | 'ai_intake'
  | 'ai_duplicate_check'
  | 'human_review'
  | 'system';

export type PreEnrollmentReviewActorType = 'ai' | 'user' | 'system';

export type PreEnrollmentEventType =
  | 'created'
  | 'updated'
  | 'submitted'
  | 'status_changed'
  | 'needs_info_requested'
  | 'approved'
  | 'rejected'
  | 'converted'
  | 'attachment_added'
  | 'comment_added';

export type PreEnrollmentEventActorType = 'public' | 'user' | 'ai' | 'system';

// ============================================
// Pre-Enrollment Form Templates
// ============================================

export interface PreEnrollmentFormTemplate
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  school_id: string | null;
  slug: string;
  name: string;
  version: number;
  status: PreEnrollmentFormTemplateStatus;
  schema: Record<string, unknown>;
  ui_schema: Record<string, unknown>;
  required_documents: unknown[];
  settings: Record<string, unknown>;
  published_at: string | null;
  metadata: Record<string, unknown>;
}

// ============================================
// Pre-Enrollment Households
// ============================================

export interface PreEnrollmentHousehold
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  school_id: string;
  site_id: string | null;
  status: PreEnrollmentHouseholdStatus;
  reference_code: string;
  public_token_hash: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  submitted_at: string | null;
  last_activity_at: string | null;
  household_payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

// ============================================
// Pre-Enrollment Applications
// ============================================

export interface PreEnrollmentApplication
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  school_id: string;
  site_id: string | null;
  household_id: string;
  form_template_id: string | null;
  form_template_version: number | null;
  academic_year_id: string | null;
  desired_grade_level_id: string | null;
  desired_shift_id: string | null;
  status: PreEnrollmentApplicationStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  decision_reason: string | null;
  admin_notes: string | null;
  applicant_notes: string | null;
  answers: Record<string, unknown>;
  tags: string[];
  ai_score: number | null;
  ai_missing_fields: unknown[];
  ai_flags: unknown[];
  metadata: Record<string, unknown>;
}

// ============================================
// Pre-Enrollment People
// ============================================

export interface PreEnrollmentPerson
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  household_id: string;
  application_id: string | null;
  role: PreEnrollmentPersonRole;
  sort_index: number;
  is_primary: boolean;
  full_name: string;
  preferred_name: string | null;
  birth_date: string | null;
  sex: PreEnrollmentPersonSex | null;
  documents: Record<string, unknown>;
  contacts: Record<string, unknown>;
  addresses: unknown[];
  notes: string | null;
  matched_person_id: string | null;
  metadata: Record<string, unknown>;
}

// ============================================
// Pre-Enrollment Relationships
// ============================================

export interface PreEnrollmentRelationship {
  id: string;
  tenant_id: string;
  application_id: string;
  student_person_id: string;
  guardian_person_id: string;
  relationship_type: PreEnrollmentRelationshipType;
  is_financial_responsible: boolean;
  is_emergency_contact: boolean;
  lives_with: boolean | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

// ============================================
// Pre-Enrollment Attachments
// ============================================

export interface PreEnrollmentAttachment {
  id: string;
  tenant_id: string;
  school_id: string;
  household_id: string;
  application_id: string | null;
  person_id: string | null;
  category: PreEnrollmentAttachmentCategory;
  file_path: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  checksum_sha256: string | null;
  uploaded_by_type: PreEnrollmentAttachmentUploadedByType;
  uploaded_by: string | null;
  uploaded_at: string;
  metadata: Record<string, unknown>;
}

// ============================================
// Pre-Enrollment Consents
// ============================================

export interface PreEnrollmentConsent {
  id: string;
  tenant_id: string;
  school_id: string;
  household_id: string;
  application_id: string | null;
  guardian_person_id: string | null;
  consent_type: PreEnrollmentConsentType;
  consented: boolean;
  consented_at: string;
  ip: string | null;
  user_agent: string | null;
  evidence: Record<string, unknown>;
}

// ============================================
// Pre-Enrollment Reviews
// ============================================

export interface PreEnrollmentReview {
  id: string;
  tenant_id: string;
  application_id: string;
  review_type: PreEnrollmentReviewType;
  score: number | null;
  missing_fields: unknown[];
  flags: unknown[];
  recommendations: unknown[];
  summary_markdown: string | null;
  structured_output: Record<string, unknown>;
  actor_type: PreEnrollmentReviewActorType;
  actor_id: string | null;
  created_at: string;
}

// ============================================
// Pre-Enrollment Events
// ============================================

export interface PreEnrollmentEvent {
  id: string;
  tenant_id: string;
  household_id: string;
  application_id: string | null;
  event_type: PreEnrollmentEventType;
  occurred_at: string;
  actor_type: PreEnrollmentEventActorType;
  actor_id: string | null;
  metadata: Record<string, unknown>;
}

// ============================================
// Pre-Enrollment Conversions
// ============================================

export interface PreEnrollmentConversion {
  id: string;
  tenant_id: string;
  household_id: string;
  application_id: string;
  converted_at: string;
  converted_by: string | null;
  family_id: string | null;
  student_id: string | null;
  enrollment_id: string | null;
  created_entities: Record<string, unknown>;
  notes: string | null;
}
