/**
 * Types de Staff/Funcionários - Sprint 2
 */

import { AuditFields, SoftDeleteFields, AIContextFields } from './base.types';

// ============================================
// Staff Members (Global do Tenant)
// ============================================

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

// ============================================
// Staff School Profiles (Vínculo com Escola)
// ============================================

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

// ============================================
// Tipos com Relacionamentos
// ============================================

export interface StaffMemberWithProfiles extends StaffMember {
  person?: PersonRef;
  school_profiles?: StaffSchoolProfile[];
}

export interface StaffSchoolProfileWithMember extends StaffSchoolProfile {
  staff_member?: StaffMember;
  school?: SchoolRef;
}

// Referências para evitar imports circulares
interface PersonRef {
  id: string;
  full_name: string;
  preferred_name: string | null;
}

interface SchoolRef {
  id: string;
  name: string;
}
