/**
 * Types do Core Acadêmico - Sprint 1
 * Interfaces para todas as 17 tabelas do módulo acadêmico
 */

// ============================================
// Base Types
// ============================================

export interface AuditFields {
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface SoftDeleteFields {
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface AIContextFields {
  ai_context: Record<string, unknown>;
  ai_summary: string | null;
}

// ============================================
// Fase 1: Identidade Global
// ============================================

export interface Person extends AuditFields, SoftDeleteFields {
  id: string;
  full_name: string;
  preferred_name: string | null;
  birth_date: string | null;
  sex: 'M' | 'F' | 'O' | 'N' | null;
}

export interface PersonDocument extends AuditFields, SoftDeleteFields {
  id: string;
  person_id: string;
  doc_type: 'cpf' | 'rg' | 'passport' | 'other';
  doc_value: string;
  issuer: string | null;
  state: string | null;
  country_code: string | null;
  is_primary: boolean;
  verified_at: string | null;
  verified_by: string | null;
}

// ============================================
// Fase 2: Alunos
// ============================================

export interface Student extends AuditFields, SoftDeleteFields {
  id: string;
  person_id: string;
  global_status: 'active' | 'inactive';
}

export interface StudentTenantProfile
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  student_id: string;
  status: 'active' | 'inactive' | 'blocked';
  tenant_registration_code: string | null;
  external_id: string | null;
  notes: string | null;
}

export interface StudentSchoolProfile
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  school_id: string;
  student_id: string;
  school_registration_code: string | null;
  status: 'active' | 'inactive' | 'blocked';
  entered_at: string | null;
  left_at: string | null;
}

// ============================================
// Fase 3: Catálogos
// ============================================

export interface GradeLevel
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  stage: 'infantil' | 'fundamental' | 'medio' | 'superior' | 'outro';
  order_index: number;
  is_active: boolean;
}

export interface Shift extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean;
}

export interface Classroom
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  school_id: string;
  name: string;
  code: string | null;
  capacity: number | null;
  location: string | null;
  is_active: boolean;
}

// ============================================
// Fase 4: Estrutura Acadêmica
// ============================================

export interface AcademicYear
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  school_id: string;
  year: number;
  start_date: string;
  end_date: string;
  status: 'planning' | 'active' | 'closed';
  closed_at: string | null;
  closed_by: string | null;
}

export interface ClassGroup
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  school_id: string;
  academic_year_id: string;
  grade_level_id: string;
  shift_id: string;
  code: string;
  name: string | null;
  capacity: number | null;
  is_active: boolean;
  // Sprint 2 additions
  curriculum_id: string | null;
  homeroom_staff_school_profile_id: string | null;
}

export interface ClassGroupRoomAllocation extends SoftDeleteFields {
  id: string;
  tenant_id: string;
  class_group_id: string;
  classroom_id: string;
  valid_from: string;
  valid_to: string | null;
  created_at: string;
  created_by: string | null;
}

// ============================================
// Fase 5: Matrículas
// ============================================

export interface Enrollment
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  school_id: string;
  academic_year_id: string;
  student_id: string;
  enrolled_at: string;
  left_at: string | null;
  status: 'active' | 'transferred' | 'withdrawn' | 'completed';
  notes: string | null;
}

export interface EnrollmentClassMembership extends SoftDeleteFields {
  id: string;
  tenant_id: string;
  enrollment_id: string;
  class_group_id: string;
  valid_from: string;
  valid_to: string | null;
  reason: string | null;
  created_at: string;
  created_by: string | null;
}

// ============================================
// Fase 6: Eventos (Ledgers)
// ============================================

export type EnrollmentEventType =
  | 'created'
  | 'status_changed'
  | 'class_membership_added'
  | 'class_membership_closed'
  | 'transfer_requested'
  | 'transfer_completed'
  | 'left_school';

export type ActorType = 'user' | 'ai' | 'system';

