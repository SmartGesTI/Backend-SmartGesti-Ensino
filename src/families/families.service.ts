import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { SoftDeleteService } from '../common/services/soft-delete.service';
import { Family, FamilyMember, FamilyWithMembers } from '../common/types';
import { CreateFamilyDto, UpdateFamilyDto } from './dto/create-family.dto';
import { CreateFamilyMemberDto } from './dto/create-family-member.dto';

@Injectable()
export class FamiliesService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
    private softDeleteService: SoftDeleteService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  // ======================
  // Families
  // ======================

  async findAll(
    tenantId: string,
    options?: {
      status?: string;
      search?: string;
    },
  ): Promise<FamilyWithMembers[]> {
    let query = this.supabase
      .from('families')
      .select(
        `
        *,
        family_members(*, persons(*))
      `,
      )
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.search) {
      query = query.ilike('name', `%${options.search}%`);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to list families: ${error.message}`,
        undefined,
        'FamiliesService',
      );
      throw new Error(`Failed to list families: ${error.message}`);
    }

    return (data || []).map((item: any) => ({
      ...item,
      members: (item.family_members || [])
        .filter((m: any) => !m.deleted_at)
        .map((m: any) => ({
          ...m,
          person: m.persons,
        })),
    })) as FamilyWithMembers[];
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<FamilyWithMembers | null> {
    const { data, error } = await this.supabase
      .from('families')
      .select(
        `
        *,
        family_members(*, persons(*))
      `,
      )
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get family: ${error.message}`);
    }

    return {
      ...data,
      members: ((data as any).family_members || [])
        .filter((m: any) => !m.deleted_at)
        .map((m: any) => ({
          ...m,
          person: m.persons,
        })),
    } as FamilyWithMembers;
  }

  async create(
    tenantId: string,
    dto: CreateFamilyDto,
    userId?: string,
  ): Promise<Family> {
    const { data, error } = await this.supabase
      .from('families')
      .insert({
        tenant_id: tenantId,
        name: dto.name,
        status: dto.status ?? 'active',
        metadata: dto.metadata ?? {},
        ai_context: dto.ai_context ?? {},
        ai_summary: dto.ai_summary ?? null,
        ...this.softDeleteService.getCreateAuditData(userId),
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        `Failed to create family: ${error.message}`,
        undefined,
        'FamiliesService',
      );
      throw new Error(`Failed to create family: ${error.message}`);
    }

    this.logger.log('Family created', 'FamiliesService', {
      id: data.id,
      name: dto.name,
    });

    return data as Family;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateFamilyDto,
    userId?: string,
  ): Promise<Family> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Família com id '${id}' não encontrada`);
    }

    const { data, error } = await this.supabase
      .from('families')
      .update({
        ...dto,
        ...this.softDeleteService.getUpdateAuditData(userId),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update family: ${error.message}`);
    }

    this.logger.log('Family updated', 'FamiliesService', { id });

    return data as Family;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<void> {
    const existing = await this.findOne(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Família com id '${id}' não encontrada`);
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'families',
      id,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to delete family: ${result.error}`);
    }

    // Soft-delete membros
    await this.supabase
      .from('family_members')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('family_id', id)
      .is('deleted_at', null);

    this.logger.log('Family deleted', 'FamiliesService', { id });
  }

  // ======================
  // Family Members
  // ======================

  async findMembers(
    familyId: string,
    tenantId: string,
  ): Promise<FamilyMember[]> {
    const { data, error } = await this.supabase
      .from('family_members')
      .select('*, persons(*)')
      .eq('family_id', familyId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('member_role', { ascending: true });

    if (error) {
      throw new Error(`Failed to list family members: ${error.message}`);
    }

    return (data || []).map((item: any) => ({
      ...item,
      person: item.persons,
    })) as FamilyMember[];
  }

  async addMember(
    familyId: string,
    tenantId: string,
    dto: CreateFamilyMemberDto,
    userId?: string,
  ): Promise<FamilyMember> {
    const family = await this.findOne(familyId, tenantId);
    if (!family) {
      throw new NotFoundException(
        `Família com id '${familyId}' não encontrada`,
      );
    }

    // Verificar se já é membro
    const { data: existingMember } = await this.supabase
      .from('family_members')
      .select('id')
      .eq('family_id', familyId)
      .eq('person_id', dto.person_id)
      .is('deleted_at', null)
      .single();

    if (existingMember) {
      throw new ConflictException('Esta pessoa já é membro desta família');
    }

    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('family_members')
      .insert({
        tenant_id: tenantId,
        family_id: familyId,
        person_id: dto.person_id,
        member_role: dto.member_role,
        created_at: now,
        created_by: userId ?? null,
      })
      .select('*, persons(*)')
      .single();

    if (error) {
      this.logger.error(
        `Failed to add family member: ${error.message}`,
        undefined,
        'FamiliesService',
      );
      throw new Error(`Failed to add family member: ${error.message}`);
    }

    this.logger.log('Family member added', 'FamiliesService', {
      familyId,
      personId: dto.person_id,
    });

    return {
      ...data,
      person: (data as any).persons,
    } as FamilyMember;
  }

  async removeMember(
    familyId: string,
    memberId: string,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const { data: existing } = await this.supabase
      .from('family_members')
      .select('*')
      .eq('id', memberId)
      .eq('family_id', familyId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (!existing) {
      throw new NotFoundException(`Membro com id '${memberId}' não encontrado`);
    }

    const result = await this.softDeleteService.softDelete(
      this.supabase,
      'family_members',
      memberId,
      userId,
    );

    if (!result.success) {
      throw new Error(`Failed to remove family member: ${result.error}`);
    }

    this.logger.log('Family member removed', 'FamiliesService', {
      familyId,
      memberId,
    });
  }
}
