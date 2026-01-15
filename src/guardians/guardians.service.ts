import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import {
  Guardian,
  GuardianTenantProfile,
  GuardianWithProfiles,
} from '../common/types';
import {
  CreateGuardianDto,
  UpdateGuardianDto,
} from './dto/create-guardian.dto';
import {
  CreateGuardianTenantProfileDto,
  UpdateGuardianTenantProfileDto,
} from './dto/create-guardian-tenant-profile.dto';

@Injectable()
export class GuardiansService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
    private softDeleteService: SoftDeleteService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  // ======================
  // Guardians
  // ======================

  async findAll(
    tenantId: string,
    options?: {
      status?: string;
      search?: string;
    },
  ): Promise<GuardianWithProfiles[]> {
    // Buscar guardians que têm perfil no tenant
    let query = this.supabase
      .from('guardians')
      .select(
        `
        *,
        persons(*),
        guardian_tenant_profiles!inner(*)
      `,
      )
      .eq('guardian_tenant_profiles.tenant_id', tenantId)
      .is('deleted_at', null)
      .is('guardian_tenant_profiles.deleted_at', null)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('global_status', options.status);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to list guardians: ${error.message}`,
        undefined,
        'GuardiansService',
      );
      throw new Error(`Failed to list guardians: ${error.message}`);
    }

    return (data || []).map((item: any) => ({
      ...item,
      person: item.persons,
      tenant_profiles: item.guardian_tenant_profiles,
    })) as GuardianWithProfiles[];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<GuardianWithProfiles | null> {
    const { data, error } = await this.supabase
      .from('guardians')
      .select(
        `
        *,
        persons(*),
        guardian_tenant_profiles(*)
      `,
      )
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get guardian: ${error.message}`);
    }

    // Filtrar perfis pelo tenant
    const profiles = ((data as any).guardian_tenant_profiles || []).filter(
      (p: any) => p.tenant_id === tenantId && !p.deleted_at,
    );

    return {
      ...data,
      person: (data as any).persons,
      tenant_profiles: profiles,
    } as GuardianWithProfiles;
  }

  async create(
    tenantId: string,
    dto: CreateGuardianDto,
    userId?: string,
  ): Promise<GuardianWithProfiles> {
    // Verificar se já existe guardian para esta person
    const { data: existing } = await this.supabase
      .from('guardians')
      .select('id')
      .eq('person_id', dto.person_id)
      .is('deleted_at', null)
      .single();

    let guardianId: string;

    if (existing) {
      guardianId = existing.id;
    } else {
      // Criar guardian
      const { data: newGuardian, error: guardianError } = await this.supabase
        .from('guardians')
        .insert({
          person_id: dto.person_id,
          global_status: dto.global_status ?? 'active',
          ...this.softDeleteService.getCreateAuditData(userId),
        })
        .select()
        .single();

      if (guardianError) {
        throw new Error(`Failed to create guardian: ${guardianError.message}`);
      }

      guardianId = newGuardian.id;
    }

    // Verificar se já existe perfil no tenant
    const { data: existingProfile } = await this.supabase
      .from('guardian_tenant_profiles')
      .select('id')
      .eq('guardian_id', guardianId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (existingProfile) {
      throw new ConflictException(
        'Este responsável já possui perfil neste tenant',
      );
    }

    // Criar perfil no tenant
    const { error: profileError } = await this.supabase
      .from('guardian_tenant_profiles')
      .insert({
        tenant_id: tenantId,
        guardian_id: guardianId,
        status: 'active',
        ai_context: {},
        ...this.softDeleteService.getCreateAuditData(userId),
      });

    if (profileError) {
      throw new Error(
        `Failed to create guardian tenant profile: ${profileError.message}`,
      );
    }

    this.logger.log('Guardian created', 'GuardiansService', {
      guardianId,
      personId: dto.person_id,
    });

    return this.findOne(guardianId, tenantId) as Promise<GuardianWithProfiles>;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateGuardianDto,
    userId?: string,
  ): Promise<Guardian> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Responsável com id '${id}' não encontrado`);
    }

    const { data, error } = await this.supabase
      .from('guardians')
      .update({
        ...dto,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update guardian: ${error.message}`);
    }

    this.logger.log('Guardian updated', 'GuardiansService', { id });

    return data as Guardian;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Responsável com id '${id}' não encontrado`);
    }

    // Soft-delete perfil do tenant
    await this.supabase
      .from('guardian_tenant_profiles')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('guardian_id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    this.logger.log('Guardian tenant profile deleted', 'GuardiansService', {
      id,
      tenantId,
    });
  }

  // ======================
  // Guardian Tenant Profiles
  // ======================

  async findProfiles(
    guardianId: string,
    tenantId: string,
  ): Promise<GuardianTenantProfile[]> {
    const { data, error } = await this.supabase
      .from('guardian_tenant_profiles')
      .select('*')
      .eq('guardian_id', guardianId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (error) {
      throw new Error(`Failed to list guardian profiles: ${error.message}`);
    }

    return (data || []) as GuardianTenantProfile[];
  }

  async addProfile(
    guardianId: string,
    tenantId: string,
    dto: CreateGuardianTenantProfileDto,
    userId?: string,
  ): Promise<GuardianTenantProfile> {
    // Verificar se guardian existe
    const { data: guardian } = await this.supabase
      .from('guardians')
      .select('id')
      .eq('id', guardianId)
      .is('deleted_at', null)
      .single();

    if (!guardian) {
      throw new NotFoundException(
        `Responsável com id '${guardianId}' não encontrado`,
      );
    }

    // Verificar se já existe perfil
    const { data: existingProfile } = await this.supabase
      .from('guardian_tenant_profiles')
      .select('id')
      .eq('guardian_id', guardianId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (existingProfile) {
      throw new ConflictException(
        'Este responsável já possui perfil neste tenant',
      );
    }

    const { data, error } = await this.supabase
      .from('guardian_tenant_profiles')
      .insert({
        tenant_id: tenantId,
        guardian_id: guardianId,
        status: dto.status ?? 'active',
        external_id: dto.external_id ?? null,
        notes: dto.notes ?? null,
        ai_context: dto.ai_context ?? {},
        ai_summary: dto.ai_summary ?? null,
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create guardian profile: ${error.message}`);
    }

    this.logger.log('Guardian tenant profile created', 'GuardiansService', {
      guardianId,
      profileId: data.id,
    });

    return data as GuardianTenantProfile;
  }

  async updateProfile(
    profileId: string,
    tenantId: string,
    dto: UpdateGuardianTenantProfileDto,
    userId?: string,
  ): Promise<GuardianTenantProfile> {
    const { data: existing } = await this.supabase
      .from('guardian_tenant_profiles')
      .select('*')
      .eq('id', profileId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (!existing) {
      throw new NotFoundException(
        `Perfil com id '${profileId}' não encontrado`,
      );
    }

    const { data, error } = await this.supabase
      .from('guardian_tenant_profiles')
      .update({
        ...dto,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', profileId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update guardian profile: ${error.message}`);
    }

    this.logger.log('Guardian tenant profile updated', 'GuardiansService', {
      profileId,
    });

    return data as GuardianTenantProfile;
  }
}
