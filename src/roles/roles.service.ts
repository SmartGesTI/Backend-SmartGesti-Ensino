import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignRoleDto } from './dto/assign-role.dto';

@Injectable()
export class RolesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Lista todos os cargos (sistema + customizados do tenant)
   */
  async findAll(tenantId: string) {
    const { data, error } = await this.supabase.getClient()
      .from('roles')
      .select('*')
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
      .order('hierarchy_level', { ascending: true });

    if (error) {
      throw new BadRequestException('Erro ao buscar cargos');
    }

    return data;
  }

  /**
   * Busca um cargo por ID
   */
  async findOne(id: string, tenantId: string) {
    const { data, error } = await this.supabase.getClient()
      .from('roles')
      .select('*')
      .eq('id', id)
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
      .single();

    if (error || !data) {
      throw new NotFoundException('Cargo não encontrado');
    }

    return data;
  }

  /**
   * Cria um cargo customizado para o tenant
   */
  async create(tenantId: string, createRoleDto: CreateRoleDto) {
    // Verificar se já existe cargo com esse slug no tenant
    const { data: existing } = await this.supabase.getClient()
      .from('roles')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('slug', createRoleDto.slug)
      .single();

    if (existing) {
      throw new BadRequestException(
        'Já existe um cargo com este identificador',
      );
    }

    const { data, error } = await this.supabase.getClient()
      .from('roles')
      .insert({
        tenant_id: tenantId,
        name: createRoleDto.name,
        slug: createRoleDto.slug,
        description: createRoleDto.description,
        hierarchy_level: createRoleDto.hierarchy_level,
        default_permissions: createRoleDto.default_permissions || {},
        is_system_role: false,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException('Erro ao criar cargo');
    }

    return data;
  }

  /**
   * Atualiza um cargo customizado
   */
  async update(id: string, tenantId: string, updateRoleDto: UpdateRoleDto) {
    // Verificar se o cargo existe e pertence ao tenant
    const role = await this.findOne(id, tenantId);

    // Não permitir atualização de cargos do sistema
    if (role.is_system_role) {
      throw new ForbiddenException(
        'Cargos do sistema não podem ser modificados',
      );
    }

    const { data, error } = await this.supabase.getClient()
      .from('roles')
      .update({
        name: updateRoleDto.name,
        description: updateRoleDto.description,
        hierarchy_level: updateRoleDto.hierarchy_level,
        default_permissions: updateRoleDto.default_permissions,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException('Erro ao atualizar cargo');
    }

    return data;
  }

  /**
   * Deleta um cargo customizado
   */
  async remove(id: string, tenantId: string) {
    // Verificar se o cargo existe e pertence ao tenant
    const role = await this.findOne(id, tenantId);

    // Não permitir deleção de cargos do sistema
    if (role.is_system_role) {
      throw new ForbiddenException('Cargos do sistema não podem ser deletados');
    }

    // Verificar se há usuários com este cargo
    const { data: usersWithRole } = await this.supabase.getClient()
      .from('user_roles')
      .select('id')
      .eq('role_id', id)
      .limit(1);

    if (usersWithRole && usersWithRole.length > 0) {
      throw new BadRequestException(
        'Não é possível deletar cargo que está atribuído a usuários',
      );
    }

    const { error } = await this.supabase.getClient()
      .from('roles')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new BadRequestException('Erro ao deletar cargo');
    }

    return { message: 'Cargo deletado com sucesso' };
  }

  /**
   * Atribui um cargo a um usuário
   */
  async assignRole(
    tenantId: string,
    assignRoleDto: AssignRoleDto,
    assignedBy: string,
  ) {
    const { user_id, role_id, school_id } = assignRoleDto;

    // Verificar se o cargo existe
    await this.findOne(role_id, tenantId);

    // Verificar se já existe esta atribuição
    const query = this.supabase.getClient()
      .from('user_roles')
      .select('id')
      .eq('user_id', user_id)
      .eq('role_id', role_id)
      .eq('tenant_id', tenantId);

    if (school_id) {
      query.eq('school_id', school_id);
    } else {
      query.is('school_id', null);
    }

    const { data: existing } = await query.single();

    if (existing) {
      throw new BadRequestException('Usuário já possui este cargo');
    }

    // Criar atribuição
    const { data, error } = await this.supabase.getClient()
      .from('user_roles')
      .insert({
        user_id,
        role_id,
        tenant_id: tenantId,
        school_id: school_id || null,
        assigned_by: assignedBy,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException('Erro ao atribuir cargo');
    }

    return data;
  }

  /**
   * Remove um cargo de um usuário
   */
  async removeRole(
    tenantId: string,
    userId: string,
    roleId: string,
    schoolId?: string,
  ) {
    const query = this.supabase.getClient()
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role_id', roleId)
      .eq('tenant_id', tenantId);

    if (schoolId) {
      query.eq('school_id', schoolId);
    } else {
      query.is('school_id', null);
    }

    const { error } = await query;

    if (error) {
      throw new BadRequestException('Erro ao remover cargo');
    }

    return { message: 'Cargo removido com sucesso' };
  }

  /**
   * Lista todos os cargos de um usuário
   */
  async getUserRoles(auth0Id: string, tenantId: string, schoolId?: string) {
    this.logger.debug('Buscando roles do usuário', 'RolesService', {
      auth0Id,
      tenantId,
      schoolId,
    });

    // 1. Primeiro buscar o UUID do usuário pelo auth0_id
    const { data: userData, error: userError } = await this.supabase.getClient()
      .from('users')
      .select('id')
      .eq('auth0_id', auth0Id)
      .single();

    if (userError || !userData) {
      this.logger.warn('Usuário não encontrado', 'RolesService', {
        auth0Id,
        error: userError?.message,
      });
      // Retornar array vazio se usuário não existe (pode ser primeira vez)
      return [];
    }

    const userId = userData.id;

    // 2. Buscar roles do usuário usando o UUID
    const query = this.supabase.getClient()
      .from('user_roles')
      .select('*, roles(*)')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId);

    if (schoolId) {
      query.or(`school_id.eq.${schoolId},school_id.is.null`);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        'Erro ao buscar cargos do usuário',
        error.message,
        'RolesService',
        {
          auth0Id,
          userId,
          tenantId,
          schoolId,
          errorCode: error.code,
          errorDetails: error.details,
          errorHint: error.hint,
        },
      );
      throw new BadRequestException(
        `Erro ao buscar cargos do usuário: ${error.message}`,
      );
    }

    this.logger.debug('Roles encontrados', 'RolesService', {
      auth0Id,
      userId,
      count: data?.length || 0,
    });

    return data || [];
  }
}
