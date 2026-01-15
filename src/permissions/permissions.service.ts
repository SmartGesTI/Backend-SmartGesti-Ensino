import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  PermissionsCacheService,
  CachedPermissions,
} from './permissions-cache.service';

export interface PermissionContext {
  tenantId: string;
  schoolId?: string;
  userId: string;
}

/**
 * Interface para contexto completo de permissões (retornado pelo método otimizado)
 */
export interface PermissionContextResult {
  userId: string;
  isOwner: boolean;
  permissions: Record<string, string[]>;
  permissionsVersion: string;
}

@Injectable()
export class PermissionsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly permissionsCache: PermissionsCacheService,
  ) {}

  /**
   * Converte Supabase ID (armazenado em auth0_id) para UUID do usuário
   * @param supabaseId - UUID do Supabase (armazenado no campo auth0_id)
   * @returns UUID do usuário ou null se não encontrado
   */
  private async getUserUuidFromSupabase(
    supabaseId: string,
  ): Promise<string | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('users')
      .select('id')
      .eq('auth0_id', supabaseId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.id;
  }

  /**
   * MÉTODO PRINCIPAL OTIMIZADO - Obtém todo o contexto de permissões de uma vez
   * Usa cache com invalidação por permissions_version
   * @param supabaseId - UUID do Supabase (armazenado em auth0_id)
   * @param tenantId - UUID do tenant
   * @param schoolId - UUID da escola (opcional)
   * @returns Contexto completo com userId, isOwner, permissions
   */
  async getPermissionContext(
    supabaseId: string,
    tenantId: string,
    schoolId?: string,
  ): Promise<PermissionContextResult | null> {
    // 1. Buscar dados básicos do usuário (userId e permissionsVersion) - SEMPRE necessário
    const { data: userData, error: userError } = await this.supabase
      .getClient()
      .from('users')
      .select('id, permissions_version')
      .eq('auth0_id', supabaseId)
      .single();

    if (userError || !userData) {
      console.log(
        '[PermissionsService.getPermissionContext] Usuário não encontrado',
      );
      return null;
    }

    const userId = userData.id;
    const currentVersion = userData.permissions_version || 'default';

    // 2. Verificar cache
    const cached = this.permissionsCache.get(
      supabaseId,
      tenantId,
      currentVersion,
    );
    if (cached) {
      console.log('[PermissionsService.getPermissionContext] Cache HIT');
      return {
        userId: cached.userId,
        isOwner: cached.isOwner,
        permissions: cached.permissions,
        permissionsVersion: cached.permissionsVersion,
      };
    }

    console.log(
      '[PermissionsService.getPermissionContext] Cache MISS - calculando...',
    );

    // 3. Verificar se é owner
    const { data: ownerData } = await this.supabase
      .getClient()
      .from('tenant_owners')
      .select('id')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .single();

    const isOwner = !!ownerData;

    // 4. Obter permissões (se for owner, retorna permissões totais)
    let permissions: Record<string, string[]>;
    if (isOwner) {
      permissions = { '*': ['*'] };
    } else {
      // Obter permissões de roles, grupos e específicas em paralelo
      const [rolePermissions, groupPermissions, specificPermissions] =
        await Promise.all([
          this.getRolePermissions(userId, tenantId, schoolId),
          this.getGroupPermissions(userId, tenantId, schoolId),
          this.getSpecificPermissions(userId, tenantId, schoolId),
        ]);

      permissions = {};
      this.mergePermissions(permissions, rolePermissions);
      this.mergePermissions(permissions, groupPermissions);
      this.mergePermissions(permissions, specificPermissions);
    }

    // 5. Armazenar no cache
    const result: PermissionContextResult = {
      userId,
      isOwner,
      permissions,
      permissionsVersion: currentVersion,
    };

    this.permissionsCache.set(supabaseId, tenantId, result);

    return result;
  }

  /**
   * Verifica se o usuário é proprietário da instituição
   * @param supabaseId - UUID do Supabase (armazenado em auth0_id)
   */
  async isOwner(supabaseId: string, tenantId: string): Promise<boolean> {
    // Tentar usar cache primeiro
    const cached = this.permissionsCache.get(supabaseId, tenantId);
    if (cached) {
      console.log('[PermissionsService.isOwner] Usando cache');
      return cached.isOwner;
    }

    // Se não tem cache, calcular (mas sem popular cache completo)
    const userId = await this.getUserUuidFromSupabase(supabaseId);
    console.log('[PermissionsService.isOwner] Verificando proprietário:', {
      supabaseId,
      userId,
      tenantId,
    });

    if (!userId) {
      console.log(
        '[PermissionsService.isOwner] Usuário não encontrado no banco',
      );
      return false;
    }

    const { data, error } = await this.supabase
      .getClient()
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
   * @param supabaseId - UUID do Supabase (armazenado em auth0_id)
   */
  async hasRole(
    supabaseId: string,
    roleSlug: string,
    tenantId: string,
    schoolId?: string,
  ): Promise<boolean> {
    const userId = await this.getUserUuidFromSupabase(supabaseId);
    if (!userId) {
      return false;
    }

    const query = this.supabase
      .getClient()
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
   * VERSÃO OTIMIZADA - Usa cache
   * @param supabaseId - UUID do Supabase (armazenado em auth0_id)
   */
  async getUserPermissions(
    supabaseId: string,
    tenantId: string,
    schoolId?: string,
  ): Promise<Record<string, string[]>> {
    // Usar método otimizado com cache
    const context = await this.getPermissionContext(
      supabaseId,
      tenantId,
      schoolId,
    );
    return context?.permissions || {};
  }

  /**
   * Versão otimizada que aceita isOwner pré-calculado para evitar queries duplicadas
   */
  async getUserPermissionsWithOwner(
    supabaseId: string,
    tenantId: string,
    schoolId: string | undefined,
    isOwner: boolean,
  ): Promise<Record<string, string[]>> {
    // Proprietário tem acesso total
    if (isOwner) {
      return { '*': ['*'] };
    }

    const permissions: Record<string, string[]> = {};

    // Converter Auth0 ID para UUID
    const userId = await this.getUserUuidFromSupabase(supabaseId);
    if (!userId) {
      return {};
    }

    // Obter permissões dos cargos, grupos e específicas em paralelo
    const [rolePermissions, groupPermissions, specificPermissions] =
      await Promise.all([
        this.getRolePermissions(userId, tenantId, schoolId),
        this.getGroupPermissions(userId, tenantId, schoolId),
        this.getSpecificPermissions(userId, tenantId, schoolId),
      ]);

    this.mergePermissions(permissions, rolePermissions);
    this.mergePermissions(permissions, groupPermissions);
    this.mergePermissions(permissions, specificPermissions);

    return permissions;
  }

  /**
   * Verifica se o usuário tem permissão para uma ação em um recurso
   * @param supabaseId - UUID do Supabase (armazenado em auth0_id)
   */
  async checkPermission(
    supabaseId: string,
    resource: string,
    action: string,
    context: PermissionContext,
  ): Promise<boolean> {
    const { tenantId, schoolId } = context;

    console.log('[PermissionsService.checkPermission] Verificando permissão:', {
      supabaseId,
      resource,
      action,
      tenantId,
      schoolId,
    });

    // 1. Verificar se é proprietário
    const isOwner = await this.isOwner(supabaseId, tenantId);
    console.log('[PermissionsService.checkPermission] Resultado isOwner:', {
      isOwner,
      supabaseId,
      tenantId,
    });

    if (isOwner) {
      console.log(
        '[PermissionsService.checkPermission] Usuário é owner, permitindo acesso',
      );
      return true;
    }

    // 2. Obter todas as permissões
    const permissions = await this.getUserPermissions(
      supabaseId,
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
    const query = this.supabase
      .getClient()
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
    const query = this.supabase
      .getClient()
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
    const query = this.supabase
      .getClient()
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
   * @param supabaseId - UUID do Supabase (armazenado em auth0_id)
   */
  async getUserHighestHierarchy(
    supabaseId: string,
    tenantId: string,
    schoolId?: string,
  ): Promise<number> {
    const isOwner = await this.isOwner(supabaseId, tenantId);
    return this.getUserHighestHierarchyWithOwner(
      supabaseId,
      tenantId,
      schoolId,
      isOwner,
    );
  }

  /**
   * Versão otimizada que aceita isOwner pré-calculado
   */
  async getUserHighestHierarchyWithOwner(
    supabaseId: string,
    tenantId: string,
    schoolId: string | undefined,
    isOwner: boolean,
  ): Promise<number> {
    // Proprietário tem hierarquia 0
    if (isOwner) {
      return 0;
    }

    const userId = await this.getUserUuidFromSupabase(supabaseId);
    if (!userId) {
      return 999;
    }

    const query = this.supabase
      .getClient()
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
      return 999;
    }

    return (data as any).roles?.hierarchy_level || 999;
  }

  /**
   * Atualiza permissions_version do usuário (invalida cache no frontend)
   * Chamado sempre que permissões/roles do usuário mudam
   * @param userId - UUID do usuário (não Supabase ID)
   * @returns Novo UUID gerado para permissions_version
   */
  async invalidateUserPermissionsVersion(userId: string): Promise<string> {
    // Usar crypto.randomUUID() para gerar novo UUID
    const crypto = await import('crypto');
    const newVersion = crypto.randomUUID();

    const { error } = await this.supabase
      .getClient()
      .from('users')
      .update({ permissions_version: newVersion })
      .eq('id', userId);

    if (error) {
      console.error(
        '[PermissionsService] Erro ao atualizar permissions_version:',
        error,
      );
      throw new Error(
        `Erro ao invalidar versão de permissões: ${error.message}`,
      );
    }

    return newVersion;
  }

  /**
   * Obtém permissions_version do usuário
   * @param supabaseId - UUID do Supabase (armazenado em auth0_id)
   * @returns permissions_version UUID ou null se não encontrado
   */
  async getUserPermissionsVersion(supabaseId: string): Promise<string | null> {
    const userId = await this.getUserUuidFromSupabase(supabaseId);
    if (!userId) {
      return null;
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('users')
      .select('permissions_version')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.permissions_version;
  }
}
