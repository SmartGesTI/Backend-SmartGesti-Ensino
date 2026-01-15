import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { StaffMember, StaffSchoolProfile } from '../common/types';
import { CreateStaffMemberDto } from './dto/create-staff-member.dto';
import { UpdateStaffMemberDto } from './dto/update-staff-member.dto';
import { CreateStaffSchoolProfileDto } from './dto/create-staff-school-profile.dto';
import { UpdateStaffSchoolProfileDto } from './dto/update-staff-school-profile.dto';

@Injectable()
export class StaffMembersService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
    private softDeleteService: SoftDeleteService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  // ======================
  // Staff Members (Global)
  // ======================

  async findAll(
    tenantId: string,
    options?: {
      staffType?: string;
      status?: string;
      includeProfiles?: boolean;
    },
  ): Promise<StaffMember[]> {
    let query = this.supabase
      .from('staff_members')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (options?.staffType) {
      query = query.eq('staff_type', options.staffType);
    }

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to list staff members: ${error.message}`,
        undefined,
        'StaffMembersService',
      );
      throw new Error(`Failed to list staff members: ${error.message}`);
    }

    return (data || []) as StaffMember[];
  }

  async findOne(
    id: string,
    tenantId: string,
    _includeProfiles?: boolean,
  ): Promise<StaffMember | null> {
    const { data, error } = await this.supabase
      .from('staff_members')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get staff member: ${error.message}`);
    }

    return data as StaffMember;
  }

  async findByPersonId(
    personId: string,
    tenantId: string,
  ): Promise<StaffMember | null> {
    const { data, error } = await this.supabase
      .from('staff_members')
      .select('*')
      .eq('person_id', personId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get staff member by person: ${error.message}`);
    }

    return data as StaffMember;
  }

  async create(
    tenantId: string,
    dto: CreateStaffMemberDto,
    userId?: string,
  ): Promise<StaffMember> {
    const { data, error } = await this.supabase
      .from('staff_members')
      .insert({
        tenant_id: tenantId,
        person_id: dto.person_id,
        user_id: dto.user_id ?? null,
        staff_type: dto.staff_type,
        status: dto.status ?? 'active',
        hired_at: dto.hired_at ?? null,
        terminated_at: dto.terminated_at ?? null,
        notes: dto.notes ?? null,
        ai_context: dto.ai_context ?? {},
        ai_summary: dto.ai_summary ?? null,
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          'Já existe um staff member para esta pessoa neste tenant',
        );
      }
      this.logger.error(
        `Failed to create staff member: ${error.message}`,
        undefined,
        'StaffMembersService',
      );
      throw new Error(`Failed to create staff member: ${error.message}`);
    }

    this.logger.log('Staff member created', 'StaffMembersService', {
      id: data.id,
      personId: dto.person_id,
    });

    return data as StaffMember;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateStaffMemberDto,
    userId?: string,
  ): Promise<StaffMember> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Staff member com id '${id}' não encontrado`);
    }

    const { data, error } = await this.supabase
      .from('staff_members')
      .update({
        ...dto,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update staff member: ${error.message}`);
    }

    this.logger.log('Staff member updated', 'StaffMembersService', { id });

    return data as StaffMember;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Staff member com id '${id}' não encontrado`);
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'staff_members',
      id,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete staff member: ${result.error}`);
    }

    this.logger.log('Staff member deleted', 'StaffMembersService', { id });
  }

  // ==========================
  // Staff School Profiles
  // ==========================

  async findProfilesByStaffMember(
    staffMemberId: string,
    tenantId: string,
  ): Promise<StaffSchoolProfile[]> {
    const { data, error } = await this.supabase
      .from('staff_school_profiles')
      .select('*, schools(*)')
      .eq('staff_member_id', staffMemberId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('joined_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list staff school profiles: ${error.message}`);
    }

    return (data || []) as StaffSchoolProfile[];
  }

  async findProfilesBySchool(
    schoolId: string,
    tenantId: string,
    options?: {
      status?: string;
    },
  ): Promise<StaffSchoolProfile[]> {
    let query = this.supabase
      .from('staff_school_profiles')
      .select('*, staff_members(*, persons(*))')
      .eq('school_id', schoolId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('role_title', { ascending: true });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list staff by school: ${error.message}`);
    }

    return (data || []) as StaffSchoolProfile[];
  }

  async findProfileOne(
    profileId: string,
    tenantId: string,
  ): Promise<StaffSchoolProfile | null> {
    const { data, error } = await this.supabase
      .from('staff_school_profiles')
      .select('*, staff_members(*, persons(*)), schools(*)')
      .eq('id', profileId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get staff school profile: ${error.message}`);
    }

    return data as StaffSchoolProfile;
  }

  async createProfile(
    staffMemberId: string,
    tenantId: string,
    dto: CreateStaffSchoolProfileDto,
    userId?: string,
  ): Promise<StaffSchoolProfile> {
    const staffMember = await this.findOne(staffMemberId, tenantId);
    if (!staffMember) {
      throw new NotFoundException(
        `Staff member com id '${staffMemberId}' não encontrado`,
      );
    }

    const { data, error } = await this.supabase
      .from('staff_school_profiles')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id,
        staff_member_id: staffMemberId,
        role_title: dto.role_title ?? null,
        employee_code: dto.employee_code ?? null,
        status: dto.status ?? 'active',
        joined_at: dto.joined_at ?? new Date().toISOString().split('T')[0],
        left_at: dto.left_at ?? null,
        metadata: dto.metadata ?? {},
        ai_context: dto.ai_context ?? {},
        ai_summary: dto.ai_summary ?? null,
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          'Este staff member já possui vínculo com esta escola',
        );
      }
      this.logger.error(
        `Failed to create staff school profile: ${error.message}`,
        undefined,
        'StaffMembersService',
      );
      throw new Error(
        `Failed to create staff school profile: ${error.message}`,
      );
    }

    this.logger.log('Staff school profile created', 'StaffMembersService', {
      id: data.id,
      staffMemberId,
      schoolId: dto.school_id,
    });

    return data as StaffSchoolProfile;
  }

  async updateProfile(
    profileId: string,
    tenantId: string,
    dto: UpdateStaffSchoolProfileDto,
    userId?: string,
  ): Promise<StaffSchoolProfile> {
    const existing = await this.findProfileOne(profileId, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `Staff school profile com id '${profileId}' não encontrado`,
      );
    }

    const { data, error } = await this.supabase
      .from('staff_school_profiles')
      .update({
        ...dto,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', profileId)
      .select()
      .single();

    if (error) {
      throw new Error(
        `Failed to update staff school profile: ${error.message}`,
      );
    }

    this.logger.log('Staff school profile updated', 'StaffMembersService', {
      id: profileId,
    });

    return data as StaffSchoolProfile;
  }

  async removeProfile(
    profileId: string,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const existing = await this.findProfileOne(profileId, tenantId);
    if (!existing) {
      throw new NotFoundException(
        `Staff school profile com id '${profileId}' não encontrado`,
      );
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'staff_school_profiles',
      profileId,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete staff school profile: ${result.error}`);
    }

    this.logger.log('Staff school profile deleted', 'StaffMembersService', {
      id: profileId,
    });
  }
}