export interface EnrollmentEvent {
  id: string;
  tenant_id: string;
  enrollment_id: string;
  event_type: EnrollmentEventType;
  effective_at: string;
  actor_type: ActorType;
  actor_id: string | null;
  from_class_group_id: string | null;
  to_class_group_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface StudentAcademicEvent {
  id: string;
  tenant_id: string;
  school_id: string | null;
  student_id: string;
  event_type: string;
  occurred_at: string;
  actor_type: ActorType;
  actor_id: string | null;
  subject_entity_type: string | null;
  subject_entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ============================================
// Fase 7: Transferências e RAG
// ============================================

export type TransferStatus =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'cancelled';

export interface TransferCase extends SoftDeleteFields {
  id: string;
  student_id: string;
  from_tenant_id: string;
  from_school_id: string | null;
  to_tenant_id: string;
  to_school_id: string | null;
  status: TransferStatus;
  requested_at: string;
  approved_at: string | null;
  completed_at: string | null;
  from_enrollment_id: string | null;
  to_enrollment_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
  // Sprint 4 additions
  snapshot_id: string | null;
  data_share_id: string | null;
}

export interface RagEntityLink extends SoftDeleteFields {
  id: string;
  tenant_id: string;
  school_id: string | null;
  entity_type: string;
  entity_id: string;
  document_id: string;
  relevance: number;
  metadata: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
}

// ============================================
// Tipos auxiliares para queries
// ============================================

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Tipo para Person com documentos
export interface PersonWithDocuments extends Person {
  documents?: PersonDocument[];
}

// Tipo para Student com perfis
export interface StudentWithProfiles extends Student {
  person?: Person;
  tenant_profile?: StudentTenantProfile;
  school_profiles?: StudentSchoolProfile[];
}

// Tipo para ClassGroup com relacionamentos
export interface ClassGroupWithRelations extends ClassGroup {
  academic_year?: AcademicYear;
  grade_level?: GradeLevel;
  shift?: Shift;
  room_allocations?: ClassGroupRoomAllocation[];
  // Sprint 2 additions
  curriculum?: Curriculum;
  homeroom_staff?: StaffSchoolProfile;
}

// Tipo para Enrollment com relacionamentos
export interface EnrollmentWithRelations extends Enrollment {
  student?: StudentWithProfiles;
  academic_year?: AcademicYear;
  class_memberships?: EnrollmentClassMembership[];
}

// ============================================
// Fase 6: Timeline Types
// ============================================

export type TimelineEventType =
  | 'enrollment_created'
  | 'enrollment_status_changed'
  | 'class_assigned'
  | 'class_changed'
  | 'transfer_requested'
  | 'transfer_approved'
  | 'transfer_rejected'
  | 'transfer_completed'
  | 'transfer_cancelled'
  | 'school_entered'
  | 'school_left'
  | 'profile_created'
  | 'profile_updated';

export interface TimelineEvent {
  id: string;
  event_type: TimelineEventType;
  occurred_at: string;
  actor_type: ActorType;
  actor_id: string | null;
  actor_name?: string;
  description: string;
  school_id?: string;
  school_name?: string;
  metadata: Record<string, unknown>;
  source_table: string;
  source_id: string;
}

export interface TimelineSummary {
  total_events: number;
  by_type: Record<string, number>;
  by_school: Record<string, number>;
  first_event_date: string | null;
  last_event_date: string | null;
}

export interface TimelineFilters {
  from_date?: string;
  to_date?: string;
  event_types?: string[];
  school_id?: string;
  limit?: number;
}

// ============================================
// Sprint 2: Core Pedagógico
// ============================================

// --- Catálogo de Disciplinas ---

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

// --- Staff/Funcionários ---

export type StaffType =
  | 'teacher'
  | 'coordinator'
  | 'admin'
  | 'support'
  | 'other';
export type StaffStatus = 'active' | 'inactive' | 'terminated';

export interface StaffMember
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  person_id: string;
  user_id: string | null;
  staff_type: StaffType;
  status: StaffStatus;
  hired_at: string | null;
  terminated_at: string | null;
  notes: string | null;
}

export type StaffSchoolProfileStatus = 'active' | 'inactive' | 'left';

export interface StaffSchoolProfile
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  school_id: string;
  staff_member_id: string;
  role_title: string | null;
  employee_code: string | null;
  status: StaffSchoolProfileStatus;
  joined_at: string;
  left_at: string | null;
  metadata: Record<string, unknown>;
}

// --- Currículo ---

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

// --- Disciplina por Turma (Pivô Central) ---

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

// --- Horários ---

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

