import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { PermissionsService } from '../permissions/permissions.service';

export interface AgentAccess {
  canView: boolean;
  canExecute: boolean;
  canEdit: boolean;
  canDelete: boolean;
  reason?: string;
}

/**
 * Interface do agente para verificação de permissões
 * 
 * Visibilidade simplificada:
 * - public: Todos da escola podem ver e usar
 * - public_collaborative: Público + qualquer um edita, só dono apaga
 * - private: Só o dono vê e edita
 */
interface Agent {
  id: string;
  created_by: string | null;
  status?: 'draft' | 'published';
  visibility: 'public' | 'public_collaborative' | 'private';
  // Campos depreciados (mantidos para compatibilidade)
  type?: 'public_school' | 'public_editable' | 'private' | 'restricted';
}

@Injectable()
export class AgentsPermissionsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly permissionsService: PermissionsService,
  ) {}

  /**
   * Verifica acesso completo ao agente
   * 
   * Lógica simplificada de permissões:
   * - Owner da instituição: acesso total a tudo
   * - Dono do agente: acesso total ao seu agente
   * - public: todos veem e usam
   * - public_collaborative: todos veem, usam e editam, só dono apaga
   * - private: só dono vê e edita
   * - draft: só dono vê (rascunhos não são públicos)
   */
  async checkAgentAccess(
    agent: Agent,
    userId: string,
    userPermissions: Record<string, string[]>,
    userRoles: Array<{ id: string; slug: string }>,
    tenantId: string,
    schoolId?: string,
    isOwnerOfTenant?: boolean,
  ): Promise<AgentAccess> {
    // 1. Owner da instituição tem acesso total
    if (isOwnerOfTenant) {
      return {
        canView: true,
        canExecute: true,
        canEdit: true,
        canDelete: true,
        reason: 'Owner da instituição',
      };
    }

    // 2. Verificar se é dono do agente
    const isOwner = agent.created_by === userId;
    
    // 3. Dono tem acesso total ao seu agente
    if (isOwner) {
      return {
        canView: true,
        canExecute: true,
        canEdit: true,
        canDelete: true,
        reason: 'Dono do agente',
      };
    }

    // 4. Rascunhos só são visíveis para o dono
    if (agent.status === 'draft') {
      return {
        canView: false,
        canExecute: false,
        canEdit: false,
        canDelete: false,
        reason: 'Rascunho - visível apenas para o dono',
      };
    }

    // 5. Verificar bloqueios explícitos
    const restrictions = await this.getAgentRestrictions(
      agent.id,
      userId,
      userRoles.map((r) => r.id),
    );

    if (restrictions.isBlocked) {
      return {
        canView: !restrictions.blockView,
        canExecute: !restrictions.blockExecute,
        canEdit: false,
        canDelete: false,
        reason: restrictions.reason || 'Acesso bloqueado',
      };
    }

    // 6. Verificar Permissões RBAC Globais (pre-requisito)
    const hasRbacView =
      this.checkPermission(userPermissions, 'agents', 'read') ||
      this.checkPermission(userPermissions, 'agents', 'view');
    
    const hasRbacExecute = this.checkPermission(userPermissions, 'agents', 'execute');
    
    const hasRbacEdit =
      this.checkPermission(userPermissions, 'agents', 'update') ||
      this.checkPermission(userPermissions, 'agents', 'manage');

    if (!hasRbacView) {
      return {
        canView: false,
        canExecute: false,
        canEdit: false,
        canDelete: false,
        reason: 'Sem permissão RBAC para visualizar agentes',
      };
    }

    // 7. Aplicar regras de visibilidade simplificadas
    // Normalizar visibility (compatibilidade com valores antigos)
    const visibility = this.normalizeVisibility(agent);

    switch (visibility) {
      case 'public':
        // Todos da escola veem e usam, só dono edita
        return {
          canView: true,
          canExecute: hasRbacExecute,
          canEdit: false,
          canDelete: false,
          reason: 'Agente público',
        };

      case 'public_collaborative':
        // Todos veem, usam e editam, só dono apaga
        return {
          canView: true,
          canExecute: hasRbacExecute,
          canEdit: hasRbacEdit,
          canDelete: false,
          reason: 'Agente colaborativo',
        };

      case 'private':
      default:
        // Só dono vê (já verificado acima, se chegou aqui não é dono)
        return {
          canView: false,
          canExecute: false,
          canEdit: false,
          canDelete: false,
          reason: 'Agente privado',
        };
    }
  }

  /**
   * Normaliza visibility para o novo sistema
   * Compatibilidade com valores antigos: public_school, public_editable, restricted
   */
  private normalizeVisibility(agent: Agent): 'public' | 'public_collaborative' | 'private' {
    // Se já tem o novo formato
    if (agent.visibility === 'public_collaborative') {
      return 'public_collaborative';
    }
    
    // Compatibilidade com type antigo
    if (agent.type === 'public_editable') {
      return 'public_collaborative';
    }
    
    // public_school e public -> public
    if (agent.visibility === 'public' || agent.type === 'public_school') {
      return 'public';
    }
    
    // Tudo mais é privado
    return 'private';
  }

  /**
   * Verifica se pode visualizar agente
   */
  async canView(
    agent: Agent,
    userId: string,
    userPermissions: Record<string, string[]>,
    userRoles: Array<{ id: string; slug: string }>,
    tenantId: string,
    isOwnerOfTenant?: boolean,
  ): Promise<boolean> {
    const access = await this.checkAgentAccess(
      agent,
      userId,
      userPermissions,
      userRoles,
      tenantId,
      undefined,
      isOwnerOfTenant,
    );
    return access.canView;
  }

  /**
   * Verifica se pode executar agente
   */
  async canExecute(
    agent: Agent,
    userId: string,
    userPermissions: Record<string, string[]>,
    userRoles: Array<{ id: string; slug: string }>,
    tenantId: string,
    isOwnerOfTenant?: boolean,
  ): Promise<boolean> {
    const access = await this.checkAgentAccess(
      agent,
      userId,
      userPermissions,
      userRoles,
      tenantId,
      undefined,
      isOwnerOfTenant,
    );
    return access.canExecute;
  }

  /**
   * Verifica se pode editar agente
   */
  async canEdit(
    agent: Agent,
    userId: string,
    userPermissions: Record<string, string[]>,
    userRoles: Array<{ id: string; slug: string }>,
    tenantId: string,
    isOwnerOfTenant?: boolean,
  ): Promise<boolean> {
    const access = await this.checkAgentAccess(
      agent,
      userId,
      userPermissions,
      userRoles,
      tenantId,
      undefined,
      isOwnerOfTenant,
    );
    return access.canEdit;
  }

  /**
   * Verifica se pode deletar agente
   */
  async canDelete(
    agent: Agent,
    userId: string,
    userPermissions: Record<string, string[]>,
    tenantId: string,
    isOwnerOfTenant?: boolean,
  ): Promise<boolean> {
    // Owner da instituição pode deletar qualquer agente
    if (isOwnerOfTenant) {
      return true;
    }
    
    // Dono do agente pode deletar
    if (agent.created_by === userId) {
      return true;
    }

    // Quem tem permissão de delete pode deletar
    return (
      this.checkPermission(userPermissions, 'agents', 'delete') ||
      this.checkPermission(userPermissions, 'agents', 'manage')
    );
  }

  /**
   * Obtém permissões específicas do agente
   */
  private async getAgentPermissions(
    agentId: string,
    userId: string,
    roleIds: string[],
  ): Promise<{ canView?: boolean; canExecute?: boolean; canEdit?: boolean } | null> {
    // Buscar permissão por usuário
    const { data: userPerm } = await this.supabase
      .getClient()
      .from('agent_permissions')
      .select('can_view, can_execute, can_edit')
      .eq('agent_id', agentId)
      .eq('user_id', userId)
      .single();

    if (userPerm) {
      return {
        canView: userPerm.can_view ?? undefined,
        canExecute: userPerm.can_execute ?? undefined,
        canEdit: userPerm.can_edit ?? undefined,
      };
    }

    // Buscar permissão por role
    if (roleIds.length > 0) {
      const { data: rolePerms } = await this.supabase
        .getClient()
        .from('agent_permissions')
        .select('can_view, can_execute, can_edit')
        .eq('agent_id', agentId)
        .in('role_id', roleIds)
        .limit(1);

      if (rolePerms && rolePerms.length > 0) {
        const perm = rolePerms[0];
        return {
          canView: perm.can_view ?? undefined,
          canExecute: perm.can_execute ?? undefined,
          canEdit: perm.can_edit ?? undefined,
        };
      }
    }

    return null;
  }

  /**
   * Obtém bloqueios do agente
   */
  /**
   * Busca restrições de múltiplos agentes de uma vez (batch) para otimizar performance
   */
  async getAgentRestrictionsBatch(
    agentIds: string[],
    userId: string,
    roleIds: string[],
  ): Promise<Record<string, {
    isBlocked: boolean;
    blockView: boolean;
    blockExecute: boolean;
    blockEdit: boolean;
    reason?: string;
  }>> {
    if (agentIds.length === 0) {
      return {};
    }

    const restrictionsMap: Record<string, {
      isBlocked: boolean;
      blockView: boolean;
      blockExecute: boolean;
      blockEdit: boolean;
      reason?: string;
    }> = {};

    // Inicializar todos como não bloqueados
    agentIds.forEach(id => {
      restrictionsMap[id] = {
        isBlocked: false,
        blockView: false,
        blockExecute: false,
        blockEdit: false,
      };
    });

    // Buscar bloqueios por usuário (batch)
    const { data: userRestrictions } = await this.supabase
      .getClient()
      .from('agent_restrictions')
      .select('agent_id, block_view, block_execute, block_edit, reason')
      .eq('user_id', userId)
      .in('agent_id', agentIds);

    if (userRestrictions) {
      userRestrictions.forEach((restriction: any) => {
        restrictionsMap[restriction.agent_id] = {
          isBlocked:
            restriction.block_view ||
            restriction.block_execute ||
            restriction.block_edit,
          blockView: restriction.block_view || false,
          blockExecute: restriction.block_execute || false,
          blockEdit: restriction.block_edit || false,
          reason: restriction.reason,
        };
      });
    }

    // Buscar bloqueios por role (batch) - apenas para agentes que não têm bloqueio por usuário
    if (roleIds.length > 0) {
      const agentsWithoutUserRestriction = agentIds.filter(
        id => !restrictionsMap[id].isBlocked
      );

      if (agentsWithoutUserRestriction.length > 0) {
        const { data: roleRestrictions } = await this.supabase
          .getClient()
          .from('agent_restrictions')
          .select('agent_id, block_view, block_execute, block_edit, reason')
          .in('agent_id', agentsWithoutUserRestriction)
          .in('role_id', roleIds);

        if (roleRestrictions) {
          roleRestrictions.forEach((restriction: any) => {
            // Só atualizar se ainda não tem bloqueio
            if (!restrictionsMap[restriction.agent_id].isBlocked) {
              restrictionsMap[restriction.agent_id] = {
                isBlocked:
                  restriction.block_view ||
                  restriction.block_execute ||
                  restriction.block_edit,
                blockView: restriction.block_view || false,
                blockExecute: restriction.block_execute || false,
                blockEdit: restriction.block_edit || false,
                reason: restriction.reason,
              };
            }
          });
        }
      }
    }

    return restrictionsMap;
  }

  /**
   * Versão otimizada de checkAgentAccess que recebe restrições pré-carregadas
   */
  async checkAgentAccessOptimized(
    agent: Agent,
    userId: string,
    userPermissions: Record<string, string[]>,
    userRoles: Array<{ id: string; slug: string }>,
    tenantId: string,
    schoolId: string | undefined,
    restrictions?: {
      isBlocked: boolean;
      blockView: boolean;
      blockExecute: boolean;
      blockEdit: boolean;
      reason?: string;
    },
  ): Promise<AgentAccess> {
    // 1. Verificar se é dono
    const isOwner = agent.created_by === userId;
    
    // 2. public_school nunca editável (nem pelo dono)
    if (agent.type === 'public_school') {
      if (isOwner) {
        return {
          canView: true,
          canExecute: true,
          canEdit: false,
          canDelete: false,
          reason: 'Agente público da escola - protegido',
        };
      }
    }

    // 3. Se é dono, acesso total (exceto public_school já tratado)
    if (isOwner) {
      return {
        canView: true,
        canExecute: true,
        canEdit: agent.type !== 'public_school',
        canDelete: true,
      };
    }

    // 4. Verificar bloqueios explícitos (usar restrições pré-carregadas)
    const agentRestrictions = restrictions || {
      isBlocked: false,
      blockView: false,
      blockExecute: false,
      blockEdit: false,
    };

    if (agentRestrictions.isBlocked) {
      return {
        canView: !agentRestrictions.blockView,
        canExecute: !agentRestrictions.blockExecute,
        canEdit: false,
        canDelete: false,
        reason: agentRestrictions.reason || 'Acesso bloqueado',
      };
    }

    // 5. Verificar Permissões RBAC Globais
    const rbacPerms = {
      canViewAgents:
        this.checkPermission(userPermissions, 'agents', 'read') ||
        this.checkPermission(userPermissions, 'agents', 'view'),
      canExecuteAgents: this.checkPermission(
        userPermissions,
        'agents',
        'execute',
      ),
      canEditAgents:
        this.checkPermission(userPermissions, 'agents', 'update') ||
        this.checkPermission(userPermissions, 'agents', 'manage'),
      canDeleteAgents:
        this.checkPermission(userPermissions, 'agents', 'delete') ||
        this.checkPermission(userPermissions, 'agents', 'manage'),
    };

    // Se não tem permissão RBAC básica para ver agentes, negar acesso
    if (!rbacPerms.canViewAgents) {
      return {
        canView: false,
        canExecute: false,
        canEdit: false,
        canDelete: false,
        reason: 'Sem permissão para visualizar agentes',
      };
    }

    // 6. Verificar visibilidade do agente
    const finalAccess: AgentAccess = {
      canView: rbacPerms.canViewAgents,
      canExecute: rbacPerms.canExecuteAgents,
      canEdit: rbacPerms.canEditAgents,
      canDelete: rbacPerms.canDeleteAgents,
    };

    // Aplicar regras de visibilidade
    if (agent.visibility === 'private' && agent.created_by !== userId) {
      finalAccess.canView = false;
      finalAccess.canExecute = false;
      finalAccess.canEdit = false;
      finalAccess.canDelete = false;
    }

    if (agent.type === 'public_school') {
      finalAccess.canEdit = false;
    }

    return finalAccess;
  }

  private async getAgentRestrictions(
    agentId: string,
    userId: string,
    roleIds: string[],
  ): Promise<{
    isBlocked: boolean;
    blockView: boolean;
    blockExecute: boolean;
    blockEdit: boolean;
    reason?: string;
  }> {
    // Buscar bloqueio por usuário
    const { data: userRestriction } = await this.supabase
      .getClient()
      .from('agent_restrictions')
      .select('block_view, block_execute, block_edit, reason')
      .eq('agent_id', agentId)
      .eq('user_id', userId)
      .single();

    if (userRestriction) {
      return {
        isBlocked:
          userRestriction.block_view ||
          userRestriction.block_execute ||
          userRestriction.block_edit,
        blockView: userRestriction.block_view || false,
        blockExecute: userRestriction.block_execute || false,
        blockEdit: userRestriction.block_edit || false,
        reason: userRestriction.reason,
      };
    }

    // Buscar bloqueio por role
    if (roleIds.length > 0) {
      const { data: roleRestrictions } = await this.supabase
        .getClient()
        .from('agent_restrictions')
        .select('block_view, block_execute, block_edit, reason')
        .eq('agent_id', agentId)
        .in('role_id', roleIds)
        .limit(1);

      if (roleRestrictions && roleRestrictions.length > 0) {
        const restriction = roleRestrictions[0];
        return {
          isBlocked:
            restriction.block_view ||
            restriction.block_execute ||
            restriction.block_edit,
          blockView: restriction.block_view || false,
          blockExecute: restriction.block_execute || false,
          blockEdit: restriction.block_edit || false,
          reason: restriction.reason,
        };
      }
    }

    return {
      isBlocked: false,
      blockView: false,
      blockExecute: false,
      blockEdit: false,
    };
  }

  /**
   * Verifica permissão RBAC
   */
  private checkPermission(
    permissions: Record<string, string[]>,
    resource: string,
    action: string,
  ): boolean {
    // Verificar permissão global (*)
    if (permissions['*']?.includes('*')) {
      return true;
    }

    // Verificar permissão específica do recurso
    if (permissions[resource]) {
      return (
        permissions[resource].includes(action) ||
        permissions[resource].includes('*') ||
        permissions[resource].includes('manage')
      );
    }

    // Verificar se tem permissão global para a ação
    if (permissions['*']?.includes(action)) {
      return true;
    }

    return false;
  }
}