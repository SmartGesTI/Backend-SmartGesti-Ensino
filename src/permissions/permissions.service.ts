import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface PermissionContext {
  tenantId: string;
  schoolId?: string;
  userId: string;
}

@Injectable()
export class PermissionsService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Converte Auth0 ID para UUID do usuário
   * @param auth0Id - ID do Auth0 (ex: "google-oauth2|123...")
   * @returns UUID do usuário ou null se não encontrado
   */
  private async getUserUuidFromAuth0(auth0Id: string): Promise<string | null> {
    const { data, error } = await this.supabase.getClient()
      .from('users')
      .select('id')
      .eq('auth0_id', auth0Id)
      .single();

    if (error || !data) {
      return null;
    }

    return data.id;
  }

  /**
   * Verifica se o usuário é proprietário da instituição
   * @param auth0Id - ID do Auth0
   */
  async isOwner(auth0Id: string, tenantId: string): Promise<boolean> {
    const userId = await this.getUserUuidFromAuth0(auth0Id);
    console.log('[PermissionsService.isOwner] Verificando proprietário:', {
      auth0Id,
      userId,
      tenantId,
    });

    if (!userId) {
      console.log('[PermissionsService.isOwner] Usuário não encontrado no banco');
      return false;
    }

    const { data, error } = await this.supabase.getClient()
      .from('tenant_owners')
      .select('id')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .single();

    console.log('[PermissionsService.isOwner] Resultado query tenant_owners:', {
      data,
      error: error?.message,
      isOwner: !error && !!data,
    });

    return !error && !!data;
  }

  /**
   * Verifica se o usuário tem um cargo específico
   * @param auth0Id - ID do Auth0
   */
  async hasRole(
    auth0Id: string,
    roleSlug: string,
    tenantId: string,
    schoolId?: string,
  ): Promise<boolean> {
    const userId = await this.getUserUuidFromAuth0(auth0Id);
    if (!userId) {
      return false;
    }

    const query = this.supabase.getClient()
      .from('user_roles')
      .select('id, roles!inner(slug)')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('roles.slug', roleSlug);

    if (schoolId) {
      query.eq('school_id', schoolId);
    }

    const { data, error } = await query.single();

    return !error && !!data;
  }

  /**
   * Obtém todas as permissões do usuário (cargos + grupos + específicas)
   * @param auth0Id - ID do Auth0
   */
  async getUserPermissions(
    auth0Id: string,
    tenantId: string,
    schoolId?: string,
  ): Promise<Record<string, string[]>> {
    const permissions: Record<string, string[]> = {};

    // 1. Verificar se é proprietário (acesso total)
    const isOwner = await this.isOwner(auth0Id, tenantId);
    if (isOwner) {
      return { '*': ['*'] };
    }

    // 2. Converter Auth0 ID para UUID
    const userId = await this.getUserUuidFromAuth0(auth0Id);
    if (!userId) {
      // Usuário não existe no banco ainda
      return {};
    }

    // 3. Obter permissões dos cargos
    const rolePermissions = await this.getRolePermissions(
      userId,
      tenantId,
      schoolId,
    );
    this.mergePermissions(permissions, rolePermissions);

    // 4. Obter permissões dos grupos
    const groupPermissions = await this.getGroupPermissions(
      userId,
      tenantId,
      schoolId,
    );
    this.mergePermissions(permissions, groupPermissions);

    // 5. Obter permissões específicas do usuário
    const specificPermissions = await this.getSpecificPermissions(
      userId,
      tenantId,
      schoolId,
    );
    this.mergePermissions(permissions, specificPermissions);

    return permissions;
  }

  /**
   * Verifica se o usuário tem permissão para uma ação em um recurso
   * @param auth0Id - ID do Auth0
   */
  async checkPermission(
    auth0Id: string,
    resource: string,
    action: string,
    context: PermissionContext,
  ): Promise<boolean> {
    const { tenantId, schoolId } = context;

    // 1. Verificar se é proprietário
    const isOwner = await this.isOwner(auth0Id, tenantId);
    if (isOwner) {
      return true;
    }

    // 2. Obter todas as permissões
    const permissions = await this.getUserPermissions(
      auth0Id,
      tenantId,
      schoolId,
    );

    // 3. Verificar permissão global (*)
    if (permissions['*']?.includes('*')) {
      return true;
    }

    // 4. Verificar permissão específica do recurso
    if (permissions[resource]) {
      return (
        permissions[resource].includes(action) ||
        permissions[resource].includes('*') ||
        permissions[resource].includes('manage')
      );
    }

    // 5. Verificar se tem permissão global para a ação
    if (permissions['*']?.includes(action)) {
      return true;
    }

    return false;
  }

  /**
   * Obtém permissões dos cargos do usuário
   */
  private async getRolePermissions(
    userId: string,
    tenantId: string,
    schoolId?: string,
  ): Promise<Record<string, string[]>> {
    const query = this.supabase.getClient()
      .from('user_roles')
      .select('roles!inner(default_permissions)')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId);

    if (schoolId) {
      query.or(`school_id.eq.${schoolId},school_id.is.null`);
    } else {
      query.is('school_id', null);
    }

    const { data, error } = await query;

    if (error || !data) {
      return {};
    }

    const permissions: Record<string, string[]> = {};
    for (const row of data) {
      const rolePerms = (row as any).roles?.default_permissions || {};
      this.mergePermissions(permissions, rolePerms);
    }

    return permissions;
  }

  /**
   * Obtém permissões dos grupos do usuário
   */
  private async getGroupPermissions(
    userId: string,
    tenantId: string,
    schoolId?: string,
  ): Promise<Record<string, string[]>> {
    const query = this.supabase.getClient()
      .from('user_permission_groups')
      .select('permission_groups!inner(permissions)')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId);

    if (schoolId) {
      query.or(`school_id.eq.${schoolId},school_id.is.null`);
    } else {
      query.is('school_id', null);
    }

    const { data, error } = await query;

    if (error || !data) {
      return {};
    }

    const permissions: Record<string, string[]> = {};
    for (const row of data) {
      const groupPerms = (row as any).permission_groups?.permissions || {};
      this.mergePermissions(permissions, groupPerms);
    }

    return permissions;
  }

  /**
   * Obtém permissões específicas do usuário
   */
  private async getSpecificPermissions(
    userId: string,
    tenantId: string,
    schoolId?: string,
  ): Promise<Record<string, string[]>> {
    const query = this.supabase.getClient()
      .from('user_permissions')
      .select('resource, action')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId);

    if (schoolId) {
      query.or(`school_id.eq.${schoolId},school_id.is.null`);
    } else {
      query.is('school_id', null);
    }

    const { data, error } = await query;

    if (error || !data) {
      return {};
    }

    const permissions: Record<string, string[]> = {};
    for (const row of data) {
      if (!permissions[row.resource]) {
        permissions[row.resource] = [];
      }
      permissions[row.resource].push(row.action);
    }

    return permissions;
  }

  /**
   * Mescla permissões de diferentes fontes
   */
  private mergePermissions(
    target: Record<string, string[]>,
    source: Record<string, string[]>,
  ): void {
    for (const [resource, actions] of Object.entries(source)) {
      if (!target[resource]) {
        target[resource] = [];
      }
      for (const action of actions) {
        if (!target[resource].includes(action)) {
          target[resource].push(action);
        }
      }
    }
  }

  /**
   * Obtém o nível hierárquico mais alto do usuário
   * @param auth0Id - ID do Auth0
   */
  async getUserHighestHierarchy(
    auth0Id: string,
    tenantId: string,
    schoolId?: string,
  ): Promise<number> {
    // Proprietário tem hierarquia 0
    const isOwner = await this.isOwner(auth0Id, tenantId);
    if (isOwner) {
      return 0;
    }

    const userId = await this.getUserUuidFromAuth0(auth0Id);
    if (!userId) {
      return 999; // Sem usuário = hierarquia mais baixa
    }

    const query = this.supabase.getClient()
      .from('user_roles')
      .select('roles!inner(hierarchy_level)')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .order('roles.hierarchy_level', { ascending: true })
      .limit(1);

    if (schoolId) {
      query.or(`school_id.eq.${schoolId},school_id.is.null`);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return 999; // Sem cargo = hierarquia mais baixa
    }

    return (data as any).roles?.hierarchy_level || 999;
  }
}