export interface ClassGroupScheduleEntry extends SoftDeleteFields {
  id: string;
  tenant_id: string;
  school_id: string;
  class_group_id: string;
  day_of_week: number; // 1-7
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

// --- Períodos de Nota ---

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

// --- Avaliações e Notas ---

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

// --- Frequência ---

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

// --- Resultados por Disciplina (Histórico) ---

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

// --- Audit Events ---

export type AuditOperation = 'insert' | 'update' | 'soft_delete' | 'restore';

export interface AuditEvent {
  id: string;
  tenant_id: string;
  school_id: string | null;
  entity_table: string;
  entity_id: string;
  operation: AuditOperation;
  occurred_at: string;
  actor_type: ActorType;
  actor_user_id: string | null;
  correlation_id: string | null;
  before_data: Record<string, unknown>;
  after_data: Record<string, unknown>;
  diff: Record<string, unknown>;
  reason: string | null;
  metadata: Record<string, unknown>;
}

// --- Tipos com Relacionamentos (Sprint 2) ---

export interface SubjectWithCurriculum extends Subject {
  curriculum_subjects?: CurriculumSubject[];
}

export interface StaffMemberWithProfiles extends StaffMember {
  person?: Person;
  school_profiles?: StaffSchoolProfile[];
}

export interface CurriculumWithSubjects extends Curriculum {
  subjects?: CurriculumSubject[];
  grade_level?: GradeLevel;
  academic_year?: AcademicYear;
}

// Alias para manter compatibilidade (tabela renomeada de curricula para curriculum)
export type Curricula = Curriculum;

export interface ClassGroupSubjectWithRelations extends ClassGroupSubject {
  subject?: Subject;
  staff_profile?: StaffSchoolProfile;
  class_group?: ClassGroup;
}

export interface AssessmentWithScores extends Assessment {
  scores?: AssessmentScore[];
  class_group_subject?: ClassGroupSubject;
  grading_period?: GradingPeriod;
}

export interface AttendanceSessionWithRecords extends AttendanceSession {
  records?: AttendanceRecord[];
  class_group_subject?: ClassGroupSubject;
  time_slot?: TimeSlot;
}

// ============================================
// Sprint 3: Responsáveis, Família, Endereços, Contatos e Consentimentos
// ============================================

// --- Responsáveis (Guardians) ---

export type GuardianStatus = 'active' | 'inactive';

export interface Guardian extends AuditFields, SoftDeleteFields {
  id: string;
  person_id: string;
  global_status: GuardianStatus;
}

export type GuardianTenantProfileStatus = 'active' | 'inactive' | 'blocked';

export interface GuardianTenantProfile
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  guardian_id: string;
  status: GuardianTenantProfileStatus;
  external_id: string | null;
  notes: string | null;
}

// --- Família (Family/Household) ---

export type FamilyStatus = 'active' | 'inactive';

export interface Family extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  name: string;
  status: FamilyStatus;
  metadata: Record<string, unknown>;
}

export type FamilyMemberRole = 'guardian' | 'student' | 'other';

export interface FamilyMember extends SoftDeleteFields {
  id: string;
  tenant_id: string;
  family_id: string;
  person_id: string;
  member_role: FamilyMemberRole;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

// --- Relação Aluno-Responsável ---

export type GuardianRelationship =
  | 'father'
  | 'mother'
  | 'legal_guardian'
  | 'stepfather'
  | 'stepmother'
  | 'grandparent'
  | 'sibling'
  | 'tutor'
  | 'other';

export type CustodyType = 'full' | 'shared' | 'none' | 'unknown';

export interface StudentGuardianLink
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  student_id: string;
  guardian_id: string;
  relationship: GuardianRelationship;
  custody_type: CustodyType;
  financial_responsible: boolean;
  pickup_allowed: boolean;
  is_primary_contact: boolean;
  contact_priority: number;
  notes: string | null;
  metadata: Record<string, unknown>;
}

// --- Endereços ---

