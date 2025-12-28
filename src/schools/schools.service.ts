import { Injectable, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { School } from '../common/types';
import { UsersService } from '../users/users.service';

@Injectable()
export class SchoolsService {
  constructor(
    private supabaseService: SupabaseService,
    private logger: LoggerService,
    private usersService: UsersService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  async getSchoolById(schoolId: string): Promise<School | null> {
    const { data, error } = await this.supabase
      .from('schools')
      .select('*')
      .eq('id', schoolId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error(
        `Failed to get school by id: ${error.message}`,
        undefined,
        'SchoolsService',
        { schoolId, error: error.message },
      );
      throw new Error(`Failed to get school: ${error.message}`);
    }

    return data as School;
  }

  async getSchoolBySlug(slug: string, tenantId?: string): Promise<School | null> {
    let query = this.supabase
      .from('schools')
      .select('*')
      .eq('slug', slug);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error(
        `Failed to get school by slug: ${error.message}`,
        undefined,
        'SchoolsService',
        { slug, tenantId, error: error.message },
      );
      throw new Error(`Failed to get school: ${error.message}`);
    }

    return data as School;
  }

  async getSchoolsByTenant(tenantId: string): Promise<School[]> {
    const { data, error } = await this.supabase
      .from('schools')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (error) {
      this.logger.error(
        `Failed to get schools by tenant: ${error.message}`,
        undefined,
        'SchoolsService',
        {
          tenantId,
          error: error.message,
        },
      );
      throw new Error(`Failed to get schools: ${error.message}`);
    }

    return (data || []) as School[];
  }

  async getSchoolsByUser(userId: string): Promise<School[]> {
    // Buscar o usuário para obter o tenant_id
    const user = await this.usersService.getUserById(userId);
    if (!user || !user.tenant_id) {
      return [];
    }

    // Buscar escolas do tenant
    return this.getSchoolsByTenant(user.tenant_id);
  }

  async getSchoolsForCurrentUser(userId: string): Promise<School[]> {
    // Buscar escolas onde o usuário é membro
    const { data: memberships, error: membersError } = await this.supabase
      .from('school_members')
      .select('school_id')
      .eq('user_id', userId);

    if (membersError) {
      this.logger.error(
        `Failed to get school memberships: ${membersError.message}`,
        undefined,
        'SchoolsService',
        {
          userId,
          error: membersError.message,
        },
      );
      throw new Error(`Failed to get school memberships: ${membersError.message}`);
    }

    if (!memberships || memberships.length === 0) {
      return [];
    }

    const schoolIds = memberships.map((m) => m.school_id);
    const { data: schools, error: schoolsError } = await this.supabase
      .from('schools')
      .select('*')
      .in('id', schoolIds)
      .order('name', { ascending: true });

    if (schoolsError) {
      this.logger.error(
        `Failed to get schools: ${schoolsError.message}`,
        undefined,
        'SchoolsService',
        {
          schoolIds,
          error: schoolsError.message,
        },
      );
      throw new Error(`Failed to get schools: ${schoolsError.message}`);
    }

    return (schools || []) as School[];
  }

  async getCurrentSchool(userId: string): Promise<School | null> {
    const user = await this.usersService.getUserById(userId);
    if (!user || !user.current_school_id) {
      return null;
    }

    const { data, error } = await this.supabase
      .from('schools')
      .select('*')
      .eq('id', user.current_school_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error(
        `Failed to get current school: ${error.message}`,
        undefined,
        'SchoolsService',
        {
          userId,
          schoolId: user.current_school_id,
          error: error.message,
        },
      );
      throw new Error(`Failed to get current school: ${error.message}`);
    }

    return data as School;
  }

  async setCurrentSchool(userId: string, schoolId: string, tenantId: string): Promise<void> {
    // A validação de que a escola pertence ao tenant já foi feita no controller
    // Aqui apenas atualizamos os dados

    // Verificar se o usuário já é membro da escola
    const { data: membership } = await this.supabase
      .from('school_members')
      .select('*')
      .eq('user_id', userId)
      .eq('school_id', schoolId)
      .single();

    // Se não é membro, adicionar automaticamente
    if (!membership) {
      await this.addUserToSchool(userId, schoolId, 'user');
      this.logger.log('User added to school', 'SchoolsService', { userId, schoolId, tenantId });
    }

    // Atualizar current_school_id e tenant_id do usuário
    const { error: updateError } = await this.supabase
      .from('users')
      .update({ 
        current_school_id: schoolId, 
        tenant_id: tenantId, // Sempre atualizar para garantir isolamento
        updated_at: new Date().toISOString() 
      })
      .eq('id', userId);

    if (updateError) {
      this.logger.error(
        `Failed to set current school: ${updateError.message}`,
        undefined,
        'SchoolsService',
        {
          userId,
          schoolId,
          error: updateError.message,
        },
      );
      throw new Error(`Failed to set current school: ${updateError.message}`);
    }

    this.logger.log('Current school updated', 'SchoolsService', { userId, schoolId });
  }

  async addUserToSchool(userId: string, schoolId: string, role: string = 'user'): Promise<void> {
    const { error } = await this.supabase.from('school_members').insert({
      user_id: userId,
      school_id: schoolId,
      role,
      permissions: {},
      created_at: new Date().toISOString(),
    });

    if (error) {
      // Se já existe, não é erro
      if (error.code !== '23505') {
        this.logger.error(
          `Failed to add user to school: ${error.message}`,
          undefined,
          'SchoolsService',
          {
            userId,
            schoolId,
            error: error.message,
          },
        );
        throw new Error(`Failed to add user to school: ${error.message}`);
      }
    }
  }
}
