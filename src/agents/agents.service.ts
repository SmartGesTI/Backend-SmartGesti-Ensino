import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import {
  PermissionsService,
  PermissionContextResult,
} from '../permissions/permissions.service';
import { RolesService } from '../roles/roles.service';
import { AgentsPermissionsService } from './agents.permissions.service';
import { WorkflowExecutorService } from './workflow-executor.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { SchoolsService } from '../schools/schools.service';
import { MarkdownPdfService } from './markdown-pdf.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { CreateAgentPermissionDto } from './dto/agent-permission.dto';
import { CreateAgentRestrictionDto } from './dto/agent-restriction.dto';
import { ExecutionResult } from './workflow-executor.service';

@Injectable()
export class AgentsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly logger: LoggerService,
    @Inject(forwardRef(() => PermissionsService))
    private readonly permissionsService: PermissionsService,
    private readonly workflowExecutor: WorkflowExecutorService,
    @Inject(forwardRef(() => RolesService))
    private readonly rolesService: RolesService,
    private readonly agentsPermissionsService: AgentsPermissionsService,
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
    private readonly schoolsService: SchoolsService,
    private readonly markdownPdfService: MarkdownPdfService,
  ) {}

  /**
   * Converte Supabase ID para UUID do usuário
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
   * Lista todos os agentes (filtrado por permissões)
   * @param permContext - Contexto de permissões já calculado (opcional, para otimização)
   */
  async findAll(
    supabaseId: string,
    tenantId: string,
    schoolId?: string,
    filters?: {
      category?: string;
      type?: string;
      is_template?: boolean;
      search?: string;
      status?: string;
      visibility?: string;
      myAgents?: boolean;
    },
    permContext?: PermissionContextResult,
  ) {
    // OTIMIZAÇÃO: Usar contexto já calculado se disponível
    let userId: string;
    let userPermissions: Record<string, string[]>;
    let isOwner: boolean;

    if (permContext) {
      // Usar dados do contexto (já cacheados)
      userId = permContext.userId;
      userPermissions = permContext.permissions;
      isOwner = permContext.isOwner;
      this.logger.log(
        'Usando contexto de permissões pré-calculado',
        'AgentsService',
      );
    } else {
      // Fallback: calcular (isso não deveria acontecer se o guard está funcionando)
      this.logger.log(
        'Calculando contexto de permissões (fallback)',
        'AgentsService',
      );
      const context = await this.permissionsService.getPermissionContext(
        supabaseId,
        tenantId,
        schoolId,
      );
      if (!context) {
        throw new BadRequestException('Usuário não encontrado');
      }
      userId = context.userId;
      userPermissions = context.permissions;
      isOwner = context.isOwner;
    }

    // Verificar se tem permissão para ver agentes
    const canViewAgents =
      this.checkPermission(userPermissions, 'agents', 'read') ||
      this.checkPermission(userPermissions, 'agents', 'view');

    if (!canViewAgents) {
      return [];
    }

    // Buscar agentes
    let query = this.supabase
      .getClient()
      .from('agents')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (schoolId) {
      query.or(`school_id.eq.${schoolId},school_id.is.null`);
    } else {
      query.is('school_id', null);
    }

    if (filters?.category) {
      query.eq('category', filters.category);
    }

    if (filters?.type) {
      query.eq('type', filters.type);
    }

    if (filters?.is_template !== undefined) {
      query.eq('is_template', filters.is_template);
    }

    if (filters?.search) {
      query.or(
        `name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`,
      );
    }

    // Novos filtros para status e visibility
    if (filters?.status) {
      query.eq('status', filters.status);
    }

    if (filters?.visibility) {
      query.eq('visibility', filters.visibility);
    }

    // Se myAgents=true, filtrar apenas agentes do usuário atual
    if (filters?.myAgents) {
      query.eq('created_by', userId);
    }

    const { data: agents, error } = await query.order('created_at', {
      ascending: false,
    });

    if (error) {
      this.logger.error(
        'Erro ao buscar agentes',
        error.message,
        'AgentsService',
      );
      throw new BadRequestException('Erro ao buscar agentes');
    }

    // Se owner, retornar todos os agentes diretamente
    if (isOwner) {
      this.logger.log(
        'Usuário é owner, retornando todos os agentes sem verificação individual',
        'AgentsService',
      );
      return agents || [];
    }

    // Se não é owner, verificar permissões individuais
    // Buscar roles do usuário
    const userRoles = await this.rolesService
      .getUserRoles(supabaseId, tenantId, schoolId)
      .catch(() => []);

    const userRolesMapped = userRoles.map((r: any) => ({
      id: r.role_id || r.roles?.id,
      slug: r.roles?.slug || '',
    }));

    // Buscar todas as restrições de uma vez (batch) para otimizar
    const agentIds = (agents || []).map((a: any) => a.id);
    const allRestrictions =
      await this.agentsPermissionsService.getAgentRestrictionsBatch(
        agentIds,
        userId,
        userRolesMapped.map((r) => r.id),
      );

    // Filtrar por permissões específicas
    const filteredAgents: any[] = [];
    for (const agent of agents || []) {
      const access =
        await this.agentsPermissionsService.checkAgentAccessOptimized(
          agent,
          userId,
          userPermissions,
          userRolesMapped,
          tenantId,
          schoolId,
          allRestrictions[agent.id], // Passar restrições já carregadas
        );

      if (access.canView) {
        filteredAgents.push(agent);
      }
    }

    return filteredAgents;
  }

  /**
   * Busca um agente por ID
   */
  async findOne(
    id: string,
    supabaseId: string,
    tenantId: string,
    schoolId?: string,
  ) {
    const userId = await this.getUserUuidFromSupabase(supabaseId);
    if (!userId) {
      throw new BadRequestException('Usuário não encontrado');
    }

    const { data: agent, error } = await this.supabase
      .getClient()
      .from('agents')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !agent) {
      throw new NotFoundException('Agente não encontrado');
    }

    // Verificar permissões
    const userPermissions = await this.permissionsService.getUserPermissions(
      supabaseId,
      tenantId,
      schoolId,
    );

    const userRoles = await this.rolesService
      .getUserRoles(supabaseId, tenantId, schoolId)
      .catch(() => []);

    const access = await this.agentsPermissionsService.checkAgentAccess(
      agent,
      userId,
      userPermissions,
      userRoles.map((r: any) => ({
        id: r.role_id || r.roles?.id,
        slug: r.roles?.slug || '',
      })),
      tenantId,
      schoolId,
    );

    if (!access.canView) {
      throw new ForbiddenException('Sem permissão para visualizar este agente');
    }

    return agent;
  }

  /**
   * Cria um novo agente
   */
  async create(dto: CreateAgentDto, supabaseId: string, tenantId: string) {
    const userId = await this.getUserUuidFromSupabase(supabaseId);
    if (!userId) {
      throw new BadRequestException('Usuário não encontrado');
    }

    // Verificar permissão RBAC para criar agentes
    const userPermissions = await this.permissionsService.getUserPermissions(
      supabaseId,
      tenantId,
    );

    const canCreate = this.checkPermission(userPermissions, 'agents', 'create');

    if (!canCreate) {
      throw new ForbiddenException('Sem permissão para criar agentes');
    }

    const { data: agent, error } = await this.supabase
      .getClient()
      .from('agents')
      .insert({
        tenant_id: tenantId,
        school_id: dto.school_id || null,
        created_by: userId,
        name: dto.name,
        description: dto.description,
        icon: dto.icon,
        category: dto.category,
        workflow: dto.workflow,
        rating: dto.rating,
        difficulty: dto.difficulty,
        use_case: dto.use_case,
        flow: dto.flow,
        tags: dto.tags || [],
        estimated_time: dto.estimated_time,
        category_tags: dto.category_tags || [],
        type: dto.type || 'private',
        visibility: dto.visibility || 'private',
        status: dto.status || 'draft', // Novos agentes começam como rascunho
        settings: dto.settings || {},
        is_active: dto.is_active !== undefined ? dto.is_active : true,
        is_template: dto.is_template || false,
        use_auto_layout:
          dto.use_auto_layout !== undefined ? dto.use_auto_layout : true,
        best_uses: dto.best_uses || [],
        how_it_helps: dto.how_it_helps || '',
        usage_count: 0,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Erro ao criar agente', error.message, 'AgentsService');
      throw new BadRequestException('Erro ao criar agente');
    }

    return agent;
  }

  /**
   * Atualiza um agente
   */
  async update(
    id: string,
    dto: UpdateAgentDto,
    supabaseId: string,
    tenantId: string,
    schoolId?: string,
  ) {
    const userId = await this.getUserUuidFromSupabase(supabaseId);
    if (!userId) {
      throw new BadRequestException('Usuário não encontrado');
    }

    // Buscar agente
    const agent = await this.findOne(id, supabaseId, tenantId, schoolId);

    // Verificar permissão para editar
    const permContext = await this.permissionsService.getPermissionContext(
      supabaseId,
      tenantId,
      schoolId,
    );

    if (!permContext) {
      throw new BadRequestException('Usuário não encontrado');
    }

    const userRoles = await this.rolesService
      .getUserRoles(supabaseId, tenantId, schoolId)
      .catch(() => []);

    const canEdit = await this.agentsPermissionsService.canEdit(
      agent,
      userId,
      permContext.permissions,
      userRoles.map((r: any) => ({
        id: r.role_id || r.roles?.id,
        slug: r.roles?.slug || '',
      })),
      tenantId,
      permContext.isOwner, // Owner da instituição tem acesso total
    );

    if (!canEdit) {
      throw new ForbiddenException('Sem permissão para editar este agente');
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.icon !== undefined) updateData.icon = dto.icon;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.workflow !== undefined) updateData.workflow = dto.workflow;
    if (dto.rating !== undefined) updateData.rating = dto.rating;
    if (dto.difficulty !== undefined) updateData.difficulty = dto.difficulty;
    if (dto.use_case !== undefined) updateData.use_case = dto.use_case;
    if (dto.flow !== undefined) updateData.flow = dto.flow;
    if (dto.tags !== undefined) updateData.tags = dto.tags;
    if (dto.estimated_time !== undefined)
      updateData.estimated_time = dto.estimated_time;
    if (dto.category_tags !== undefined)
      updateData.category_tags = dto.category_tags;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.visibility !== undefined) updateData.visibility = dto.visibility;
    if (dto.settings !== undefined) updateData.settings = dto.settings;
    if (dto.is_active !== undefined) updateData.is_active = dto.is_active;
    if (dto.is_template !== undefined) updateData.is_template = dto.is_template;
    if (dto.use_auto_layout !== undefined)
      updateData.use_auto_layout = dto.use_auto_layout;
    if (dto.best_uses !== undefined) updateData.best_uses = dto.best_uses;
    if (dto.how_it_helps !== undefined)
      updateData.how_it_helps = dto.how_it_helps;
    if (dto.status !== undefined) updateData.status = dto.status;

    const { data: updatedAgent, error } = await this.supabase
      .getClient()
      .from('agents')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      this.logger.error(
        'Erro ao atualizar agente',
        error.message,
        'AgentsService',
      );
      throw new BadRequestException('Erro ao atualizar agente');
    }

    return updatedAgent;
  }

  /**
   * Deleta um agente
   * @param permContext - Contexto de permissões já calculado (opcional, para otimização)
   */
  async delete(
    id: string,
    supabaseId: string,
    tenantId: string,
    permContext?: PermissionContextResult,
  ) {
    // OTIMIZAÇÃO: Usar contexto já calculado se disponível
    let userId: string;
    let userPermissions: Record<string, string[]>;

    if (permContext) {
      userId = permContext.userId;
      userPermissions = permContext.permissions;
    } else {
      // Fallback: calcular
      const context = await this.permissionsService.getPermissionContext(
        supabaseId,
        tenantId,
      );
      if (!context) {
        throw new BadRequestException('Usuário não encontrado');
      }
      userId = context.userId;
      userPermissions = context.permissions;
    }

    // Buscar agente
    const { data: agent, error: fetchError } = await this.supabase
      .getClient()
      .from('agents')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !agent) {
      throw new NotFoundException('Agente não encontrado');
    }

    // Verificar permissão para deletar (usando permissões já carregadas)
    const canDelete = await this.agentsPermissionsService.canDelete(
      agent,
      userId,
      userPermissions,
      tenantId,
    );

    if (!canDelete) {
      throw new ForbiddenException('Sem permissão para deletar este agente');
    }

    const { error } = await this.supabase
      .getClient()
      .from('agents')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      this.logger.error(
        'Erro ao deletar agente',
        error.message,
        'AgentsService',
      );
      throw new BadRequestException('Erro ao deletar agente');
    }

    return { message: 'Agente deletado com sucesso' };
  }

  /**
   * Executa um agente
   */
  async execute(
    id: string,
    params: Record<string, any>,
    supabaseId: string,
    tenantId: string,
    schoolId?: string,
  ): Promise<ExecutionResult> {
    const userId = await this.getUserUuidFromSupabase(supabaseId);
    if (!userId) {
      throw new BadRequestException('Usuário não encontrado');
    }

    // Buscar agente
    const agent = await this.findOne(id, supabaseId, tenantId, schoolId);

    // Verificar permissão para executar
    const userPermissions = await this.permissionsService.getUserPermissions(
      supabaseId,
      tenantId,
      schoolId,
    );

    const userRoles = await this.rolesService
      .getUserRoles(supabaseId, tenantId, schoolId)
      .catch(() => []);

    const canExecute = await this.agentsPermissionsService.canExecute(
      agent,
      userId,
      userPermissions,
      userRoles.map((r: any) => ({
        id: r.role_id || r.roles?.id,
        slug: r.roles?.slug || '',
      })),
      tenantId,
    );

    if (!canExecute) {
      throw new ForbiddenException('Sem permissão para executar este agente');
    }

    // Incrementar contador de uso
    try {
      const { error } = await this.supabase
        .getClient()
        .from('agents')
        .update({ usage_count: (agent.usage_count || 0) + 1 })
        .eq('id', id);

      if (error) {
        this.logger.warn('Erro ao incrementar usage_count', 'AgentsService', {
          error: error.message,
        });
      }
    } catch (err: any) {
      this.logger.warn('Erro ao incrementar usage_count', 'AgentsService', {
        error: err?.message || 'Erro desconhecido',
      });
    }

    // Executar workflow usando WorkflowExecutorService
    const result = await this.workflowExecutor.executeWorkflow(
      agent.workflow,
      params,
    );

    return result;
  }

  /**
   * Executa um nó de IA individual (para execução híbrida)
   */
  async executeAINode(
    node: any,
    inputData: any,
    instructions?: string,
    options?: { maxLines?: number; executionModel?: string },
  ): Promise<any> {
    return this.workflowExecutor.executeAINode(
      node,
      inputData,
      instructions,
      options,
    );
  }

  /**
   * Renderiza um PDF a partir de Markdown (com header/footer padrão)
   */
  async renderPdfFromMarkdown(
    markdown: string,
    supabaseId: string,
    tenantId: string,
    schoolId?: string,
    fileName: string = 'relatorio.pdf',
  ) {
    if (!markdown || markdown.trim().length === 0) {
      throw new BadRequestException('Markdown vazio');
    }

    const user = await this.usersService.getUserByAuth0Id(supabaseId);

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const tenant = uuidRegex.test(tenantId)
      ? await this.tenantsService.getTenantById(tenantId)
      : await this.tenantsService.getTenantBySubdomain(tenantId);

    const resolvedSchoolId = schoolId || user?.current_school_id;
    const school = resolvedSchoolId
      ? await this.schoolsService.getSchoolById(resolvedSchoolId)
      : null;

    const userNameOrEmail = user?.full_name || user?.email || supabaseId;

    const pdfBuffer = await this.markdownPdfService.renderPdfFromMarkdown(
      markdown,
      {
        institutionName: tenant?.name || 'Instituição',
        institutionCnpj: (tenant as any)?.cnpj,
        schoolName: school?.name,
        schoolCnpj: school?.cnpj,
        userNameOrEmail,
        generatedAtIso: new Date().toISOString(),
      },
    );

    return {
      success: true,
      file: {
        data: pdfBuffer.toString('base64'),
        fileName,
        mimeType: 'application/pdf',
      },
    };
  }

  /**
   * Lista permissões de um agente
   */
  async getPermissions(id: string, tenantId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('agent_permissions')
      .select('*, users(id, email, full_name), roles(id, name, slug)')
      .eq('agent_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException('Erro ao buscar permissões');
    }

    return data || [];
  }

  /**
   * Adiciona permissão a um agente
   */
  async addPermission(
    id: string,
    dto: CreateAgentPermissionDto,
    tenantId: string,
  ) {
    // Verificar se agente existe
    const { data: agent } = await this.supabase
      .getClient()
      .from('agents')
      .select('id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (!agent) {
      throw new NotFoundException('Agente não encontrado');
    }

    // Validar que tem user_id OU role_id (não ambos)
    if (!dto.user_id && !dto.role_id) {
      throw new BadRequestException('Deve fornecer user_id ou role_id');
    }

    if (dto.user_id && dto.role_id) {
      throw new BadRequestException(
        'Não é possível fornecer user_id e role_id simultaneamente',
      );
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('agent_permissions')
      .insert({
        agent_id: id,
        user_id: dto.user_id || null,
        role_id: dto.role_id || null,
        can_view: dto.can_view,
        can_execute: dto.can_execute,
        can_edit: dto.can_edit,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // Unique constraint violation
        throw new BadRequestException(
          'Permissão já existe para este usuário/role',
        );
      }
      throw new BadRequestException('Erro ao adicionar permissão');
    }

    return data;
  }

  /**
   * Remove permissão de um agente
   */
  async removePermission(permId: string, tenantId: string) {
    const { error } = await this.supabase
      .getClient()
      .from('agent_permissions')
      .delete()
      .eq('id', permId);

    if (error) {
      throw new BadRequestException('Erro ao remover permissão');
    }

    return { message: 'Permissão removida com sucesso' };
  }

  /**
   * Adiciona bloqueio a um agente
   */
  async addRestriction(
    id: string,
    dto: CreateAgentRestrictionDto,
    tenantId: string,
  ) {
    // Verificar se agente existe
    const { data: agent } = await this.supabase
      .getClient()
      .from('agents')
      .select('id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (!agent) {
      throw new NotFoundException('Agente não encontrado');
    }

    // Validar que tem user_id OU role_id
    if (!dto.user_id && !dto.role_id) {
      throw new BadRequestException('Deve fornecer user_id ou role_id');
    }

    if (dto.user_id && dto.role_id) {
      throw new BadRequestException(
        'Não é possível fornecer user_id e role_id simultaneamente',
      );
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('agent_restrictions')
      .insert({
        agent_id: id,
        user_id: dto.user_id || null,
        role_id: dto.role_id || null,
        block_view: dto.block_view || false,
        block_execute: dto.block_execute || false,
        block_edit: dto.block_edit || false,
        reason: dto.reason,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new BadRequestException(
          'Bloqueio já existe para este usuário/role',
        );
      }
      throw new BadRequestException('Erro ao adicionar bloqueio');
    }

    return data;
  }

  /**
   * Remove bloqueio de um agente
   */
  async removeRestriction(restId: string, tenantId: string) {
    const { error } = await this.supabase
      .getClient()
      .from('agent_restrictions')
      .delete()
      .eq('id', restId);

    if (error) {
      throw new BadRequestException('Erro ao remover bloqueio');
    }

    return { message: 'Bloqueio removido com sucesso' };
  }

  /**
   * Lista bloqueios de um agente
   */
  async getRestrictions(id: string, tenantId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('agent_restrictions')
      .select('*, users(id, email, full_name), roles(id, name, slug)')
      .eq('agent_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException('Erro ao buscar bloqueios');
    }

    return data || [];
  }

  /**
   * Verifica permissão RBAC
   */
  private checkPermission(
    permissions: Record<string, string[]>,
    resource: string,
    action: string,
  ): boolean {
    if (permissions['*']?.includes('*')) {
      return true;
    }

    if (permissions[resource]) {
      return (
        permissions[resource].includes(action) ||
        permissions[resource].includes('*') ||
        permissions[resource].includes('manage')
      );
    }

    if (permissions['*']?.includes(action)) {
      return true;
    }

    return false;
  }
}