export interface Address {
  id: string;
  country_code: string;
  postal_code: string | null;
  state: string | null;
  city: string | null;
  district: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  reference: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type AddressType = 'residential' | 'commercial' | 'billing' | 'other';

export interface PersonAddress extends SoftDeleteFields {
  id: string;
  person_id: string;
  address_id: string;
  address_type: AddressType;
  is_primary: boolean;
  valid_from: string;
  valid_to: string | null;
  created_at: string;
  created_by: string | null;
}

// --- Contatos ---

export type ContactType = 'email' | 'phone' | 'whatsapp' | 'other';

export interface PersonContact extends AuditFields, SoftDeleteFields {
  id: string;
  person_id: string;
  contact_type: ContactType;
  value: string;
  label: string | null;
  is_primary: boolean;
  verified_at: string | null;
  verified_by: string | null;
}

// --- Consentimentos (LGPD) ---

export type ConsentType =
  | 'data_processing'
  | 'data_sharing'
  | 'communication'
  | 'media_use'
  | 'pickup_authorization';

export type ConsentStatus = 'active' | 'revoked';

export interface Consent extends SoftDeleteFields {
  id: string;
  tenant_id: string;
  school_id: string | null;
  guardian_id: string | null;
  student_id: string | null;
  consent_type: ConsentType;
  scope: Record<string, unknown>;
  given_at: string;
  revoked_at: string | null;
  status: ConsentStatus;
  created_at: string;
  created_by: string | null;
}

// --- Tipos com Relacionamentos (Sprint 3) ---

export interface GuardianWithProfiles extends Guardian {
  person?: Person;
  tenant_profiles?: GuardianTenantProfile[];
}

export interface FamilyWithMembers extends Family {
  members?: FamilyMember[];
}

export interface StudentGuardianLinkWithDetails extends StudentGuardianLink {
  student?: Student;
  guardian?: GuardianWithProfiles;
}

export interface PersonWithAddresses extends Person {
  addresses?: (PersonAddress & { address?: Address })[];
}

export interface PersonWithContacts extends Person {
  contacts?: PersonContact[];
}

export interface PersonComplete extends Person {
  documents?: PersonDocument[];
  addresses?: (PersonAddress & { address?: Address })[];
  contacts?: PersonContact[];
}

// ============================================
// Sprint 4: Histórico Oficial Imutável + Portabilidade Segura
// ============================================

// --- Academic Record Snapshots ---

export type SnapshotKind =
  | 'academic_year'
  | 'as_of'
  | 'full_history'
  | 'transfer_packet'
  | 'custom';
export type SnapshotStatus = 'active' | 'superseded' | 'revoked';
export type SnapshotSourceType =
  | 'system'
  | 'manual'
  | 'year_close'
  | 'transfer';

export interface AcademicRecordSnapshot
  extends SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  school_id: string | null;
  student_id: string;
  kind: SnapshotKind;
  academic_year_id: string | null;
  as_of_at: string;
  version: number;
  is_final: boolean;
  status: SnapshotStatus;
  payload: Record<string, unknown>;
  payload_schema_version: number;
  payload_hash: string;
  hash_algo: string;
  hash_encoding: string;
  source_type: SnapshotSourceType;
  source_transfer_case_id: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
}

// --- Data Shares ---

export type DataShareStatus = 'active' | 'revoked' | 'expired' | 'consumed';

export interface DataShare extends SoftDeleteFields, AIContextFields {
  id: string;
  source_tenant_id: string;
  source_school_id: string | null;
  target_tenant_id: string | null;
  target_school_id: string | null;
  snapshot_id: string;
  consent_id: string | null;
  purpose: string | null;
  scope: Record<string, unknown>;
  status: DataShareStatus;
  expires_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  max_accesses: number;
  access_count: number;
  first_accessed_at: string | null;
  last_accessed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
}

// --- Data Share Tokens ---

export type DataShareTokenStatus =
  | 'active'
  | 'revoked'
  | 'expired'
  | 'consumed';

export interface DataShareToken extends SoftDeleteFields {
  id: string;
  data_share_id: string;
  token_hash: string;
  hash_algo: string;
  hash_encoding: string;
  token_hint: string | null;
  status: DataShareTokenStatus;
  expires_at: string | null;
  max_uses: number;
  uses_count: number;
  last_used_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
}

// --- Data Share Access Logs ---

export type DataShareAccessAction = 'read' | 'import' | 'validate';
export type DataShareAccessResult =
  | 'allowed'
  | 'denied'
  | 'expired'
  | 'revoked'
  | 'consumed';

export interface DataShareAccessLog {
  id: string;
  data_share_id: string;
  token_id: string | null;
  requester_user_id: string | null;
  requester_tenant_id: string | null;
  requester_ip: string | null;
  requester_user_agent: string | null;
  action: DataShareAccessAction;
  result: DataShareAccessResult;
  details: Record<string, unknown>;
  created_at: string;
}

// --- Tipos com Relacionamentos (Sprint 4) ---

export interface AcademicRecordSnapshotWithRelations extends AcademicRecordSnapshot {
  student?: Student;
  academic_year?: AcademicYear;
  transfer_case?: TransferCase;
}

export interface DataShareWithRelations extends DataShare {
  snapshot?: AcademicRecordSnapshot;
  consent?: Consent;
  tokens?: DataShareToken[];
  access_logs?: DataShareAccessLog[];
}

export interface TransferCaseWithSnapshot extends TransferCase {
  snapshot?: AcademicRecordSnapshot;
  data_share?: DataShare;
}

// ============================================
// Sprint 5: Documentos Oficiais e Disciplina
// ============================================

// --- Tipos de Documentos ---

export type DocumentCategory =
  | 'secretariat'
  | 'discipline'
  | 'communication'
  | 'administrative';
export type SignaturePolicy =
  | 'none'
  | 'guardian'
  | 'student'
  | 'staff'
  | 'guardian_and_staff';
export type NumberingMode =
  | 'none'
  | 'per_tenant'
  | 'per_school'
  | 'per_school_year';

export interface SchoolDocumentType
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  school_id: string | null;
  slug: string;
  name: string;
  category: DocumentCategory;
  is_official_record: boolean;
  requires_ack: boolean;
  requires_signature: boolean;
  signature_policy: SignaturePolicy;
  numbering_mode: NumberingMode;
  default_prefix: string | null;
  retention_years: number | null;
  default_template_id: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
}

// --- Templates ---

export type TemplateFormat = 'html' | 'markdown' | 'docx';
export type TemplateStatus = 'draft' | 'published' | 'archived';

export interface SchoolDocumentTemplate
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  school_id: string | null;
  document_type_id: string;
  name: string;
  language_code: string;
  template_format: TemplateFormat;
  template_content: string | null;
  template_file_path: string | null;
  variables_schema: Record<string, unknown>;
  version: number;
  status: TemplateStatus;
  published_at: string | null;
  metadata: Record<string, unknown>;
}

// --- Contadores de Numeracao ---

export interface SchoolDocumentNumberCounter extends SoftDeleteFields {
  id: string;
  tenant_id: string;
  school_id: string;
  document_type_id: string;
  academic_year_id: string | null;
  prefix: string | null;
  next_number: number;
  last_issued_at: string | null;
  last_document_id: string | null;
  updated_at: string;
  updated_by: string | null;
}

// --- Documentos ---

export type DocumentStatus =
  | 'draft'
  | 'issued'
  | 'delivered'
  | 'acknowledged'
  | 'archived'
  | 'cancelled';
export type DocumentVisibility =
  | 'internal'
  | 'guardian'
  | 'student'
  | 'mixed'
  | 'restricted';

export interface SchoolDocument
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  school_id: string;
  document_type_id: string;
  academic_year_id: string | null;
  enrollment_id: string | null;
  student_id: string | null;
  class_group_id: string | null;
  author_staff_school_profile_id: string | null;
  issued_by: string | null;
  title: string;
  status: DocumentStatus;
  document_number: string | null;
  document_date: string;
  event_at: string | null;
  due_at: string | null;
  template_id: string | null;
  template_version: number | null;
  payload: Record<string, unknown>;
  rendered_html: string | null;
  rendered_text: string | null;
  hash_algo: string;
  payload_hash: string | null;
  content_hash: string | null;
  is_official_record: boolean;
  locked: boolean;
  locked_at: string | null;
  locked_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  visibility: DocumentVisibility;
  metadata: Record<string, unknown>;
}

// --- Arquivos ---

export type DocumentFileKind =
  | 'attachment'
  | 'generated_pdf'
  | 'signed_pdf'
  | 'image'
  | 'other';

export interface SchoolDocumentFile extends SoftDeleteFields {
  id: string;
  tenant_id: string;
  school_document_id: string;
  file_kind: DocumentFileKind;
  storage_bucket: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  checksum_sha256: string | null;
  is_primary: boolean;
  created_at: string;
  created_by: string | null;
}

// --- Destinatarios ---

export type RecipientType = 'guardian' | 'student' | 'staff' | 'external';
export type DeliveryChannel =
  | 'in_app'
  | 'email'
  | 'sms'
  | 'whatsapp'
  | 'printed'
  | 'handed';
export type DeliveryStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'skipped';
export type AckStatus = 'pending' | 'acknowledged' | 'refused' | 'expired';
export type AckMethod =
  | 'clickwrap'
  | 'digital_signature'
  | 'in_person'
  | 'other';

export interface SchoolDocumentRecipient extends AuditFields, SoftDeleteFields {
  id: string;
  tenant_id: string;
  school_document_id: string;
  recipient_type: RecipientType;
  guardian_id: string | null;
  student_id: string | null;
  staff_school_profile_id: string | null;
  user_id: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  delivery_channel: DeliveryChannel;
  delivery_status: DeliveryStatus;
  delivered_at: string | null;
  delivery_metadata: Record<string, unknown>;
  consent_id: string | null;
  acknowledgement_required: boolean;
  ack_status: AckStatus;
  ack_at: string | null;
  ack_method: AckMethod | null;
  token_hash: string | null;
  token_expires_at: string | null;
}

// --- Evidencia de Ciencia ---

export type AckActorType = 'user' | 'guardian' | 'system';

export interface SchoolDocumentAcknowledgement {
  id: string;
  tenant_id: string;
  school_document_id: string;
  recipient_id: string;
  acknowledged_at: string;
  ack_method: AckMethod;
  actor_type: AckActorType;
  actor_user_id: string | null;
  actor_guardian_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  evidence: Record<string, unknown>;
  created_at: string;
}

// --- Eventos de Documentos ---

export type DocumentEventType =
  | 'created'
  | 'updated'
  | 'issued'
  | 'locked'
  | 'delivered'
  | 'acknowledged'
  | 'archived'
  | 'cancelled'
  | 'file_added'
  | 'recipient_added'
  | 'recipient_updated'
  | 'reopened';

export interface SchoolDocumentEvent {
  id: string;
  tenant_id: string;
  school_id: string | null;
  school_document_id: string;
  event_type: DocumentEventType;
  occurred_at: string;
  actor_type: ActorType;
  actor_id: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  before_snapshot: Record<string, unknown> | null;
  after_snapshot: Record<string, unknown> | null;
}

// --- Disciplina ---

export type DisciplinaryCaseType =
  | 'incident'
  | 'behavior_note'
  | 'commendation';
export type DisciplinarySeverity = 'low' | 'medium' | 'high' | 'critical';
export type DisciplinaryCaseStatus =
  | 'open'
  | 'under_review'
  | 'closed'
  | 'voided';
export type DisciplinaryConfidentiality =
  | 'internal'
  | 'restricted'
  | 'guardians'
  | 'mixed';

export interface StudentDisciplinaryCase
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  school_id: string;
  student_id: string;
  academic_year_id: string | null;
  enrollment_id: string | null;
  class_group_id: string | null;
  reported_by_staff_school_profile_id: string | null;
  case_type: DisciplinaryCaseType;
  severity: DisciplinarySeverity;
  occurred_at: string;
  location: string | null;
  title: string | null;
  description: string;
  immediate_actions: string | null;
  status: DisciplinaryCaseStatus;
  closed_at: string | null;
  closed_by_staff_school_profile_id: string | null;
  official_document_id: string | null;
  confidentiality: DisciplinaryConfidentiality;
  metadata: Record<string, unknown>;
}

export type DisciplinaryActionType =
  | 'warning'
  | 'suspension'
  | 'detention'
  | 'guardian_meeting'
  | 'pedagogical_plan'
  | 'other';
export type DisciplinaryActionStatus = 'active' | 'completed' | 'cancelled';

export interface StudentDisciplinaryAction
  extends AuditFields, SoftDeleteFields {
  id: string;
  tenant_id: string;
  school_id: string;
  case_id: string;
  action_type: DisciplinaryActionType;
  effective_from: string | null;
  effective_to: string | null;
  duration_days: number | null;
  decision_notes: string | null;
  decided_by_staff_school_profile_id: string | null;
  document_id: string | null;
  status: DisciplinaryActionStatus;
  metadata: Record<string, unknown>;
}

export interface StudentDisciplinaryEvent {
  id: string;
  tenant_id: string;
  school_id: string | null;
  student_id: string;
  event_type: string;
  occurred_at: string;
  actor_type: ActorType;
  actor_id: string | null;
  subject_entity_type: string | null;
  subject_entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// --- Tipos com Relacionamentos (Sprint 5) ---

export interface SchoolDocumentWithRelations extends SchoolDocument {
  document_type?: SchoolDocumentType;
  template?: SchoolDocumentTemplate;
  files?: SchoolDocumentFile[];
  recipients?: SchoolDocumentRecipient[];
  events?: SchoolDocumentEvent[];
}

export interface StudentDisciplinaryCaseWithRelations extends StudentDisciplinaryCase {
  student?: Student;
  actions?: StudentDisciplinaryAction[];
  official_document?: SchoolDocument;
}

// ============================================
// Sprint 6: Comunicacao Enterprise
// ============================================

export type ThreadType = 'broadcast' | 'conversation' | 'system_notification';
export type ThreadCategory =
  | 'general'
  | 'announcement'
  | 'academic'
  | 'attendance'
  | 'document'
  | 'disciplinary'
  | 'behavior'
  | 'financial'
  | 'administrative'
  | 'other';
export type ThreadPriority = 'low' | 'normal' | 'high' | 'urgent';
export type ThreadStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'archived'
  | 'cancelled';

export interface CommunicationThread
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  school_id: string | null;
  academic_year_id: string | null;
  thread_type: ThreadType;
  category: ThreadCategory;
  priority: ThreadPriority;
  subject: string | null;
  preview_text: string | null;
  requires_ack: boolean;
  ack_deadline: string | null;
  status: ThreadStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  locked: boolean;
  source_entity_type: string | null;
  source_entity_id: string | null;
  metadata: Record<string, unknown>;
}

export interface CommunicationThreadLink extends SoftDeleteFields {
  id: string;
  tenant_id: string;
  school_id: string | null;
  thread_id: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
}

export type ParticipantRole = 'member' | 'owner' | 'moderator';

export interface CommunicationThreadParticipant extends SoftDeleteFields {
  id: string;
  tenant_id: string;
  school_id: string | null;
  thread_id: string;
  participant_user_id: string | null;
  participant_person_id: string | null;
  participant_role: ParticipantRole;
  is_muted: boolean;
  last_read_message_id: string | null;
  last_read_at: string | null;
  joined_at: string;
  left_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
}

export type MessageAuthorType = 'user' | 'system' | 'ai';
export type MessageType =
  | 'text'
  | 'system_event'
  | 'template'
  | 'document'
  | 'attachment_only';
export type BodyFormat = 'plain' | 'markdown';

export interface CommunicationMessage extends SoftDeleteFields {
  id: string;
  tenant_id: string;
  school_id: string | null;
  thread_id: string;
  author_type: MessageAuthorType;
  author_user_id: string | null;
  author_person_id: string | null;
  message_type: MessageType;
  body: string | null;
  body_format: BodyFormat;
  metadata: Record<string, unknown>;
  created_at: string;
  edited_at: string | null;
  edited_by: string | null;
}

export type AudienceType =
  | 'segment'
  | 'explicit_list'
  | 'all_school'
  | 'all_tenant';
export type TargetKind = 'guardians' | 'students' | 'staff' | 'mixed';

export interface CommunicationBroadcastAudience extends SoftDeleteFields {
  id: string;
  tenant_id: string;
  school_id: string | null;
  thread_id: string;
  audience_type: AudienceType;
  target_kind: TargetKind;
  query_config: Record<string, unknown>;
  resolved_at: string | null;
  resolved_by: string | null;
  recipients_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
}

export type CommDeliveryChannel =
  | 'in_app'
  | 'email'
  | 'sms'
  | 'whatsapp'
  | 'push';
export type CommDeliveryStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'skipped'
  | 'cancelled';
export type CommAckStatus =
  | 'not_required'
  | 'pending'
  | 'acknowledged'
  | 'declined'
  | 'expired';
export type CommAckMethod =
  | 'in_app'
  | 'email_link'
  | 'sms_link'
  | 'whatsapp_link'
  | 'signature';
export type RecipientProfileType = 'guardian' | 'student' | 'staff' | 'other';

export interface CommunicationThreadRecipient extends SoftDeleteFields {
  id: string;
  tenant_id: string;
  school_id: string | null;
  thread_id: string;
  recipient_user_id: string | null;
  recipient_person_id: string | null;
  recipient_profile: RecipientProfileType | null;
  student_id: string | null;
  guardian_id: string | null;
  class_group_id: string | null;
  channels_requested: string[];
  primary_channel: CommDeliveryChannel;
  delivery_status: CommDeliveryStatus;
  last_delivery_at: string | null;
  read_at: string | null;
  ack_status: CommAckStatus;
  ack_at: string | null;
  ack_by_user_id: string | null;
  ack_method: CommAckMethod | null;
  ack_token_hash: string | null;
  ack_token_hint: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
}

export type AttachmentClassification =
  | 'document'
  | 'image'
  | 'video'
  | 'audio'
  | 'other';

export interface CommunicationAttachment extends SoftDeleteFields {
  id: string;
  tenant_id: string;
  school_id: string | null;
  owner_user_id: string | null;
  storage_bucket: string;
  storage_path: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  checksum_sha256: string | null;
  classification: AttachmentClassification;
  is_sensitive: boolean;
  preview_path: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
}

export interface CommunicationMessageAttachment extends SoftDeleteFields {
  id: string;
  tenant_id: string;
  message_id: string;
  attachment_id: string;
  created_at: string;
  created_by: string | null;
}

export type DeliveryAttemptChannel =
  | 'in_app'
  | 'email'
  | 'sms'
  | 'whatsapp'
  | 'push'
  | 'webhook';
export type DeliveryAttemptStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export interface CommunicationDeliveryAttempt extends SoftDeleteFields {
  id: string;
  tenant_id: string;
  school_id: string | null;
  thread_id: string;
  message_id: string | null;
  recipient_id: string;
  channel: DeliveryAttemptChannel;
  provider: string | null;
  status: DeliveryAttemptStatus;
  attempt_no: number;
  provider_message_id: string | null;
  to_address: string | null;
  error_code: string | null;
  error_message: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
}

export interface CommunicationTemplate
  extends AuditFields, SoftDeleteFields, AIContextFields {
  id: string;
  tenant_id: string;
  school_id: string | null;
  template_key: string;
  name: string;
  category: string;
  channel: CommDeliveryChannel;
  locale: string;
  subject_template: string | null;
  body_template: string;
  variables_schema: Record<string, unknown>;
  version: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
}

export type NotificationRuleStatus = 'active' | 'inactive';

export interface NotificationRule extends AuditFields, SoftDeleteFields {
  id: string;
  tenant_id: string;
  school_id: string | null;
  event_type: string;
  status: NotificationRuleStatus;
  target_kind: TargetKind;
  audience_config: Record<string, unknown>;
  channels: string[];
  template_id: string | null;
  throttle_config: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface UserNotification extends SoftDeleteFields {
  id: string;
  tenant_id: string;
  school_id: string | null;
  user_id: string;
  notification_type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  priority: ThreadPriority;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  expires_at: string | null;
  created_by: string | null;
}

export interface UserNotificationPreference extends SoftDeleteFields {
  id: string;
  tenant_id: string;
  school_id: string | null;
  user_id: string;
  category: string;
  channels_enabled: string[];
  muted_until: string | null;
  created_at: string;
  updated_at: string;
}

export type PushPlatform = 'ios' | 'android' | 'web';
export type PushProvider = 'fcm' | 'apns' | 'webpush';

export interface PushDeviceToken extends SoftDeleteFields {
  id: string;
  tenant_id: string;
  user_id: string;
  platform: PushPlatform;
  provider: PushProvider;
  token: string;
  is_active: boolean;
  last_seen_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CommunicationThreadWithRelations extends CommunicationThread {
  messages?: CommunicationMessage[];
  participants?: CommunicationThreadParticipant[];
  recipients?: CommunicationThreadRecipient[];
  audience?: CommunicationBroadcastAudience;
}

export interface CommunicationMessageWithAttachments extends CommunicationMessage {
  attachments?: CommunicationAttachment[];
}
